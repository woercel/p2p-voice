import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AudioEngine } from '../../core/audio/audio-engine';
import { Settings } from '../../core/settings';

@Component({
  selector: 'app-device-settings',
  imports: [FormsModule, MatFormFieldModule, MatSelectModule, MatSlideToggleModule],
  templateUrl: './device-settings.html',
  styleUrl: './device-settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeviceSettings {
  protected readonly settings = inject(Settings);
  protected readonly audio = inject(AudioEngine);
  private readonly snackBar = inject(MatSnackBar);

  protected changeMicrophone(id: string): void {
    this.settings.microphoneId.set(id);
    this.reopen();
  }

  protected changeHeadphoneMode(enabled: boolean): void {
    this.settings.headphoneMode.set(enabled);
    this.reopen();
  }

  private reopen(): void {
    this.audio.reopenInput().catch(() =>
      this.snackBar.open(
        $localize`:@@devices.reopenFailed:Could not open the microphone.`,
        undefined,
        {
          duration: 4000,
        },
      ),
    );
  }
}
