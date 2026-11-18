import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { currentLanguage } from '../../../core/i18n/language';
import { Peer, RoomService } from '../../../core/net/room';
import { PeerStats } from '../../../core/net/peer-stats';
import { LevelMeter } from '../../level-meter/level-meter';

@Component({
  selector: 'app-peer-tile',
  imports: [FormsModule, MatIconModule, MatSliderModule, LevelMeter],
  templateUrl: './peer-tile.html',
  styleUrl: './peer-tile.scss',
  host: {
    '[class.speaking]': 'speaking() && !away()',
    '[class.away]': 'away()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PeerTile {
  readonly peer = input.required<Peer>();
  readonly away = input(false);

  private readonly room = inject(RoomService);
  protected readonly speaking = signal(false);

  protected readonly analyser = computed(() => {
    const peer = this.peer();
    return peer.hasAudio ? this.room.analyserFor(peer.id) : null;
  });

  protected readonly name = computed(
    () => this.peer().name ?? $localize`:@@peer.connecting:Connecting…`,
  );

  protected readonly details = computed(() => describeStats(this.peer().stats));

  protected setVolume(volume: number): void {
    this.room.setVolume(this.peer().id, volume);
  }
}

function describeStats(stats: PeerStats | null): string {
  if (!stats) return '';
  const parts: string[] = [];
  if (stats.inKbps !== null) parts.push(`↓ ${stats.inKbps} kbit/s`);
  if (stats.outKbps !== null) parts.push(`↑ ${stats.outKbps} kbit/s`);
  if (stats.rttMs !== null) parts.push(`${stats.rttMs} ms`);
  if (stats.lossPercent !== null) {
    const loss = stats.lossPercent.toLocaleString(currentLanguage(), { maximumFractionDigits: 1 });
    parts.push($localize`:@@stats.loss:${loss}:loss: % loss`);
  }
  if (stats.route === 'relay') parts.push($localize`:@@stats.relay:via relay`);
  if (stats.route === 'direct') parts.push($localize`:@@stats.direct:direct`);
  if (stats.route === 'direct-ipv6') parts.push($localize`:@@stats.directIpv6:direct (IPv6)`);
  return parts.join(' · ');
}
