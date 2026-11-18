import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { LevelMeter } from '../../level-meter/level-meter';

/** One person in a channel. Looks the same for yourself and everybody else. */
@Component({
  selector: 'app-member-row',
  imports: [MatIconModule, LevelMeter],
  template: `
    <span class="avatar">{{ initial() }}</span>
    <span class="name">
      {{ name() }}
      @if (self()) {
        <span class="you" i18n="@@self.youShort">you</span>
      }
    </span>
    @if (!away()) {
      <div
        class="meter"
        [appLevelMeter]="analyser()"
        [silenced]="muted()"
        [belowDb]="belowDb()"
        (speakingChange)="levelSpeaking.emit($event)"
      ></div>
    }
    <span class="status">
      @if (muted()) {
        <mat-icon>mic_off</mat-icon>
      }
    </span>
  `,
  styleUrl: './member-row.scss',
  host: {
    '[class.speaking]': 'speaking() && !away()',
    '[class.away]': 'away()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MemberRow {
  readonly name = input.required<string>();
  readonly muted = input(false);
  readonly speaking = input(false);
  readonly away = input(false);
  readonly self = input(false);
  readonly analyser = input<AnalyserNode | null>(null);
  readonly belowDb = input<number | null>(null);
  readonly levelSpeaking = output<boolean>();

  protected readonly initial = computed(() => [...this.name().trim()][0]?.toUpperCase() ?? '?');
}
