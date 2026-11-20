import {
  ChangeDetectionStrategy,
  Component,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';
import { RENDEZVOUS, Rendezvous, inviteHash, parseInvite, randomId } from '../../core/invite';
import { isLastRoom } from '../../core/last-room';
import { RoomService } from '../../core/net/room';
import { Settings } from '../../core/settings';
import { DirectLinks } from '../direct-links/direct-links';
import { Logo } from '../logo/logo';
import { RecordingSetupLauncher } from '../recording-setup/recording-setup-launcher';

type JoinError = { key: string; params?: Record<string, string> };

@Component({
  selector: 'app-lobby',
  imports: [
    FormsModule,
    MatButtonModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    TranslatePipe,
    Logo,
    DirectLinks,
  ],
  templateUrl: './lobby.html',
  styleUrl: './lobby.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Lobby {
  protected readonly settings = inject(Settings);
  private readonly room = inject(RoomService);
  private readonly parsed = parseInvite(location.hash);

  protected readonly invited = !!this.parsed.room;
  protected readonly roomName = signal(this.parsed.room ?? randomId(10));
  protected readonly password = signal(this.parsed.password ?? randomId(16));
  protected readonly via = signal<Rendezvous>(this.parsed.via ?? 'nostr');
  protected readonly joining = computed(() => this.room.status() === 'joining');
  protected readonly error = signal<JoinError | null>(null);
  protected readonly rendezvous = RENDEZVOUS;
  protected readonly setup = inject(RecordingSetupLauncher);

  constructor() {
    // A reload inside a call lands here with the same link; go straight back in.
    if (isLastRoom(this.parsed)) afterNextRender(() => void this.join());
  }

  protected async join(): Promise<void> {
    const room = this.roomName().trim();
    // The setup holds the microphone until it is closed; the room needs it for itself.
    if (!room || this.joining() || this.setup.isOpen()) return;
    const invite = { room, password: this.password(), via: this.via() };
    this.error.set(null);
    try {
      await this.room.join(invite, this.parsed.testTone);
      // Whoever joined has seen the setup hint here; it is not pushed on them later.
      this.settings.setupOffered.set(true);
      history.replaceState(null, '', `#${inviteHash(invite)}`);
    } catch (error) {
      this.error.set(joinError(error));
    }
  }
}

function joinError(error: unknown): JoinError {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return { key: 'join.micDenied' };
  }
  if (error instanceof DOMException && error.name === 'NotFoundError') {
    return { key: 'join.micMissing' };
  }
  const detail = error instanceof Error ? error.message : String(error);
  return { key: 'join.failed', params: { detail } };
}
