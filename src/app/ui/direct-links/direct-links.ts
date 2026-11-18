import { ChangeDetectionStrategy, Component } from '@angular/core';
import { avatarUri } from '../../core/avatar';

type Point = { x: number; y: number };

const PEERS: (Point & { seed: string; delay: number })[] = [
  { x: 130, y: 26, seed: 'Mia', delay: 0 },
  { x: 222, y: 100, seed: 'Ben', delay: 1000 },
  { x: 38, y: 100, seed: 'Lea', delay: 2000 },
];

/**
 * Three people talking over direct links, with the uninvited listener in the middle crossed out:
 * nobody sits between them.
 */
@Component({
  selector: 'app-direct-links',
  template: `
    <svg viewBox="0 0 260 128" aria-hidden="true">
      @for (link of links; track $index) {
        <line
          class="link"
          [attr.x1]="link.from.x"
          [attr.y1]="link.from.y"
          [attr.x2]="link.to.x"
          [attr.y2]="link.to.y"
        />
        <line
          class="flow"
          [class.reverse]="link.reverse"
          [attr.x1]="link.from.x"
          [attr.y1]="link.from.y"
          [attr.x2]="link.to.x"
          [attr.y2]="link.to.y"
        />
      }

      <g class="nobody">
        <circle class="head" cx="130" cy="68" r="5.5" />
        <path class="body" d="M119.5 86 a10.5 10.5 0 0 1 21 0" />
        <circle class="forbidden" cx="130" cy="74" r="17" />
        <line class="forbidden" x1="118" y1="62" x2="142" y2="86" />
      </g>

      @for (peer of peers; track peer.seed) {
        <circle
          class="halo"
          [attr.cx]="peer.x"
          [attr.cy]="peer.y"
          r="20"
          [style.animation-delay.ms]="peer.delay"
        />
        <circle class="seat" [attr.cx]="peer.x" [attr.cy]="peer.y" r="20" />
        <image
          [attr.href]="peer.avatar"
          [attr.x]="peer.x - 14"
          [attr.y]="peer.y - 14"
          width="28"
          height="28"
        />
      }
    </svg>
  `,
  styleUrl: './direct-links.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DirectLinks {
  protected readonly peers = PEERS.map((peer) => ({ ...peer, avatar: avatarUri(peer.seed) }));

  protected readonly links = PEERS.map((from, i) => ({
    from,
    to: PEERS[(i + 1) % PEERS.length],
    reverse: i % 2 === 1,
  }));
}
