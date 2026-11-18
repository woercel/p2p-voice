import { ExpectedPeer, dropStale, expectFrom, rosterFor } from './roster';

describe('roster', () => {
  const alice = { id: 'a', name: 'Alice', muted: false, channel: 'lobby' };
  const bob = { id: 'b', name: 'Bob', muted: true, channel: 'g1' };

  it('tells a newcomer about everyone known by name except themselves', () => {
    const peers = [alice, bob, { id: 'c', name: null, muted: false, channel: 'lobby' }];
    expect(rosterFor(peers, 'b')).toEqual([alice]);
  });

  it('expects only peers that are not connected yet', () => {
    const connected = new Map([['a', {}]]);
    const expected = expectFrom(new Map(), [alice, bob], connected, 100);
    expect([...expected.values()]).toEqual([{ ...bob, since: 100 }]);
  });

  it('ignores malformed rosters and entries', () => {
    const empty = new Map<string, ExpectedPeer>();
    expect(expectFrom(empty, 'nope', new Map(), 0)).toBe(empty);
    const expected = expectFrom(
      empty,
      [null, { id: 'x' }, { ...alice, name: 'A'.repeat(99) }],
      new Map(),
      0,
    );
    expect([...expected.keys()]).toEqual(['a']);
    expect(expected.get('a')?.name).toHaveLength(32);
  });

  it('gives up on peers that never connect', () => {
    const expected = expectFrom(new Map(), [alice], new Map(), 0);
    expect(dropStale(expected, 1000, 5000)).toBe(expected);
    expect(dropStale(expected, 5000, 5000).size).toBe(0);
  });
});
