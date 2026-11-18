import { playCue } from './cues';

function fakeContext() {
  const frequencies: number[] = [];
  const node = () => ({ connect: (target: unknown) => target, disconnect: () => undefined });
  const context = {
    currentTime: 0,
    destination: {},
    createOscillator: () => {
      const oscillator = {
        ...node(),
        type: '',
        frequency: {
          set value(v: number) {
            frequencies.push(v);
          },
        },
        start: () => undefined,
        stop: () => undefined,
        onended: null,
      };
      return oscillator;
    },
    createGain: () => ({
      ...node(),
      gain: {
        setValueAtTime: () => undefined,
        linearRampToValueAtTime: () => undefined,
        exponentialRampToValueAtTime: () => undefined,
      },
    }),
  };
  return { context: context as unknown as BaseAudioContext, frequencies };
}

describe('playCue', () => {
  it('rises for a join and falls for a leave', () => {
    const join = fakeContext();
    playCue(join.context, 'join');
    expect(join.frequencies[0]).toBeLessThan(join.frequencies[1]);

    const leave = fakeContext();
    playCue(leave.context, 'leave');
    expect(leave.frequencies[0]).toBeGreaterThan(leave.frequencies[1]);
  });
});
