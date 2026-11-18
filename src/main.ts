import { loadTranslations } from '@angular/localize';
import { resolveLanguage } from './app/core/i18n/language';

async function start(): Promise<void> {
  const language = resolveLanguage();
  if (language === 'de') loadTranslations((await import('./locale/de')).DE);
  document.documentElement.lang = language;

  // The app is imported only after translations are loaded so every $localize call sees them.
  const [{ bootstrapApplication }, { App }, { appConfig }] = await Promise.all([
    import('@angular/platform-browser'),
    import('./app/app'),
    import('./app/app.config'),
  ]);
  await bootstrapApplication(App, appConfig);
}

start().catch((error) => console.error(error));
