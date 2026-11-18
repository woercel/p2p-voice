export const LOBBY = 'lobby' as const;

export type Channel = { id: string; number: number; createdAt: number };

export type ChannelState = { channels: Channel[]; deleted: string[] };

export type ChannelMessage =
  | { op: 'create'; channel: Channel }
  | { op: 'delete'; id: string }
  | { op: 'sync'; channels: Channel[]; deleted: string[] };

export const EMPTY_CHANNEL_STATE: ChannelState = { channels: [], deleted: [] };

const MAX_ID_LENGTH = 40;

function sanitizeId(value: unknown): string | null {
  return typeof value === 'string' && value && value !== LOBBY
    ? value.slice(0, MAX_ID_LENGTH)
    : null;
}

export function sanitizeChannel(value: unknown): Channel | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<Channel>;
  const id = sanitizeId(candidate.id);
  const number = Math.trunc(Number(candidate.number));
  if (!id || !(number >= 1 && number <= 999)) return null;
  const createdAt = Number(candidate.createdAt);
  return { id, number, createdAt: Number.isFinite(createdAt) ? createdAt : Date.now() };
}

const byCreation = (a: Channel, b: Channel) =>
  a.createdAt - b.createdAt || a.id.localeCompare(b.id);

function addChannel(state: ChannelState, raw: unknown): ChannelState {
  const channel = sanitizeChannel(raw);
  if (!channel || state.deleted.includes(channel.id)) return state;
  if (state.channels.some((c) => c.id === channel.id)) return state;
  return { ...state, channels: [...state.channels, channel].sort(byCreation) };
}

function deleteChannel(state: ChannelState, raw: unknown): ChannelState {
  const id = sanitizeId(raw);
  if (!id || state.deleted.includes(id)) return state;
  return {
    channels: state.channels.filter((c) => c.id !== id),
    deleted: [...state.deleted, id],
  };
}

export function applyChannelMessage(state: ChannelState, message: unknown): ChannelState {
  if (!message || typeof message !== 'object') return state;
  const msg = message as Partial<Record<string, unknown>>;
  switch (msg['op']) {
    case 'create':
      return addChannel(state, msg['channel']);
    case 'delete':
      return deleteChannel(state, msg['id']);
    case 'sync': {
      const deleted = Array.isArray(msg['deleted']) ? msg['deleted'] : [];
      const channels = Array.isArray(msg['channels']) ? msg['channels'] : [];
      const afterDeletes = deleted.reduce<ChannelState>(deleteChannel, state);
      return channels.reduce<ChannelState>(addChannel, afterDeletes);
    }
    default:
      return state;
  }
}

export function newChannel(state: ChannelState, id: string, now: number): Channel {
  const highest = numbered(state).reduce((max, c) => Math.max(max, c.number), 0);
  return { id, number: highest + 1, createdAt: now };
}

/**
 * The channels with the numbers to show. Two peers creating a channel at the same moment both
 * pick the same number; the older channel keeps it and the newer one moves up to the next free
 * number. Only the requested numbers go into the result, so every peer arrives at the same
 * numbering whatever order the channels reached it in.
 */
export function numbered(state: ChannelState): Channel[] {
  const taken = new Set<number>();
  return state.channels.map((channel) => {
    let number = channel.number;
    while (taken.has(number)) number++;
    taken.add(number);
    return number === channel.number ? channel : { ...channel, number };
  });
}

export function snapshot(state: ChannelState): ChannelMessage {
  return { op: 'sync', channels: [...state.channels], deleted: [...state.deleted] };
}

export function resolveChannel(state: ChannelState, id: string | undefined): string {
  return id && state.channels.some((c) => c.id === id) ? id : LOBBY;
}
