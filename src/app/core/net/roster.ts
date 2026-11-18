/** A peer someone else in the room is already connected to. */
export type RosterEntry = { id: string; name: string; muted: boolean; channel: string };

/** Someone we were told about and are still connecting to, with the time we heard of them. */
export type ExpectedPeer = RosterEntry & { since: number };

type Known = { id: string; name: string | null; muted: boolean; channel: string };

/** What a newcomer needs to know about who else is here: everyone we know by name, but them. */
export function rosterFor(peers: Iterable<Known>, newcomer: string): RosterEntry[] {
  const roster: RosterEntry[] = [];
  for (const { id, name, muted, channel } of peers) {
    if (id !== newcomer && name !== null) roster.push({ id, name, muted, channel });
  }
  return roster;
}

/** Adds the peers a roster names that we are not connected to yet. The roster is untrusted. */
export function expectFrom(
  expected: ReadonlyMap<string, ExpectedPeer>,
  roster: unknown,
  connected: ReadonlyMap<string, unknown>,
  now: number,
): ReadonlyMap<string, ExpectedPeer> {
  if (!Array.isArray(roster)) return expected;
  const next = new Map(expected);
  for (const entry of roster.slice(0, 64)) {
    const peer = readEntry(entry);
    if (!peer || connected.has(peer.id) || next.has(peer.id)) continue;
    next.set(peer.id, { ...peer, since: now });
  }
  return next.size === expected.size ? expected : next;
}

/** Peers that never connect (they left, or no route between us) stop showing up after a while. */
export function dropStale(
  expected: ReadonlyMap<string, ExpectedPeer>,
  now: number,
  maxAgeMs: number,
): ReadonlyMap<string, ExpectedPeer> {
  const next = new Map([...expected].filter(([, peer]) => now - peer.since < maxAgeMs));
  return next.size === expected.size ? expected : next;
}

function readEntry(entry: unknown): RosterEntry | null {
  if (!entry || typeof entry !== 'object') return null;
  const { id, name, muted, channel } = entry as Record<string, unknown>;
  if (typeof id !== 'string' || !id || typeof name !== 'string' || typeof channel !== 'string') {
    return null;
  }
  return { id, name: name.slice(0, 32), muted: Boolean(muted), channel };
}
