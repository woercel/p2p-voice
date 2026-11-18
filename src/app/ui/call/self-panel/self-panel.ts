import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AudioEngine } from '../../../core/audio/audio-engine';
import { GATE_OFF_DB, isGateEnabled, meterPercent } from '../../../core/audio/levels';
import { MuteHotkey } from '../../../core/hotkey/mute-hotkey';
import { RoomService } from '../../../core/net/room';
import { Settings } from '../../../core/settings';
import { LevelMeter } from '../../level-meter/level-meter';

@Component({
  selector: 'app-self-panel',
  imports: [
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatSliderModule,
    MatTooltipModule,
    LevelMeter,
  ],
  templateUrl: './self-panel.html',
  styleUrl: './self-panel.scss',
  host: { '[class.speaking]': 'audio.speaking()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelfPanel {
  protected readonly audio = inject(AudioEngine);
  protected readonly settings = inject(Settings);
  protected readonly hotkey = inject(MuteHotkey);
  protected readonly room = inject(RoomService);

  protected readonly gateOffDb = GATE_OFF_DB;
  protected readonly gateEnabled = computed(() => isGateEnabled(this.settings.gateDb()));
  protected readonly thresholdPercent = computed(() => meterPercent(this.settings.gateDb()));
  protected readonly total = computed(() => this.room.peers().size + 1);
  protected readonly name = computed(
    () => this.settings.name().trim() || $localize`:@@peer.anonymous:Anonymous`,
  );

  protected readonly formatGate = (db: number): string =>
    isGateEnabled(db) ? `${db}` : $localize`:@@self.gateOffShort:off`;

  protected readonly gateLabel = computed(() =>
    this.gateEnabled() ? `${this.settings.gateDb()} dB` : $localize`:@@self.gateOff:Off`,
  );

  protected toggleMute(): void {
    this.audio.muted.update((muted) => !muted);
  }
}
