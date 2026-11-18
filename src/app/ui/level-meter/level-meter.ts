import {
  DestroyRef,
  Directive,
  ElementRef,
  afterNextRender,
  inject,
  input,
  output,
} from '@angular/core';
import { SPEAKING_DB, SPEAKING_HOLD_MS, analyserDb, meterPercent } from '../../core/audio/levels';

/**
 * Renders the level at display refresh rate by writing to the DOM directly, outside change
 * detection. Only transitions of the speaking state are reported back to Angular.
 */
@Directive({
  selector: '[appLevelMeter]',
  host: { class: 'level-meter' },
})
export class LevelMeter {
  readonly analyser = input<AnalyserNode | null>(null, { alias: 'appLevelMeter' });
  readonly silenced = input(false);
  readonly belowDb = input<number | null>(null);
  readonly speakingChange = output<boolean>();

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const fill = host.ownerDocument.createElement('div');
    fill.className = 'level-meter-fill';
    host.prepend(fill);

    const buffer = new Float32Array(2048);
    let frame = 0;
    let speakingUntil = 0;
    let speaking = false;

    const tick = (now: number) => {
      const analyser = this.analyser();
      const db = analyser && !this.silenced() ? analyserDb(analyser, buffer) : -Infinity;
      const below = this.belowDb();
      fill.style.width = `${meterPercent(db)}%`;
      fill.classList.toggle('below', below !== null && db < below);

      if (db > SPEAKING_DB) speakingUntil = now + SPEAKING_HOLD_MS;
      if (now < speakingUntil !== speaking) {
        speaking = !speaking;
        this.speakingChange.emit(speaking);
      }
      frame = requestAnimationFrame(tick);
    };

    afterNextRender(() => (frame = requestAnimationFrame(tick)));
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(frame));
  }
}
