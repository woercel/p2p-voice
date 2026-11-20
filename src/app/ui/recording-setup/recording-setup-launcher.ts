import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';

/**
 * Opens the recording setup; a second request while it is open or loading does nothing.
 * The dialog is loaded on first use, it is not needed to get into a call.
 */
@Injectable({ providedIn: 'root' })
export class RecordingSetupLauncher {
  private readonly dialog = inject(MatDialog);
  private busy = false;

  async open(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const { RecordingSetup } = await import('./recording-setup');
      const ref = this.dialog.open(RecordingSetup, {
        width: '480px',
        maxWidth: 'calc(100vw - 32px)',
        autoFocus: 'dialog',
      });
      ref.afterClosed().subscribe(() => (this.busy = false));
    } catch (error) {
      this.busy = false;
      throw error;
    }
  }
}
