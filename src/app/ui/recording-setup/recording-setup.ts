import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TranslatePipe } from '@ngx-translate/core';
import { AudioEngine } from '../../core/audio/audio-engine';
import {
  Calibration,
  Frame,
  PROBE_FREQUENCIES,
  analyzeFrame,
  calibrate,
  hearsOutput,
} from '../../core/audio/calibration';
import { isGateEnabled, meterPercent } from '../../core/audio/levels';
import { RoomService } from '../../core/net/room';
import { Settings } from '../../core/settings';
import { LevelMeter } from '../level-meter/level-meter';

type Step = 'intro' | 'silence' | 'speakers' | 'typing' | 'speech' | 'result';

const SAMPLE_MS = 50;
const SILENCE_MS = 3000;
const TYPING_MS = 5000;
const SPEECH_MS = 8000;
const PROBE_BASELINE_MS = 600;
const PROBE_MS = 1600;
/** The tones need a moment to come out of the speakers and back into the microphone. */
const PROBE_SETTLE_MS = 250;
const SILENT_DB = -200;

const STEP_ICONS: Record<Step, string> = {
  intro: 'tune',
  silence: 'do_not_disturb_on',
  speakers: 'speaker',
  typing: 'keyboard',
  speech: 'record_voice_over',
  result: 'check_circle',
};

/**
 * Walks through a few short recordings (silence, the speakers, typing, speech) and derives the
 * microphone volume and voice threshold from them. Nothing is sent meanwhile.
 */
