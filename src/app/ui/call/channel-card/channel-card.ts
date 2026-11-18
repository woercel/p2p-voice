import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AudioEngine } from '../../../core/audio/audio-engine';
import { isGateEnabled } from '../../../core/audio/levels';
import { Peer } from '../../../core/net/room';
import { Settings } from '../../../core/settings';
import { MemberRow } from '../member-row/member-row';
import { PeerTile } from '../peer-tile/peer-tile';

export type ChannelView = {
  id: string;
  name: string;
  members: Peer[];
  here: boolean;
  count: number;
  deletable: boolean;
};

/** A channel surface; clicking anywhere on it moves you there. */
@Component({
  selector: 'app-channel-card',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule, MemberRow, PeerTile],
  templateUrl: './channel-card.html',
  styleUrl: './channel-card.scss',
  host: {
    '[class.here]': 'channel().here',
    '[attr.role]': 'channel().here ? null : "button"',
    '[attr.tabindex]': 'channel().here ? null : 0',
    '[attr.aria-label]': 'channel().here ? null : joinLabel + " " + channel().name',
    '(click)': 'join($event)',
    '(keydown.enter)': 'join($event)',
    '(keydown.space)': 'join($event)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChannelCard {
  readonly channel = input.required<ChannelView>();
  readonly selfName = input.required<string>();
  readonly enter = output<void>();
  readonly remove = output<void>();

  protected readonly audio = inject(AudioEngine);
  private readonly settings = inject(Settings);
  protected readonly gateDb = computed(() => {
    const db = this.settings.gateDb();
    return isGateEnabled(db) ? db : null;
  });
  protected readonly joinLabel = $localize`:@@channel.join:Join`;

  protected join(event: Event): void {
    if (this.channel().here) return;
    event.preventDefault();
    this.enter.emit();
  }

  protected removeChannel(event: Event): void {
    event.stopPropagation();
    this.remove.emit();
  }
}
