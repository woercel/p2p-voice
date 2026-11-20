import {
  Frame,
  MIN_SPEECH_FRAMES,
  TARGET_SPEECH_DB,
  analyzeFrame,
  calibrate,
  hearsOutput,
  percentile,
} from './calibration';
import { GATE_OFF_DB } from './levels';

const frames = (count: number, rms: number, block = rms + 6, peak = rms + 12): Frame[] =>
  Array.from({ length: count }, () => ({ rms, block, peak }));

/** A quiet room, light typing and speech 20 dB below the target. */
const quietRoom = () => ({
  silence: frames(60, -75, -70),
  typing: frames(100, -65, -58),
  speech: [...frames(120, -43, -37, -25), ...frames(40, -75, -70)],
});

describe('analyzeFrame', () => {
  it('measures the whole buffer, the loudest gate block and the peak', () => {
    const samples = new Float32Array(256);
    samples.fill(0.5, 0, 128);
    const frame = analyzeFrame(samples);
    expect(frame.block).toBeCloseTo(-6.02, 1);
    expect(frame.rms).toBeCloseTo(-9.03, 1);
    expect(frame.peak).toBeCloseTo(-6.02, 1);
  });
});

describe('percentile', () => {
  it('picks by nearest rank', () => {
    expect(percentile([5, 1, 3, 2, 4], 0.5)).toBe(3);
    expect(percentile([5, 1, 3, 2, 4], 1)).toBe(5);
    expect(percentile([], 0.5)).toBe(-Infinity);
  });
});

describe('calibrate', () => {
  it('raises quiet speech towards the target, within the slider', () => {
    const result = calibrate(quietRoom());
    if (!result.ok) throw new Error('expected a result');
    // 20 dB would be 1000 %; the slider stops at 200 %, so it says the input is too quiet.
    expect(result.micVolume).toBe(200);
    expect(result.warnings).toContain('tooQuiet');
  });

  it('leaves pauses out of the speech level in a very quiet room', () => {
    const result = calibrate({
      silence: frames(60, -95, -90),
      typing: frames(100, -70, -63),
      // Read once, then quiet breathing: far above the background, far below the voice.
      speech: [...frames(80, -27, -21, -15), ...frames(80, -70, -64, -58)],
    });
    if (!result.ok) throw new Error('expected a result');
    expect(result.micVolume).toBe(160);
    expect(result.speechDb).toBe(-23);
    expect(result.warnings).toEqual([]);
  });

  it('does not complain when the slider falls just short', () => {
    const result = calibrate({
      silence: frames(60, -75, -70),
      typing: frames(100, -65, -58),
      speech: frames(120, -30, -24, -20),
    });
    if (!result.ok) throw new Error('expected a result');
    // +7 dB would be 224 %; 200 % is less than 3 dB short.
    expect(result.micVolume).toBe(200);
    expect(result.warnings).toEqual([]);
  });

  it('lowers loud speech to the target', () => {
    const result = calibrate({
      silence: frames(60, -70),
      typing: frames(100, -60),
      speech: frames(120, -13, -8, -6),
    });
    if (!result.ok) throw new Error('expected a result');
    expect(result.micVolume).toBe(30);
    expect(result.speechDb).toBe(TARGET_SPEECH_DB);
    expect(result.gateDb).toBe(-61);
    expect(result.warnings).toEqual([]);
  });

  it('keeps the loudest moments below full scale', () => {
    const result = calibrate({
      silence: frames(60, -80),
      typing: frames(100, -70),
      speech: frames(120, -33, -27, -5),
    });
    if (!result.ok) throw new Error('expected a result');
    // The target asks for +10 dB, but the peaks only allow +2 dB.
    expect(result.micVolume).toBe(125);
  });

  it('sets the threshold above typing and well below speech', () => {
    const result = calibrate({
      silence: frames(60, -70, -64),
      typing: frames(100, -55, -48),
      speech: frames(120, -23, -17, -10),
    });
    if (!result.ok) throw new Error('expected a result');
    expect(result.micVolume).toBe(100);
    expect(result.gateDb).toBe(-45);
    expect(result.warnings).toEqual([]);
  });

  it('falls back to the background when typing is as loud as speech', () => {
    const result = calibrate({
      silence: frames(60, -70, -64),
      typing: frames(100, -30, -20),
      speech: frames(120, -23, -17, -10),
    });
    if (!result.ok) throw new Error('expected a result');
    expect(result.gateDb).toBe(-58);
    expect(result.warnings).toEqual(['typingAudible']);
  });

  it('turns the gate off when the background is too loud to separate', () => {
    const result = calibrate({
      silence: frames(60, -40, -28),
      typing: frames(100, -40, -28),
      speech: frames(120, -23, -17, -10),
    });
    if (!result.ok) throw new Error('expected a result');
    expect(result.gateDb).toBe(GATE_OFF_DB);
    expect(result.warnings).toContain('noisy');
  });

  it('needs no gate in a silent room without typing', () => {
    const result = calibrate({
      silence: frames(60, -100, -95),
      typing: frames(100, -100, -95),
      speech: frames(120, -23, -17, -10),
    });
    if (!result.ok) throw new Error('expected a result');
    expect(result.gateDb).toBe(GATE_OFF_DB);
  });

  it('reports clipping on the input', () => {
    const result = calibrate({
      silence: frames(60, -70),
      typing: frames(100, -60),
      speech: frames(120, -10, -4, -0.5),
    });
    expect(result.ok && result.warnings).toContain('clipping');
  });

  it('gives up when there was hardly any speech', () => {
    const result = calibrate({
      silence: frames(60, -70),
      typing: frames(100, -60),
      speech: [...frames(MIN_SPEECH_FRAMES - 1, -25), ...frames(100, -70)],
    });
    expect(result).toEqual({ ok: false, reason: 'noSpeech' });
  });
});

describe('hearsOutput', () => {
  it('needs most tones to rise clearly', () => {
    expect(hearsOutput([-90, -90, -90], [-60, -70, -88])).toBe(true);
    expect(hearsOutput([-90, -90, -90], [-60, -85, -88])).toBe(false);
    expect(hearsOutput([-90, -90, -90], [-89, -90, -91])).toBe(false);
  });

  it('ignores a faint leak in a silent room', () => {
    expect(hearsOutput([-130, -130, -130], [-95, -100, -98])).toBe(false);
  });
});