@Component({
  selector: 'app-recording-setup',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatProgressBarModule,
    TranslatePipe,
    LevelMeter,
  ],
  templateUrl: './recording-setup.html',
  styleUrl: './recording-setup.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecordingSetup {
  protected readonly audio = inject(AudioEngine);
  protected readonly settings = inject(Settings);
  private readonly ref = inject<MatDialogRef<RecordingSetup>>(MatDialogRef);
  private readonly room = inject(RoomService);
  /** Opened from the lobby, nobody can hear us anyway. */
  protected readonly inCall = this.room.status() === 'joined';

  private readonly original = {
    micVolume: this.settings.micVolume(),
    gateDb: this.settings.gateDb(),
  };
  private applied = false;
  private cancelled = false;
  private timer: ReturnType<typeof setInterval> | undefined;

  /** The speaker check only makes sense without echo cancellation, which hides the tones. */
  protected readonly checksSpeakers = this.settings.headphoneMode() && !this.audio.usingTestTone();
  protected readonly filtered = !this.settings.headphoneMode();
  private readonly measuring: Step[] = this.checksSpeakers
    ? ['silence', 'speakers', 'typing', 'speech']
    : ['silence', 'typing', 'speech'];

  protected readonly step = signal<Step>('intro');
  protected readonly progress = signal(0);
  protected readonly result = signal<Calibration | null>(null);
  protected readonly hearsSpeakers = signal(false);

  protected readonly icon = computed(() => STEP_ICONS[this.step()]);
  protected readonly stepNumber = computed(() => this.measuring.indexOf(this.step()) + 1);
  protected readonly stepCount = this.measuring.length;
  protected readonly running = computed(() => this.stepNumber() > 0);
  protected readonly gateEnabled = computed(() => isGateEnabled(this.settings.gateDb()));
  protected readonly gateMarker = computed(() => meterPercent(this.settings.gateDb()));
  /** Warnings to show, the speaker finding included. */
  protected readonly warnings = computed(() => {
    const result = this.result();
    const warnings: string[] = result?.ok ? [...result.warnings] : [];
    if (this.hearsSpeakers()) warnings.unshift('speakers');
    return warnings;
  });

  constructor() {
    // Leaving the room ends the microphone, and with it a setup started in the call.
    effect(() => {
      if (this.inCall && this.room.status() !== 'joined') this.ref.close();
    });
    inject(DestroyRef).onDestroy(() => {
      this.cancelled = true;
      clearInterval(this.timer);
      this.audio.holdBack.set(false);
      if (!this.applied) this.restore();
    });
  }

  protected async start(): Promise<void> {
    this.restore();
    this.result.set(null);
    this.hearsSpeakers.set(false);
    this.audio.holdBack.set(true);

    this.step.set('silence');
    const silence = await this.record(SILENCE_MS);
    if (this.cancelled) return;

    if (this.checksSpeakers) {
      this.step.set('speakers');
      this.hearsSpeakers.set(await this.probeSpeakers());
      if (this.cancelled) return;
    }

    this.step.set('typing');
    const typing = await this.record(TYPING_MS);
    if (this.cancelled) return;

    this.step.set('speech');
    const speech = await this.record(SPEECH_MS);
    if (this.cancelled) return;

    const result = calibrate({ silence, typing, speech });
    this.result.set(result);
    if (result.ok) {
      // Applied right away, so the meter below shows how it would sound; cancel takes it back.
      this.settings.micVolume.set(result.micVolume);
      this.settings.gateDb.set(result.gateDb);
    }
    this.step.set('result');
  }

  protected apply(): void {
    this.applied = true;
    this.settings.setupOffered.set(true);
    this.ref.close(true);
  }

  private restore(): void {
    this.settings.micVolume.set(this.original.micVolume);
    this.settings.gateDb.set(this.original.gateDb);
  }

  private record(ms: number): Promise<Frame[]> {
    const buffer = new Float32Array(2048);
    return this.collect(ms, () => {
      const analyser = this.audio.rawAnalyser();
      if (!analyser) return null;
      analyser.getFloatTimeDomainData(buffer);
      return analyzeFrame(buffer, Math.min(buffer.length, analyser.fftSize));
    });
  }

  /** Plays quiet tones and checks whether they come back through the microphone. */
  private async probeSpeakers(): Promise<boolean> {
    const analyser = this.audio.rawAnalyser();
    if (!analyser) return false;
    const binWidth = analyser.context.sampleRate / analyser.fftSize;
    const bins = PROBE_FREQUENCIES.map((frequency) => Math.round(frequency / binWidth));
    const spectrum = new Float32Array(analyser.frequencyBinCount);
    const read = () => {
      analyser.getFloatFrequencyData(spectrum);
      return bins.map((bin) => Math.max(SILENT_DB, spectrum[bin]));
    };
    const total = PROBE_BASELINE_MS + PROBE_MS;

    const before = await this.collect(PROBE_BASELINE_MS, read, 0, total);
    if (this.cancelled) return false;
    const playing = this.audio.playProbe(PROBE_FREQUENCIES, PROBE_MS);
    await this.collect(PROBE_SETTLE_MS, () => null, PROBE_BASELINE_MS, total);
    const during = await this.collect(
      PROBE_MS - PROBE_SETTLE_MS - SAMPLE_MS * 2,
      read,
      PROBE_BASELINE_MS + PROBE_SETTLE_MS,
      total,
    );
    await playing;
    return hearsOutput(averages(before), averages(during));
  }

  /** Reads every few milliseconds for `ms` and moves the progress bar along `offset / total`. */
  private collect<T>(ms: number, read: () => T | null, offset = 0, total = ms): Promise<T[]> {
    const values: T[] = [];
    const started = performance.now();
    return new Promise((resolve) => {
      const tick = () => {
        const elapsed = performance.now() - started;
        const value = read();
        if (value !== null) values.push(value);
        this.progress.set(Math.min(100, ((offset + elapsed) / total) * 100));
        if (elapsed >= ms || this.cancelled) {
          clearInterval(this.timer);
          resolve(values);
        }
      };
      clearInterval(this.timer);
      this.timer = setInterval(tick, SAMPLE_MS);
    });
  }
}

function averages(rows: number[][]): number[] {
  if (!rows.length) return PROBE_FREQUENCIES.map(() => SILENT_DB);
  return rows[0].map((_, i) => rows.reduce((sum, row) => sum + row[i], 0) / rows.length);
}
