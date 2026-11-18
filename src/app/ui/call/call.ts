import { Clipboard } from '@angular/cdk/clipboard';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Channel, LOBBY, resolveChannel } from '../../core/channels/channel-state';
import { channelName } from '../../core/i18n/labels';
import { inviteHash } from '../../core/invite';
import { RoomService } from '../../core/net/room';
import { Settings } from '../../core/settings';
import { ConfirmData, ConfirmDialog } from '../confirm-dialog/confirm-dialog';
import { DeviceSettings } from '../device-settings/device-settings';
import { ChannelCard, ChannelView } from './channel-card/channel-card';
import { SelfPanel } from './self-panel/self-panel';

@Component({
  selector: 'app-call',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule,
    ChannelCard,
    DeviceSettings,
    SelfPanel,
  ],
  templateUrl: './call.html',
  styleUrl: './call.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Call {
  protected readonly room = inject(RoomService);
  private readonly settings = inject(Settings);
  private readonly clipboard = inject(Clipboard);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  protected readonly inviteLink = computed(() => {
    const invite = this.room.invite();
    return invite ? `${location.origin}${location.pathname}#${inviteHash(invite)}` : '';
  });

  protected readonly selfName = computed(
    () => this.settings.name().trim() || $localize`:@@peer.anonymous:Anonymous`,
  );

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

  protected copyInvite(): void {
    this.clipboard.copy(this.inviteLink());
    this.snackBar.open($localize`:@@call.copied:Invite link copied`, undefined, { duration: 2000 });
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
