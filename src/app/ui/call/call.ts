import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AudioEngine } from '../../core/audio/audio-engine';
import { Channel, LOBBY, resolveChannel } from '../../core/channels/channel-state';
import { MuteHotkey } from '../../core/hotkey/mute-hotkey';
import { TranslatePipe } from '@ngx-translate/core';
import { channelName } from '../../core/i18n/labels';
import { I18n } from '../../core/i18n/language';
import { RoomService } from '../../core/net/room';
import { Settings } from '../../core/settings';
import { ConfirmData, ConfirmDialog } from '../confirm-dialog/confirm-dialog';
import { ChannelCard, ChannelView } from './channel-card/channel-card';

@Component({
  selector: 'app-call',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    TranslatePipe,
    ChannelCard,
  ],
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
  private readonly i18n = inject(I18n);

  protected readonly selfName = computed(
    () => this.settings.name().trim() || this.i18n.text('peer.anonymous'),
  );

  protected readonly muteLabel = computed(() =>
    this.i18n.text(this.audio.muted() ? 'dock.unmute' : 'dock.mute', {
      key: this.hotkey.label(),
    }),
  );

  protected readonly channels = computed<ChannelView[]>(() => {
    const state = this.room.channelState();
    const own = this.room.channel();
    const peers = this.room.roster();
    const entries: (typeof LOBBY | Channel)[] = [LOBBY, ...state.channels];
    return entries.map((channel) => {
      const id = channel === LOBBY ? LOBBY : channel.id;
      const members = peers.filter((peer) => resolveChannel(state, peer.channel) === id);
      const here = id === own;
      return {
        id,
        name: channelName(this.i18n, channel),
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
      title: this.i18n.text('call.deleteTitle', { name: channel.name }),
      message: this.i18n.text('call.deleteMessage'),
      confirm: this.i18n.text('call.deleteConfirm'),
    };
    this.dialog
      .open(ConfirmDialog, { data })
      .afterClosed()
      .subscribe((confirmed) => confirmed && this.room.deleteGroup(channel.id));
  }
}
