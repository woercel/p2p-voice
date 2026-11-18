export type Rendezvous = 'nostr' | 'torrent' | 'mqtt';

export const RENDEZVOUS: readonly Rendezvous[] = ['nostr', 'torrent', 'mqtt'];

export type Invite = { room: string; password: string; via: Rendezvous };

export type ParsedInvite = Partial<Invite> & { testTone: boolean };

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function randomId(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

function toBase64Url(text: string): string {
  const binary = Array.from(new TextEncoder().encode(text), (b) => String.fromCharCode(b)).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(token: string): string {
  const binary = atob(token.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

function readToken(token: string): Partial<Invite> {
  try {
    const [room, password, via] = JSON.parse(fromBase64Url(token)) as unknown[];
    return {
      room: typeof room === 'string' && room ? room : undefined,
      password: typeof password === 'string' && password ? password : undefined,
      via: typeof via === 'number' ? RENDEZVOUS[via] : undefined,
    };
  } catch {
    return {};
  }
}

/** Links shared before the token format spelled out room and password as `r`, `p` and `v`. */
function readLegacy(params: URLSearchParams): Partial<Invite> {
  const via = params.get('v');
  return {
    room: params.get('r') || undefined,
    password: params.get('p') || undefined,
    via: RENDEZVOUS.includes(via as Rendezvous) ? (via as Rendezvous) : undefined,
  };
}

export function parseInvite(hash: string): ParsedInvite {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const token = [...params.keys()].find((key) => key !== 'tone');
  const invite = params.has('r') ? readLegacy(params) : token ? readToken(token) : {};
  return {
    room: invite.room,
    password: invite.password,
    via: invite.via,
    testTone: params.has('tone'),
  };
}

export function inviteHash(invite: Invite): string {
  return toBase64Url(
    JSON.stringify([invite.room, invite.password, RENDEZVOUS.indexOf(invite.via)]),
  );
}
