import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSliderModule } from '@angular/material/slider';
import { TranslatePipe } from '@ngx-translate/core';
import { I18n } from '../../../core/i18n/language';
import { Peer, RoomService } from '../../../core/net/room';
import { PeerStats, Route } from '../../../core/net/peer-stats';
import { MemberRow } from '../member-row/member-row';

@Component({
  selector: 'app-peer-tile',
  imports: [FormsModule, MatIconModule, MatMenuModule, MatSliderModule, TranslatePipe, MemberRow],
  templateUrl: './peer-tile.html',
  styleUrl: './peer-tile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PeerTile {
  readonly peer = input.required<Peer>();
  readonly away = input(false);

  private readonly room = inject(RoomService);
  private readonly i18n = inject(I18n);
  protected readonly speaking = computed(() => this.room.speakingPeers().has(this.peer().id));

  constructor() {
    // Only the meter of a peer we hear reports speaking; a tile that stops hearing it says so.
    effect(() => {
      const id = this.peer().id;
      if (this.away() || this.peer().connecting) untracked(() => this.room.setSpeaking(id, false));
    });
    inject(DestroyRef).onDestroy(() => this.room.setSpeaking(this.peer().id, false));
  }

  protected reportSpeaking(speaking: boolean): void {
    this.room.setSpeaking(this.peer().id, speaking);
  }

  protected readonly analyser = computed(() => {
    const peer = this.peer();
    return peer.hasAudio ? this.room.analyserFor(peer.id) : null;
  });

  protected readonly name = computed(() => this.peer().name ?? this.i18n.text('peer.connecting'));

  protected readonly details = computed(() => describeStats(this.i18n, this.peer().stats));

  protected setVolume(volume: number): void {
    this.room.setVolume(this.peer().id, volume);
  }
}

const ROUTE_KEYS: Record<Route, string> = {
  relay: 'stats.relay',
  direct: 'stats.direct',
  'direct-ipv6': 'stats.directIpv6',
};

function describeStats(i18n: I18n, stats: PeerStats | null): string[] {
  if (!stats) return [];
  const parts: string[] = [];
  if (stats.inKbps !== null) parts.push(`↓ ${stats.inKbps} kbit/s`);
  if (stats.outKbps !== null) parts.push(`↑ ${stats.outKbps} kbit/s`);
  if (stats.rttMs !== null) parts.push(`${stats.rttMs} ms`);
  if (stats.lossPercent !== null) {
    const loss = stats.lossPercent.toLocaleString(i18n.language(), { maximumFractionDigits: 1 });
    parts.push(i18n.text('stats.loss', { loss }));
  }
  if (stats.route) parts.push(i18n.text(ROUTE_KEYS[stats.route]));
  return parts;
}
