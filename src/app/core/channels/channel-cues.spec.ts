import { ChannelPresence, channelCue } from './channel-cues';

const presence = (channel: string, members: string[], placed: string[]): ChannelPresence => ({
  channel,
  members: new Set(members),
  placed: new Set(placed),
});

describe('channelCue', () => {
  it('stays quiet for the first snapshot', () => {
    expect(channelCue(null, presence('lobby', ['a'], ['a']))).toBeNull();
  });

  it('chimes when you switch channels yourself', () => {
    expect(channelCue(presence('lobby', ['a'], ['a']), presence('g1', [], ['a']))).toBe('join');
  });

  it('chimes when someone moves into or out of your channel', () => {
    const before = presence('lobby', ['a'], ['a', 'b']);
    expect(channelCue(before, presence('lobby', ['a', 'b'], ['a', 'b']))).toBe('join');
    expect(channelCue(before, presence('lobby', [], ['a', 'b']))).toBe('leave');
  });

  it('leaves room arrivals and departures to the room chime', () => {
    const before = presence('lobby', ['a'], ['a']);
    expect(channelCue(before, presence('lobby', ['a', 'b'], ['a', 'b']))).toBeNull();
    expect(channelCue(before, presence('lobby', [], []))).toBeNull();
  });
});
