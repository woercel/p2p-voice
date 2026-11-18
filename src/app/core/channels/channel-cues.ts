import type { Cue } from '../audio/cues';

/** Who is in your channel, among peers whose channel is already known. */
export type ChannelPresence = {
  channel: string;
  members: ReadonlySet<string>;
  placed: ReadonlySet<string>;
};

/**
 * Chime for moves between channels. Peers appearing or vanishing from the room entirely
 * are left out here, because the room join/leave chime already covers them.
 */
export function channelCue(previous: ChannelPresence | null, next: ChannelPresence): Cue | null {
  if (!previous) return null;
  if (previous.channel !== next.channel) return 'join';

  const entered = [...next.members].some(
    (id) => !previous.members.has(id) && previous.placed.has(id),
  );
  if (entered) return 'join';

  const left = [...previous.members].some((id) => !next.members.has(id) && next.placed.has(id));
  return left ? 'leave' : null;
}
