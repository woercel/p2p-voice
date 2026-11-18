export type Rendezvous = 'nostr' | 'torrent' | 'mqtt';

export const RENDEZVOUS: readonly Rendezvous[] = ['nostr', 'torrent', 'mqtt'];

export type Invite = { room: string; password: string; via: Rendezvous };

export type ParsedInvite = Partial<Invite> & { testTone: boolean };

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function randomId(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

export function parseInvite(hash: string): ParsedInvite {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const via = params.get('v');
  return {
    room: params.get('r') || undefined,
    password: params.get('p') || undefined,
    via: RENDEZVOUS.includes(via as Rendezvous) ? (via as Rendezvous) : undefined,
    testTone: params.has('tone'),
  };
}

export function inviteHash(invite: Invite): string {
  return new URLSearchParams({ r: invite.room, p: invite.password, v: invite.via }).toString();
}
