import { inviteHash, parseInvite, randomId } from './invite';

describe('invite', () => {
  it('round-trips through the URL hash', () => {
    const invite = { room: 'raum 1', password: 'p&w=?', via: 'torrent' as const };
    expect(parseInvite(`#${inviteHash(invite)}`)).toEqual({ ...invite, testTone: false });
  });

  it('ignores unknown rendezvous values and empty fields', () => {
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
