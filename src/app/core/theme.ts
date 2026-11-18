import { DOCUMENT, Injectable, effect, inject } from '@angular/core';
import { Settings } from './settings';

@Injectable({ providedIn: 'root' })
export class Theme {
  readonly mode = inject(Settings).theme;

  constructor() {
    const document = inject(DOCUMENT);
    const root = document.documentElement;
    effect(() => {
      const mode = this.mode();
      // Suppress color transitions so the whole page switches in one frame.
      root.classList.add('theme-switching');
      root.style.colorScheme = mode === 'system' ? 'light dark' : mode;
      void root.offsetHeight;
      requestAnimationFrame(() => root.classList.remove('theme-switching'));
    });
  }
}
