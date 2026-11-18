import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  afterNextRender,
  computed,
  inject,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MuteHotkey } from './core/hotkey/mute-hotkey';
import { Language, currentLanguage, switchLanguage } from './core/i18n/language';
import { RoomService } from './core/net/room';
import { ThemeMode } from './core/settings';
import { Theme } from './core/theme';
import { Call } from './ui/call/call';
import { Lobby } from './ui/lobby/lobby';
import { Logo } from './ui/logo/logo';

const SPLASH_MIN_MS = 900;
const SPLASH_FADE_MS = 400;

@Component({
  selector: 'app-root',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatToolbarModule,
    MatTooltipModule,
    Call,
    Lobby,
    Logo,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly room = inject(RoomService);
  protected readonly theme = inject(Theme);
  protected readonly language = currentLanguage();

  protected readonly languages: { value: Language; label: string }[] = [
    { value: 'de', label: 'Deutsch' },
    { value: 'en', label: 'English' },
  ];

  protected readonly themes: { value: ThemeMode; icon: string; label: string }[] = [
    { value: 'system', icon: 'brightness_auto', label: $localize`:@@theme.system:System` },
    { value: 'light', icon: 'light_mode', label: $localize`:@@theme.light:Light` },
    { value: 'dark', icon: 'dark_mode', label: $localize`:@@theme.dark:Dark` },
  ];

  protected readonly themeIcon = computed(
    () => this.themes.find((t) => t.value === this.theme.mode())?.icon ?? 'brightness_auto',
  );

  constructor() {
    inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-outlined');
    inject(MuteHotkey);

    const document = inject(DOCUMENT);
    afterNextRender(() => {
      const splash = document.getElementById('splash');
      if (!splash) return;
      setTimeout(
        () => {
          splash.classList.add('done');
          setTimeout(() => splash.remove(), SPLASH_FADE_MS);
        },
        Math.max(0, SPLASH_MIN_MS - performance.now()),
      );
    });
  }

  protected switchLanguage(language: Language): void {
    if (language !== this.language) switchLanguage(language);
  }
}
