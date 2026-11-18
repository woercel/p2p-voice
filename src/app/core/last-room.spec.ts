import { forgetRoom, isLastRoom, rememberRoom } from './last-room';

describe('last room', () => {
  const invite = { room: 'testroom', password: 'secret', via: 'mqtt' } as const;

  beforeEach(() => localStorage.clear());

  it('recognises the remembered room until it is forgotten', () => {
    expect(isLastRoom(invite)).toBe(false);
    rememberRoom(invite);
    expect(isLastRoom(invite)).toBe(true);
    forgetRoom();
    expect(isLastRoom(invite)).toBe(false);
  });

  it('needs room, password and rendezvous to match', () => {
    rememberRoom(invite);
    expect(isLastRoom({ ...invite, room: 'other' })).toBe(false);
    expect(isLastRoom({ ...invite, password: 'other' })).toBe(false);
    expect(isLastRoom({ ...invite, via: 'nostr' })).toBe(false);
    expect(isLastRoom({})).toBe(false);
  });
});
