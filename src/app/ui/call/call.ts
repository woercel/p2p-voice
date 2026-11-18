import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AudioEngine } from '../../core/audio/audio-engine';
import { Channel, LOBBY, resolveChannel } from '../../core/channels/channel-state';
import { MuteHotkey } from '../../core/hotkey/mute-hotkey';
import { channelName } from '../../core/i18n/labels';
import { RoomService } from '../../core/net/room';
import { Settings } from '../../core/settings';
import { ConfirmData, ConfirmDialog } from '../confirm-dialog/confirm-dialog';
import { ChannelCard, ChannelView } from './channel-card/channel-card';

@Component({
  selector: 'app-call',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule, ChannelCard],
  templateUrl: './call.html',
  styleUrl: './call.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Call {
  protected readonly room = inject(RoomService);
  protected readonly audio = inject(AudioEngine);
  protected readonly hotkey = inject(MuteHotkey);
  private readonly settings = inject(Settings);
  private readonly dialog = inject(MatDialog);

  protected readonly selfName = computed(
    () => this.settings.name().trim() || $localize`:@@peer.anonymous:Anonymous`,
  );

  protected readonly muteLabel = computed(() => {
    const key = this.hotkey.label();
    return this.audio.muted()
      ? $localize`:@@dock.unmute:Unmute (${key}:key:)`
      : $localize`:@@dock.mute:Mute (${key}:key:)`;
  });

  protected readonly channels = computed<ChannelView[]>(() => {
    const state = this.room.channelState();
    const own = this.room.channel();
    const peers = this.room.peerList();
    const entries: (typeof LOBBY | Channel)[] = [LOBBY, ...state.channels];
    return entries.map((channel) => {
      const id = channel === LOBBY ? LOBBY : channel.id;
      const members = peers.filter((peer) => resolveChannel(state, peer.channel) === id);
      const here = id === own;
      return {
        id,
        name: channelName(channel),
        members,
        here,
        count: members.length + (here ? 1 : 0),
        deletable: id !== LOBBY,
      };
    });
  });

  protected toggleMute(): void {
    this.audio.muted.update((muted) => !muted);
  }

  protected deleteGroup(channel: ChannelView): void {
    if (channel.count === 0) {
      this.room.deleteGroup(channel.id);
      return;
    }
    const data: ConfirmData = {
      title: $localize`:@@call.deleteTitle:Delete ${channel.name}:name:?`,
      message: $localize`:@@call.deleteMessage:Everyone in it moves back to the lobby.`,
      confirm: $localize`:@@call.deleteConfirm:Delete`,
    };
    this.dialog
      .open(ConfirmDialog, { data })
      .afterClosed()
      .subscribe((confirmed) => confirmed && this.room.deleteGroup(channel.id));
  }
}
