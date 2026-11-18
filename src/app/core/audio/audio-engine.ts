import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Settings } from '../settings';
import { Cue, playCue } from './cues';
import { dbToLinear, isGateEnabled } from './levels';

export type Playback = {
  readonly analyser: AnalyserNode;
  setGain(value: number): void;
  dispose(): void;
};

const HIDDEN_DEVICE_IDS = ['', 'default', 'communications'];
const RESUME_WAIT_MS = 500;

export const MIC_VOLUME_MAX = 200;

/** Percent to linear gain; a broken stored value falls back to unchanged. */
const micGain = (percent: number): number =>
  Number.isFinite(percent) ? Math.min(MIC_VOLUME_MAX, Math.max(0, percent)) / 100 : 1;

/** An `exact` device id that matches no device fails with one of these, depending on the browser. */
const isMissingDevice = (error: unknown): boolean => {
  const name = (error as { name?: unknown } | null)?.name;
  return name === 'OverconstrainedError' || name === 'NotFoundError';
};

@Injectable({ providedIn: 'root' })
export class AudioEngine {
  private readonly settings = inject(Settings);

  private context: AudioContext | null = null;
  private gate: AudioWorkletNode | null = null;
  private inputGain: GainNode | null = null;
  private input: MediaStreamAudioSourceNode | null = null;
  private rawStream: MediaStream | null = null;
  private testTone = false;

  readonly sendStream = signal<MediaStream | null>(null);
  readonly selfAnalyser = signal<AnalyserNode | null>(null);
  readonly muted = signal(false);
  readonly gateOpen = signal(true);
  readonly voiceActive = signal(false);
  /** The browser holds audio back until the next click or key press. */
  readonly soundBlocked = signal(false);
  readonly speaking = computed(() => this.voiceActive() && this.gateOpen() && !this.muted());
  readonly devices = signal<MediaDeviceInfo[]>([]);
  readonly inputs = computed(() => this.devices().filter((d) => d.kind === 'audioinput'));
  readonly outputs = computed(() => this.devices().filter((d) => d.kind === 'audiooutput'));
  readonly canSelectOutput =
    typeof AudioContext !== 'undefined' && 'setSinkId' in AudioContext.prototype;

  constructor() {
    effect(() => {
      const db = this.settings.gateDb();
      if (!this.sendStream() || !this.gate || !this.context) return;
      const threshold = isGateEnabled(db) ? dbToLinear(db) : 0;
      this.gate.parameters.get('threshold')?.setValueAtTime(threshold, this.context.currentTime);
    });
    effect(() => {
      const gain = micGain(this.settings.micVolume());
      if (!this.sendStream() || !this.inputGain || !this.context) return;
      this.inputGain.gain.setTargetAtTime(gain, this.context.currentTime, 0.01);
    });
    effect(() => {
      const muted = this.muted();
      this.sendStream()
        ?.getAudioTracks()
        .forEach((track) => (track.enabled = !muted));
    });
    effect(() => {
      const outputId = this.settings.outputId();
      if (this.sendStream()) void this.applyOutput(outputId);
    });

    const unlock = () => {
      if (this.context?.state === 'suspended') void this.context.resume();
    };
    for (const type of ['pointerdown', 'keydown']) {
      document.addEventListener(type, unlock, { capture: true });
    }

    navigator.mediaDevices?.addEventListener('devicechange', () => void this.refreshDevices());
    void this.refreshDevices();
  }

  async start(testTone: boolean): Promise<MediaStream> {
    const context = new AudioContext({ latencyHint: 'interactive' });
    this.context = context;
    this.testTone = testTone;
    context.onstatechange = () => this.soundBlocked.set(context.state === 'suspended');
    // Rejoining after a reload has no click behind it, and browsers may then hold audio back
    // until the next gesture. Waiting for that would stall the join, so only wait briefly.
    const resumed = context.resume();
    try {
      await context.audioWorklet.addModule('worklets/gate.js');
      this.gate = new AudioWorkletNode(context, 'gate', { outputChannelCount: [2] });
      this.gate.port.onmessage = (event: MessageEvent<boolean>) => this.gateOpen.set(event.data);

      const destination = context.createMediaStreamDestination();
      destination.channelCount = 2;
      this.gate.connect(destination);

      // The volume comes before the meter and the gate, so both see what is actually sent.
      this.inputGain = context.createGain();
      this.inputGain.gain.value = micGain(this.settings.micVolume());
      this.inputGain.connect(this.gate);
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      this.inputGain.connect(analyser);
      this.selfAnalyser.set(analyser);

      this.connectInput(await this.openInput());
      this.sendStream.set(destination.stream);
      await this.refreshDevices();
      await Promise.race([resumed, new Promise((resolve) => setTimeout(resolve, RESUME_WAIT_MS))]);
      this.soundBlocked.set(context.state === 'suspended');
      return destination.stream;
    } catch (error) {
      await this.stop();
      throw error;
    }
  }

