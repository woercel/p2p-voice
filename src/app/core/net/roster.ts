/** A peer someone else in the room is already connected to. */
export type RosterEntry = { id: string; name: string; muted: boolean; channel: string };

/**
 * Someone we are connecting to: either named in another peer's roster, or `lost` because our
 * connection dropped without a goodbye. Given up on once `until` passes.
 */
export type ExpectedPeer = RosterEntry & { volume: number; lost: boolean; until: number };

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
  until: number,
): ReadonlyMap<string, ExpectedPeer> {
  if (!Array.isArray(roster)) return expected;
  const next = new Map(expected);
  for (const entry of roster.slice(0, 64)) {
    const peer = readEntry(entry);
    if (!peer || connected.has(peer.id) || next.has(peer.id)) continue;
    next.set(peer.id, { ...peer, volume: 100, lost: false, until });
  }
  return next.size === expected.size ? expected : next;
}

/** Splits off the peers whose time is up. */
export function dropStale(
  expected: ReadonlyMap<string, ExpectedPeer>,
  now: number,
): { kept: ReadonlyMap<string, ExpectedPeer>; gone: ExpectedPeer[] } {
  const gone = [...expected.values()].filter((peer) => peer.until <= now);
  if (!gone.length) return { kept: expected, gone };
  return { kept: new Map([...expected].filter(([, peer]) => peer.until > now)), gone };
}

/**
 * A reloaded page joins under a new peer id. If its goodbye got lost on the way, the old id
 * still waits as `lost`; the same name turning up again is taken to be the same person.
 */
export function lostTwin(
  expected: ReadonlyMap<string, ExpectedPeer>,
  name: string,
): ExpectedPeer | undefined {
  return [...expected.values()].find((peer) => peer.lost && peer.name === name);
}

function readEntry(entry: unknown): RosterEntry | null {
  if (!entry || typeof entry !== 'object') return null;
  const { id, name, muted, channel } = entry as Record<string, unknown>;
  if (typeof id !== 'string' || !id || typeof name !== 'string' || typeof channel !== 'string') {
    return null;
  }
  return { id, name: name.slice(0, 32), muted: Boolean(muted), channel };
}
