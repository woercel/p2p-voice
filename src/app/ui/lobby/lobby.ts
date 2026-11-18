import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { RENDEZVOUS, Rendezvous, inviteHash, parseInvite, randomId } from '../../core/invite';
import { RoomService } from '../../core/net/room';
import { Settings } from '../../core/settings';
import { Logo } from '../logo/logo';

@Component({
  selector: 'app-lobby',
  imports: [
    FormsModule,
    MatButtonModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    Logo,
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
  protected readonly error = signal<string | null>(null);

  protected readonly rendezvous = RENDEZVOUS.map((value) => ({
    value,
    label: rendezvousLabel(value),
  }));

  protected async join(): Promise<void> {
    const room = this.roomName().trim();
    if (!room || this.joining()) return;
    const invite = { room, password: this.password(), via: this.via() };
    this.error.set(null);
    try {
      await this.room.join(invite, this.parsed.testTone);
      history.replaceState(null, '', `#${inviteHash(invite)}`);
    } catch (error) {
      this.error.set(joinErrorMessage(error));
    }
  }
}

function rendezvousLabel(rendezvous: Rendezvous): string {
  switch (rendezvous) {
    case 'nostr':
      return $localize`:@@rendezvous.nostr:Nostr relays`;
    case 'torrent':
      return $localize`:@@rendezvous.torrent:BitTorrent trackers`;
    case 'mqtt':
      return $localize`:@@rendezvous.mqtt:MQTT brokers`;
  }
}

function joinErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return $localize`:@@join.micDenied:Microphone access was denied.`;
  }
  if (error instanceof DOMException && error.name === 'NotFoundError') {
    return $localize`:@@join.micMissing:No microphone found.`;
  }
  const detail = error instanceof Error ? error.message : String(error);
  return $localize`:@@join.failed:Could not join: ${detail}:detail:`;
}
