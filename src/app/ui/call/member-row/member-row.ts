import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { avatarUri } from '../../../core/avatar';
import { LevelMeter } from '../../level-meter/level-meter';

/** One person in a channel. Looks the same for yourself and everybody else. */
@Component({
  selector: 'app-member-row',
  imports: [MatIconModule, TranslatePipe, LevelMeter],
  template: `
    <img class="avatar" [src]="avatar()" alt="" />
    <span class="name">
      {{ name() }}
      @if (self()) {
        <span class="you">{{ 'self.youShort' | translate }}</span>
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

  protected readonly avatar = computed(() => avatarUri(this.name().trim()));
}
