import {
  ChannelState,
  EMPTY_CHANNEL_STATE,
  LOBBY,
  applyChannelMessage,
  newChannel,
  resolveChannel,
  snapshot,
} from './channel-state';

const group = (id: string, number: number, createdAt = number) => ({ id, number, createdAt });

describe('channel state', () => {
  it('creates channels sorted by creation time and ignores duplicates', () => {
    let state = applyChannelMessage(EMPTY_CHANNEL_STATE, {
      op: 'create',
      channel: group('b', 2, 20),
    });
    state = applyChannelMessage(state, { op: 'create', channel: group('a', 1, 10) });
    state = applyChannelMessage(state, { op: 'create', channel: group('a', 1, 10) });
    expect(state.channels.map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('never resurrects deleted channels', () => {
    let state = applyChannelMessage(EMPTY_CHANNEL_STATE, { op: 'create', channel: group('a', 1) });
    state = applyChannelMessage(state, { op: 'delete', id: 'a' });
    state = applyChannelMessage(state, { op: 'create', channel: group('a', 1) });
    expect(state.channels).toEqual([]);
    expect(state.deleted).toEqual(['a']);
  });

  it('merges a sync snapshot, applying deletions first', () => {
    const local: ChannelState = { channels: [group('a', 1), group('b', 2)], deleted: [] };
    const remote = snapshot({ channels: [group('c', 3)], deleted: ['a'] });
    const merged = applyChannelMessage(local, remote);
    expect(merged.channels.map((c) => c.id)).toEqual(['b', 'c']);
    expect(merged.deleted).toEqual(['a']);
  });

  it('rejects malformed input and the lobby id', () => {
    const inputs: unknown[] = [
      null,
      'nope',
      { op: 'create', channel: { id: LOBBY, number: 1, createdAt: 0 } },
      { op: 'create', channel: { id: 'x', number: 0, createdAt: 0 } },
      { op: 'create', channel: { id: 42, number: 1, createdAt: 0 } },
      { op: 'delete', id: LOBBY },
      { op: 'unknown' },
    ];
    for (const input of inputs) {
      expect(applyChannelMessage(EMPTY_CHANNEL_STATE, input)).toBe(EMPTY_CHANNEL_STATE);
    }
  });

  it('numbers new groups after the highest existing one', () => {
    const state: ChannelState = { channels: [group('a', 1), group('b', 4)], deleted: [] };
    expect(newChannel(state, 'c', 99)).toEqual({ id: 'c', number: 5, createdAt: 99 });
    expect(newChannel(EMPTY_CHANNEL_STATE, 'd', 1).number).toBe(1);
  });

  it('resolves unknown or deleted channels to the lobby', () => {
    const state: ChannelState = { channels: [group('a', 1)], deleted: ['b'] };
    expect(resolveChannel(state, 'a')).toBe('a');
    expect(resolveChannel(state, 'b')).toBe(LOBBY);
    expect(resolveChannel(state, undefined)).toBe(LOBBY);
  });
});
