import { readStored, writeStored } from '../storage';

export type Language = 'de' | 'en';

export const LANGUAGES: readonly Language[] = ['de', 'en'];

export function resolveLanguage(): Language {
  const stored = readStored<string | null>('language', null);
  if (stored && LANGUAGES.includes(stored as Language)) return stored as Language;
  return navigator.languages.some((l) => l.toLowerCase().startsWith('de')) ? 'de' : 'en';
}

export const currentLanguage = (): Language =>
  document.documentElement.lang === 'de' ? 'de' : 'en';

/** Translations are applied before bootstrap, so switching needs a reload (the invite hash survives). */
export function switchLanguage(language: Language): void {
  writeStored('language', language);
  location.reload();
}
