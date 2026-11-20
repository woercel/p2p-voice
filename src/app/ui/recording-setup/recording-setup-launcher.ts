import { Injectable, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { AudioEngine } from '../../core/audio/audio-engine';
import { I18n } from '../../core/i18n/language';
import { parseInvite } from '../../core/invite';
import { RoomService } from '../../core/net/room';

/**
 * Opens the recording setup; a second request while it is open does nothing. Outside a call
 * the microphone is opened just for the setup and closed again afterwards. The dialog is
 * loaded on first use, it is not needed to get into a call.
 */
@Injectable({ providedIn: 'root' })
export class RecordingSetupLauncher {
  private readonly dialog = inject(MatDialog);
  private readonly audio = inject(AudioEngine);
  private readonly room = inject(RoomService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly i18n = inject(I18n);

  /** Stays true until a microphone opened only for the setup is closed again. */
  readonly isOpen = signal(false);

  async open(): Promise<void> {
    if (this.isOpen()) return;
    this.isOpen.set(true);
    const ownEngine = this.room.status() === 'idle';
    try {
      const { RecordingSetup } = await import('./recording-setup');
      if (ownEngine) await this.audio.start(parseInvite(location.hash).testTone);
      const ref = this.dialog.open(RecordingSetup, {
        width: '480px',
        maxWidth: 'calc(100vw - 32px)',
        autoFocus: 'dialog',
      });
      await firstValueFrom(ref.afterClosed());
    } catch (error) {
      this.snackBar.open(this.i18n.text(microphoneError(error)), undefined, { duration: 4000 });
    } finally {
      if (ownEngine) await this.audio.stop();
      this.isOpen.set(false);
    }
  }
}

function microphoneError(error: unknown): string {
  const name = (error as { name?: unknown } | null)?.name;
  if (name === 'NotAllowedError') return 'join.micDenied';
  if (name === 'NotFoundError') return 'join.micMissing';
  return 'devices.reopenFailed';
}
