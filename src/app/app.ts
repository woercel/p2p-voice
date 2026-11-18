import { Clipboard } from '@angular/cdk/clipboard';
import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  afterNextRender,
  computed,
  effect,
  signal,
  inject,
  untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';
import { AudioEngine } from './core/audio/audio-engine';
import { MuteHotkey } from './core/hotkey/mute-hotkey';
import { I18n } from './core/i18n/language';
import { inviteHash } from './core/invite';
import { RoomService } from './core/net/room';
import { Theme } from './core/theme';
import { Call } from './ui/call/call';
import { Lobby } from './ui/lobby/lobby';
import { Logo } from './ui/logo/logo';
import { SettingsPanel } from './ui/settings-panel/settings-panel';

const SPLASH_MIN_MS = 900;
const SPLASH_FADE_MS = 400;

@Component({
  selector: 'app-root',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatSidenavModule,
    MatTooltipModule,
    TranslatePipe,
    Call,
    Lobby,
    Logo,
    SettingsPanel,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly room = inject(RoomService);
  private readonly clipboard = inject(Clipboard);
  private readonly snackBar = inject(MatSnackBar);
  private readonly i18n = inject(I18n);

  protected readonly scrolled = signal(false);

  /** Everyone in the room, us included. */
  protected readonly peopleCount = computed(() => this.room.roster().length + 1);
  protected readonly healthLabel = computed(() =>
    this.i18n.text(`toolbar.health.${this.room.health()}`),
  );

  protected readonly inviteLink = computed(() => {
    const invite = this.room.invite();
    return invite ? `${location.origin}${location.pathname}#${inviteHash(invite)}` : '';
  });

  constructor() {
    inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-outlined');
    inject(MuteHotkey);
    inject(Theme);

    const audio = inject(AudioEngine);
    let soundHint: MatSnackBarRef<TextOnlySnackBar> | null = null;
    effect(() => {
      const blocked = this.room.status() === 'joined' && audio.soundBlocked();
      untracked(() => {
        if (blocked) {
          // Any click resumes audio, the button just gives that click an obvious place.
          soundHint = this.snackBar.open(
            this.i18n.text('call.soundBlocked'),
            this.i18n.text('call.soundOn'),
          );
        } else {
          soundHint?.dismiss();
          soundHint = null;
        }
      });
    });

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

  protected copyInvite(): void {
    this.clipboard.copy(this.inviteLink());
    this.snackBar.open(this.i18n.text('call.copied'), undefined, { duration: 2000 });
  }

  protected onScroll(event: Event): void {
    this.scrolled.set((event.target as HTMLElement).scrollTop > 0);
  }
}
