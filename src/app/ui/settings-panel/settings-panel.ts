import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';
import { AudioEngine, MIC_VOLUME_MAX } from '../../core/audio/audio-engine';
import { GATE_OFF_DB, METER_CEIL_DB, isGateEnabled } from '../../core/audio/levels';
import { MuteHotkey } from '../../core/hotkey/mute-hotkey';
import { I18n, Language } from '../../core/i18n/language';
import { RoomService } from '../../core/net/room';
import { BITRATES, Settings, ThemeMode } from '../../core/settings';
import { LevelMeter } from '../level-meter/level-meter';

@Component({
  selector: 'app-settings-panel',
  imports: [
    FormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatSliderModule,
    MatTooltipModule,
    TranslatePipe,
    LevelMeter,
  ],
  templateUrl: './settings-panel.html',
  styleUrl: './settings-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPanel {
  readonly close = output<void>();

  protected readonly settings = inject(Settings);
  protected readonly audio = inject(AudioEngine);
  protected readonly hotkey = inject(MuteHotkey);
  protected readonly room = inject(RoomService);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly i18n = inject(I18n);

  protected readonly languages: { value: Language; label: string; short: string }[] = [
    { value: 'de', label: 'Deutsch', short: 'DE' },
    { value: 'en', label: 'English', short: 'EN' },
  ];
  protected readonly themes: { value: ThemeMode; icon: string }[] = [
    { value: 'system', icon: 'brightness_auto' },
    { value: 'light', icon: 'light_mode' },
    { value: 'dark', icon: 'dark_mode' },
  ];
  protected readonly bitrates = BITRATES.map((value) => ({
    value,
    key: bitrateKey(value),
    params: { kbps: value / 1000 },
  }));

  protected readonly joined = computed(() => this.room.status() !== 'idle');
  protected readonly micVolumeMax = MIC_VOLUME_MAX;
  protected readonly gateOffDb = GATE_OFF_DB;
  protected readonly gateEnabled = computed(() => isGateEnabled(this.settings.gateDb()));
  protected readonly meterCeilDb = METER_CEIL_DB;
  protected readonly gateLabel = computed(() =>
    this.gateEnabled() ? `${this.settings.gateDb()} dB` : this.i18n.text('self.gateOff'),
  );

  protected changeMicrophone(id: string): void {
    const previous = this.settings.microphoneId();
    this.settings.microphoneId.set(id);
    this.reopen(() => this.settings.microphoneId.set(previous));
  }

  protected changeHeadphoneMode(enabled: boolean): void {
    const previous = this.settings.headphoneMode();
    this.settings.headphoneMode.set(enabled);
    this.reopen(() => this.settings.headphoneMode.set(previous));
  }

  /** The old microphone stays open when the new one fails, so the setting goes back to match it. */
  private reopen(revert: () => void): void {
    this.audio.reopenInput().catch(() => {
      revert();
      this.snackBar.open(this.i18n.text('devices.reopenFailed'), undefined, { duration: 4000 });
    });
  }
}

function bitrateKey(bitrate: number): string {
  switch (bitrate) {
    case 510_000:
      return 'quality.max';
    case 256_000:
      return 'quality.veryHigh';
    case 128_000:
      return 'quality.high';
    default:
      return 'quality.standard';
  }
}
