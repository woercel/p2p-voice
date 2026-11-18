import { Clipboard } from '@angular/cdk/clipboard';
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
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MuteHotkey } from './core/hotkey/mute-hotkey';
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

  protected readonly inviteLink = computed(() => {
    const invite = this.room.invite();
    return invite ? `${location.origin}${location.pathname}#${inviteHash(invite)}` : '';
  });

  constructor() {
    inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-outlined');
    inject(MuteHotkey);
    inject(Theme);

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
    this.snackBar.open($localize`:@@call.copied:Invite link copied`, undefined, { duration: 2000 });
  }
}
