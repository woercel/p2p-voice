import { Invite } from './invite';
import { readStored, removeStored, writeStored } from './storage';

const KEY = 'lastRoom';

/** Remembered while you are in a room, so a reload can bring you straight back. */
export function rememberRoom(invite: Invite): void {
  writeStored(KEY, invite);
}

/** Leaving on purpose means the next reload should stay in the lobby. */
export function forgetRoom(): void {
  removeStored(KEY);
}

/** True when the link points at the room this browser was in before the reload. */
export function isLastRoom(invite: Partial<Invite>): boolean {
  const last = readStored<Partial<Invite> | null>(KEY, null);
  return (
    !!invite.room &&
    !!last &&
    last.room === invite.room &&
    last.password === invite.password &&
    last.via === invite.via
  );
}
