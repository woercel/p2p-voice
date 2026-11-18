import { DOCUMENT, Injectable, effect, inject } from '@angular/core';
import { Settings } from './settings';

@Injectable({ providedIn: 'root' })
export class Theme {
  readonly mode = inject(Settings).theme;

  constructor() {
    const root = inject(DOCUMENT).documentElement;
    effect(() => {
      const mode = this.mode();
      root.style.colorScheme = mode === 'system' ? 'light dark' : mode;
    });
  }
}
