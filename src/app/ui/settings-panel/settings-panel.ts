import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AudioEngine } from '../../core/audio/audio-engine';
import { GATE_OFF_DB, isGateEnabled, meterPercent } from '../../core/audio/levels';
import { MuteHotkey } from '../../core/hotkey/mute-hotkey';
import { Language, currentLanguage, switchLanguage } from '../../core/i18n/language';
import { RoomService } from '../../core/net/room';
import { BITRATES, Settings, ThemeMode } from '../../core/settings';
import { LevelMeter } from '../level-meter/level-meter';

@Component({
  selector: 'app-settings-panel',
  imports: [
    FormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatSliderModule,
    MatTooltipModule,
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

  protected readonly language = currentLanguage();
  protected readonly languages: { value: Language; label: string }[] = [
    { value: 'de', label: 'Deutsch' },
    { value: 'en', label: 'English' },
  ];
  protected readonly themes: { value: ThemeMode; icon: string; label: string }[] = [
    { value: 'system', icon: 'brightness_auto', label: $localize`:@@theme.system:System` },
    { value: 'light', icon: 'light_mode', label: $localize`:@@theme.light:Light` },
    { value: 'dark', icon: 'dark_mode', label: $localize`:@@theme.dark:Dark` },
  ];
  protected readonly bitrates = BITRATES.map((value) => ({ value, label: bitrateLabel(value) }));

  protected readonly joined = computed(() => this.room.status() !== 'idle');
  protected readonly gateOffDb = GATE_OFF_DB;
  protected readonly gateEnabled = computed(() => isGateEnabled(this.settings.gateDb()));
  protected readonly thresholdPercent = computed(() => meterPercent(this.settings.gateDb()));
  protected readonly gateLabel = computed(() =>
    this.gateEnabled() ? `${this.settings.gateDb()} dB` : $localize`:@@self.gateOff:Off`,
  );
  protected readonly formatGate = (db: number): string =>
    isGateEnabled(db) ? `${db}` : $localize`:@@self.gateOffShort:off`;

  protected changeMicrophone(id: string): void {
    this.settings.microphoneId.set(id);
    this.reopen();
  }

  protected changeHeadphoneMode(enabled: boolean): void {
    this.settings.headphoneMode.set(enabled);
    this.reopen();
  }

  protected changeLanguage(language: Language): void {
    if (language !== this.language) switchLanguage(language);
  }

  private reopen(): void {
    this.audio
      .reopenInput()
      .catch(() =>
        this.snackBar.open(
          $localize`:@@devices.reopenFailed:Could not open the microphone.`,
          undefined,
          { duration: 4000 },
        ),
      );
  }
}

function bitrateLabel(bitrate: number): string {
  const kbps = bitrate / 1000;
  switch (bitrate) {
    case 510_000:
      return $localize`:@@quality.max:${kbps}:kbps: kbit/s – maximum`;
    case 256_000:
      return $localize`:@@quality.veryHigh:${kbps}:kbps: kbit/s – very high`;
    case 128_000:
      return $localize`:@@quality.high:${kbps}:kbps: kbit/s – high, transparent`;
    default:
      return $localize`:@@quality.standard:${kbps}:kbps: kbit/s – typical voice chat`;
  }
}
