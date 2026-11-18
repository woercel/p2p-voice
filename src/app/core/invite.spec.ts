import { inviteHash, parseInvite, randomId } from './invite';

describe('invite', () => {
  it('round-trips through a single URL-safe token', () => {
    const invite = { room: 'raum ü 1', password: 'p&w=?/+', via: 'torrent' as const };
    const hash = inviteHash(invite);
    expect(hash).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(hash).not.toContain('raum');
    expect(parseInvite(`#${hash}`)).toEqual({ ...invite, testTone: false });
  });

  it('keeps the test tone flag next to the token', () => {
    const invite = { room: 'r', password: 'p', via: 'nostr' as const };
    expect(parseInvite(`#${inviteHash(invite)}&tone`)).toEqual({ ...invite, testTone: true });
  });

  it('still reads links in the old r/p/v format', () => {
    expect(parseInvite('#r=testroom&p=secret&v=mqtt')).toEqual({
      room: 'testroom',
      password: 'secret',
      via: 'mqtt',
      testTone: false,
    });
  });

  it('ignores broken tokens, unknown rendezvous values and empty fields', () => {
    expect(parseInvite('#not-a-token')).toEqual({
      room: undefined,
      password: undefined,
      via: undefined,
      testTone: false,
    });
    expect(parseInvite('#r=&v=carrier-pigeon&tone=1')).toEqual({
      room: undefined,
      password: undefined,
      via: undefined,
      testTone: true,
    });
  });

  it('creates lowercase alphanumeric ids of the requested length', () => {
    const id = randomId(24);
    expect(id).toMatch(/^[a-z0-9]{24}$/);
    expect(randomId(24)).not.toBe(id);
  });
});
