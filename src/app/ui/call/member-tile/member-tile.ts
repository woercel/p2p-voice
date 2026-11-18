import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { LevelMeter } from '../../level-meter/level-meter';

/** One person in a channel. Looks the same for yourself and everybody else. */
@Component({
  selector: 'app-member-tile',
  imports: [MatIconModule, LevelMeter],
  template: `
    <span class="avatar">{{ initial() }}</span>
    <span class="name">{{ name() }}</span>
    @if (self()) {
      <span class="you" i18n="@@self.youShort">you</span>
    }
    @if (muted()) {
      <mat-icon class="muted">mic_off</mat-icon>
    }
    <div
      class="meter"
      [appLevelMeter]="away() ? null : analyser()"
      [silenced]="muted()"
      (speakingChange)="levelSpeaking.emit($event)"
    ></div>
  `,
  styleUrl: './member-tile.scss',
  host: {
    '[class.speaking]': 'speaking() && !away()',
    '[class.away]': 'away()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MemberTile {
  readonly name = input.required<string>();
  readonly muted = input(false);
  readonly speaking = input(false);
  readonly away = input(false);
  readonly self = input(false);
  readonly analyser = input<AnalyserNode | null>(null);
  readonly levelSpeaking = output<boolean>();

  protected readonly initial = computed(() => [...this.name().trim()][0]?.toUpperCase() ?? '?');
}
