import {
  provideTranslateLoader,
  provideTranslateService,
  TranslateLoader,
} from '@ngx-translate/core';
import { of } from 'rxjs';
import de from '../public/i18n/de.json';
import en from '../public/i18n/en.json';

const TRANSLATIONS = { de, en };

class StaticLoader implements TranslateLoader {
  getTranslation(lang: string) {
    return of(TRANSLATIONS[lang as keyof typeof TRANSLATIONS] ?? {});
  }
}

export default [
  provideTranslateService({
    lang: 'en',
    fallbackLang: 'en',
    loader: provideTranslateLoader(StaticLoader),
  }),
];
