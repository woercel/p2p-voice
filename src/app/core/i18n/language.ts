import { DOCUMENT, Injectable, computed, inject } from '@angular/core';
import { InterpolationParameters, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { readStored, writeStored } from '../storage';

export type Language = 'de' | 'en';

export const LANGUAGES: readonly Language[] = ['de', 'en'];

export function resolveLanguage(): Language {
  const stored = readStored<string | null>('language', null);
  if (stored && LANGUAGES.includes(stored as Language)) return stored as Language;
  return navigator.languages.some((l) => l.toLowerCase().startsWith('de')) ? 'de' : 'en';
}

@Injectable({ providedIn: 'root' })
export class I18n {
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);

  readonly language = computed<Language>(() =>
    this.translate.currentLang() === 'de' ? 'de' : 'en',
  );

  /** Reads the current language, so computed texts follow a switch. */
  text(key: string, params?: InterpolationParameters): string {
    this.language();
    return String(this.translate.instant(key, params));
  }

  async use(language: Language): Promise<void> {
    await firstValueFrom(this.translate.use(language));
    this.document.documentElement.lang = language;
  }

  async switch(language: Language): Promise<void> {
    writeStored('language', language);
    await this.use(language);
  }
}
