import { TestBed } from '@angular/core/testing';
import { Lobby } from './lobby';

describe('Lobby', () => {
  beforeEach(() => {
    localStorage.clear();
    history.replaceState(null, '', '/#r=testroom&p=secret&v=mqtt');
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

    const join = element.querySelector<HTMLButtonElement>('mat-card-actions button');
    expect(join?.disabled).toBe(true);
  });
});
