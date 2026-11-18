import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-logo',
  template: `
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <rect class="tile" width="48" height="48" rx="14" />
      @for (bar of bars; track bar.x) {
        <rect
          class="bar"
          [attr.x]="bar.x"
          y="10"
          width="4"
          height="28"
          rx="2"
          [style.--scale]="bar.scale"
          [style.animation-delay.ms]="bar.delay"
        />
      }
    </svg>
  `,
  styleUrl: './logo.scss',
  host: { '[class.animated]': 'animated()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Logo {
  readonly animated = input(false);

  protected readonly bars = [
    { x: 9, scale: 0.35, delay: 0 },
    { x: 15.5, scale: 0.7, delay: 120 },
    { x: 22, scale: 1, delay: 240 },
    { x: 28.5, scale: 0.7, delay: 360 },
    { x: 35, scale: 0.35, delay: 480 },
  ];
}
