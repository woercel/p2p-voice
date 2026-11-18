import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { inviteHash } from '../../core/invite';
import { rememberRoom } from '../../core/last-room';
import { RoomService } from '../../core/net/room';
import { Lobby } from './lobby';

describe('Lobby', () => {
  beforeEach(() => {
    localStorage.clear();
    const hash = inviteHash({ room: 'testroom', password: 'secret', via: 'mqtt' });
    history.replaceState(null, '', `/#${hash}`);
  });

  it('prefills the room from the invite link and shows the invitation', async () => {
    const fixture = TestBed.createComponent(Lobby);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain("You've been invited");
    const inputs = [...element.querySelectorAll<HTMLInputElement>('input[matInput]')];
    expect(inputs.map((input) => input.value)).toEqual(['', 'testroom', 'secret']);
  });

  it('disables joining without a room name', async () => {
    const fixture = TestBed.createComponent(Lobby);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const roomInput = element.querySelectorAll<HTMLInputElement>('input[matInput]')[1];

    roomInput.value = '  ';
    roomInput.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    const join = element.querySelector<HTMLButtonElement>('button.join');
    expect(join?.disabled).toBe(true);
  });

  describe('after a reload', () => {
    const invite = { room: 'testroom', password: 'secret', via: 'mqtt' } as const;
    let join: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      join = vi.fn().mockResolvedValue(undefined);
      TestBed.configureTestingModule({
        providers: [{ provide: RoomService, useValue: { join, status: signal('idle') } }],
      });
    });

    it('rejoins the room it was in', async () => {
      rememberRoom(invite);
      const fixture = TestBed.createComponent(Lobby);
      await fixture.whenStable();
      expect(join).toHaveBeenCalledWith(invite, false);
    });

    it('waits for a click when the link points elsewhere', async () => {
      rememberRoom({ ...invite, room: 'otherroom' });
      const fixture = TestBed.createComponent(Lobby);
      await fixture.whenStable();
      expect(join).not.toHaveBeenCalled();
    });
  });
});
