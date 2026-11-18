import { Channel, LOBBY } from '../channels/channel-state';
import { KeyLabels } from '../hotkey/key-binding';

export const keyLabels = (): KeyLabels => ({
  ctrl: $localize`:@@key.ctrl:Ctrl`,
  alt: $localize`:@@key.alt:Alt`,
  altGr: $localize`:@@key.altGr:AltGr`,
  shift: $localize`:@@key.shift:Shift`,
  meta: $localize`:@@key.meta:Win`,
  space: $localize`:@@key.space:Space`,
  left: $localize`:@@key.left:left`,
  right: $localize`:@@key.right:right`,
  numpad: $localize`:@@key.numpad:Num`,
});

export function channelName(channel: Channel | typeof LOBBY): string {
  return channel === LOBBY
    ? $localize`:@@channel.lobby:Lobby`
    : $localize`:@@channel.group:Group ${channel.number}:number:`;
}
