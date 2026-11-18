import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AudioEngine } from '../../../core/audio/audio-engine';
import { Peer } from '../../../core/net/room';
import { PeerTile } from '../peer-tile/peer-tile';

export type ChannelView = {
  id: string;
  name: string;
  members: Peer[];
  here: boolean;
  count: number;
  deletable: boolean;
};

@Component({
  selector: 'app-channel-card',
  imports: [MatButtonModule, MatCardModule, MatIconModule, MatTooltipModule, PeerTile],
  templateUrl: './channel-card.html',
  styleUrl: './channel-card.scss',
  host: { '[class.here]': 'channel().here' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChannelCard {
  readonly channel = input.required<ChannelView>();
  readonly selfName = input.required<string>();
  readonly enter = output<void>();
  readonly remove = output<void>();

  protected readonly audio = inject(AudioEngine);
}
