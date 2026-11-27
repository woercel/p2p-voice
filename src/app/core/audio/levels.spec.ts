import {
  dbToLinear,
  isGateEnabled,
  linearToDb,
  meterPercent,
  percentToGain,
  rmsDb,
} from './levels';

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

  it('converts percentage volume to linear gain and clamps within [0, max]', () => {
    expect(percentToGain(0, 200)).toBe(0);
    expect(percentToGain(100, 200)).toBe(1);
    expect(percentToGain(200, 200)).toBe(2);
    expect(percentToGain(-20, 200)).toBe(0);
    expect(percentToGain(350, 200)).toBe(2);
    expect(percentToGain(Number.NaN, 200)).toBe(1);
  });
});