  /**
   * The sent track stays the same; only the gate input is rewired, so peers notice nothing.
   * The old microphone keeps running until the new one is open, so a failure changes nothing.
   */
  async reopenInput(): Promise<void> {
    if (!this.context) return;
    const previous = this.rawStream;
    const stream = await this.openInput();
    if (!this.context) {
      // Left the room while the browser was opening the device.
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    this.connectInput(stream);
    previous?.getTracks().forEach((track) => track.stop());
  }

  createPlayback(stream: MediaStream): Playback {
    const context = this.context;
    if (!context) throw new Error('Audio engine not started');

    // Chrome only feeds remote WebRTC audio into Web Audio while a media element holds the stream.
    const element = new Audio();
    element.muted = true;
    element.srcObject = stream;
    void element.play().catch(() => undefined);

    const source = context.createMediaStreamSource(stream);
    const gain = context.createGain();
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(gain);
    gain.connect(analyser);
    gain.connect(context.destination);

    return {
      analyser,
      setGain: (value) => gain.gain.setTargetAtTime(value, context.currentTime, 0.01),
      dispose: () => {
        source.disconnect();
        gain.disconnect();
        element.srcObject = null;
      },
    };
  }

  playCue(cue: Cue): void {
    if (this.context?.state === 'running') playCue(this.context, cue);
  }

  async stop(): Promise<void> {
    this.rawStream?.getTracks().forEach((track) => track.stop());
    this.sendStream()
      ?.getTracks()
      .forEach((track) => track.stop());
    await this.context?.close().catch(() => undefined);
    this.context = null;
    this.gate = null;
    this.inputGain = null;
    this.input = null;
    this.rawStream = null;
    this.sendStream.set(null);
    this.selfAnalyser.set(null);
    this.muted.set(false);
    this.gateOpen.set(true);
    this.soundBlocked.set(false);
  }

  private async refreshDevices(): Promise<void> {
    const devices = (await navigator.mediaDevices?.enumerateDevices()) ?? [];
    this.devices.set(devices.filter((d) => !HIDDEN_DEVICE_IDS.includes(d.deviceId)));
  }

  private async applyOutput(deviceId: string): Promise<void> {
    if (!this.canSelectOutput || !this.context) return;
    const context = this.context as AudioContext & { setSinkId(id: string): Promise<void> };
    await context.setSinkId(deviceId).catch(() => undefined);
  }

  private async openInput(): Promise<MediaStream> {
    if (this.testTone && this.context) return this.createTestTone(this.context);
    const filters = !this.settings.headphoneMode();
    const open = (deviceId: string) =>
      navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: filters,
          noiseSuppression: filters,
          autoGainControl: filters,
          channelCount: { ideal: 2 },
          sampleRate: { ideal: 48_000 },
          sampleSize: { ideal: 24 },
        },
      });

    const deviceId = this.settings.microphoneId();
    try {
      return await open(deviceId);
    } catch (error) {
      if (!deviceId || !isMissingDevice(error)) throw error;
      // The remembered microphone is gone (unplugged, or ids reset); use the default instead.
      const stream = await open('');
      this.settings.microphoneId.set('');
      return stream;
    }
  }

  private connectInput(stream: MediaStream): void {
    if (!this.context || !this.inputGain) return;
    this.input?.disconnect();
    this.rawStream = stream;
    this.input = this.context.createMediaStreamSource(stream);
    this.input.connect(this.inputGain);
  }

  private createTestTone(context: AudioContext): MediaStream {
    const destination = context.createMediaStreamDestination();
    destination.channelCount = 2;
    const merger = context.createChannelMerger(2);
    [440, 660].forEach((frequency, channel) => {
      const oscillator = context.createOscillator();
      oscillator.frequency.value = frequency;
      const gain = context.createGain();
      gain.gain.value = 0.15;
      oscillator.connect(gain).connect(merger, 0, channel);
      oscillator.start();
    });
    merger.connect(destination);
    return destination.stream;
  }
}
