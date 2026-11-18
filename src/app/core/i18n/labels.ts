import { Channel, LOBBY } from '../channels/channel-state';
import { KeyLabels } from '../hotkey/key-binding';
import { I18n } from './language';

export const keyLabels = (i18n: I18n): KeyLabels => ({
  ctrl: i18n.text('key.ctrl'),
  alt: i18n.text('key.alt'),
  altGr: i18n.text('key.altGr'),
  shift: i18n.text('key.shift'),
  meta: i18n.text('key.meta'),
  space: i18n.text('key.space'),
  left: i18n.text('key.left'),
  right: i18n.text('key.right'),
  numpad: i18n.text('key.numpad'),
});

export function channelName(i18n: I18n, channel: Channel | typeof LOBBY): string {
  return channel === LOBBY
    ? i18n.text('channel.lobby')
    : i18n.text('channel.group', { number: channel.number });
}
