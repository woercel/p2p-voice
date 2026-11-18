import { dbToLinear, isGateEnabled, linearToDb, meterPercent, rmsDb } from './levels';

describe('levels', () => {
  it('converts between dB and linear', () => {
    expect(dbToLinear(0)).toBe(1);
    expect(dbToLinear(-20)).toBeCloseTo(0.1);
    expect(linearToDb(0.1)).toBeCloseTo(-20);
    expect(linearToDb(0)).toBe(-120);
  });

  it('maps dB onto the meter range and clamps', () => {
    expect(meterPercent(-70)).toBe(0);
    expect(meterPercent(-6)).toBe(100);
    expect(meterPercent(-38)).toBeCloseTo(50);
    expect(meterPercent(-200)).toBe(0);
    expect(meterPercent(10)).toBe(100);
  });

  it('computes the RMS level of a sine wave', () => {
    const samples = Float32Array.from({ length: 4800 }, (_, i) => Math.sin((2 * Math.PI * i) / 48));
    expect(rmsDb(samples)).toBeCloseTo(-3.01, 1);
  });

  it('treats the bottom of the range as gate off', () => {
    expect(isGateEnabled(-70)).toBe(false);
    expect(isGateEnabled(-69)).toBe(true);
  });
});
