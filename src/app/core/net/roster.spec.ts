import { ExpectedPeer, dropStale, expectFrom, lostTwin, rosterFor } from './roster';

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
    expect([...expected.values()]).toEqual([{ ...bob, volume: 100, lost: false, until: 100 }]);
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

  it('gives up on peers once their time is up', () => {
    const expected = expectFrom(new Map(), [alice], new Map(), 5000);
    expect(dropStale(expected, 1000)).toEqual({ kept: expected, gone: [] });
    const { kept, gone } = dropStale(expected, 5000);
    expect(kept.size).toBe(0);
    expect(gone.map((peer) => peer.id)).toEqual(['a']);
  });

  it('matches a reloaded page to the peer that dropped under the same name', () => {
    const dropped: ExpectedPeer = { ...alice, volume: 150, lost: true, until: 1 };
    const announced: ExpectedPeer = { ...bob, volume: 100, lost: false, until: 1 };
    const expected = new Map([
      ['a', dropped],
      ['b', announced],
    ]);
    expect(lostTwin(expected, 'Alice')).toBe(dropped);
    expect(lostTwin(expected, 'Bob')).toBeUndefined();
  });
});
