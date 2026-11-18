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

@Injectable({ providedIn: 'root' })
export class AudioEngine {
  private readonly settings = inject(Settings);

  private context: AudioContext | null = null;
  private gate: AudioWorkletNode | null = null;
  private input: MediaStreamAudioSourceNode | null = null;
  private rawStream: MediaStream | null = null;
  private testTone = false;

  readonly sendStream = signal<MediaStream | null>(null);
  readonly selfAnalyser = signal<AnalyserNode | null>(null);
  readonly muted = signal(false);
  readonly gateOpen = signal(true);
  readonly voiceActive = signal(false);
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
      const muted = this.muted();
      this.sendStream()
        ?.getAudioTracks()
        .forEach((track) => (track.enabled = !muted));
    });
    effect(() => {
      const outputId = this.settings.outputId();
      if (this.sendStream()) void this.applyOutput(outputId);
    });

    navigator.mediaDevices?.addEventListener('devicechange', () => void this.refreshDevices());
    void this.refreshDevices();
  }

  async start(testTone: boolean): Promise<MediaStream> {
    const context = new AudioContext({ latencyHint: 'interactive' });
    this.context = context;
    this.testTone = testTone;
    try {
      await context.resume();
      await context.audioWorklet.addModule('worklets/gate.js');
      this.gate = new AudioWorkletNode(context, 'gate', { outputChannelCount: [2] });
      this.gate.port.onmessage = (event: MessageEvent<boolean>) => this.gateOpen.set(event.data);

      const destination = context.createMediaStreamDestination();
      destination.channelCount = 2;
      this.gate.connect(destination);

      this.connectInput(await this.openInput());
      this.sendStream.set(destination.stream);
      await this.refreshDevices();
      return destination.stream;
    } catch (error) {
      await this.stop();
      throw error;
    }
  }

  /** The sent track stays the same; only the gate input is rewired, so peers notice nothing. */
  async reopenInput(): Promise<void> {
    if (!this.context) return;
    this.rawStream?.getTracks().forEach((track) => track.stop());
    this.connectInput(await this.openInput());
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
    this.input = null;
    this.rawStream = null;
    this.sendStream.set(null);
    this.selfAnalyser.set(null);
    this.muted.set(false);
    this.gateOpen.set(true);
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

  private openInput(): Promise<MediaStream> {
    if (this.testTone && this.context) return Promise.resolve(this.createTestTone(this.context));
    const filters = !this.settings.headphoneMode();
    const deviceId = this.settings.microphoneId();
    return navigator.mediaDevices.getUserMedia({
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
  }

  private connectInput(stream: MediaStream): void {
    if (!this.context || !this.gate) return;
    this.input?.disconnect();
    this.rawStream = stream;
    this.input = this.context.createMediaStreamSource(stream);
    const analyser = this.context.createAnalyser();
    analyser.fftSize = 1024;
    this.input.connect(analyser);
    this.input.connect(this.gate);
    this.selfAnalyser.set(analyser);
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
