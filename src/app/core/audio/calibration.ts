import { GATE_OFF_DB, METER_CEIL_DB, MIC_VOLUME_MAX, linearToDb } from './levels';

/** One look at the raw microphone, before volume and gate. All values in dBFS. */
export type Frame = {
  /** Level over the whole buffer, roughly what a listener perceives. */
  rms: number;
  /** Loudest 128-sample block: what the gate sees, since it decides per block. */
  block: number;
  /** Loudest single sample, to catch clipping. */
  peak: number;
};

export type Recordings = { silence: Frame[]; typing: Frame[]; speech: Frame[] };

export type CalibrationWarning =
  /** Even the highest volume does not reach the target; the Windows input level is too low. */
  | 'tooQuiet'
  /** The input already clips before our volume; only the Windows input level can fix that. */
  | 'clipping'
  /** Typing is about as loud as speech, so the threshold lets it through. */
  | 'typingAudible'
  /** The background is so loud that no threshold separates it from speech. */
  | 'noisy';

export type Calibration =
  | {
      ok: true;
      micVolume: number;
      gateDb: number;
      /** Levels as they will be sent, i.e. after the new volume. */
      noiseDb: number;
      typingDb: number;
      speechDb: number;
      warnings: CalibrationWarning[];
    }
  | { ok: false; reason: 'noSpeech' };

/** Where speech should sit once the volume is applied; leaves room for laughing and shouting. */
export const TARGET_SPEECH_DB = -23;
/** The loudest moments of speech should stay this far below full scale. */
const PEAK_HEADROOM_DB = -3;
const CLIPPING_DB = -1;
const GATE_BLOCK = 128;
/** A frame counts as speech when it is this much louder than the background. */
const SPEECH_ABOVE_NOISE_DB = 12;
/** Speech varies by about this much between stressed syllables and quiet word endings. */
const SPEECH_RANGE_DB = 20;
/** Below about three quarters of a second of speech the measurement says too little. */
export const MIN_SPEECH_FRAMES = 15;
/** The threshold stays this far below normal speech, so quiet words still get through. */
const SPEECH_MARGIN_DB = 12;
const NOISE_MARGIN_DB = 6;
const TYPING_MARGIN_DB = 3;
const MIC_VOLUME_MIN = 5;
const MIC_VOLUME_STEP = 5;
/** Falling a little short of the target is not worth sending anyone into the Windows settings. */
const TOO_QUIET_TOLERANCE_DB = 3;

export function analyzeFrame(samples: Float32Array, length = samples.length): Frame {
  let total = 0;
  let loudestBlock = 0;
  let peak = 0;
  for (let start = 0; start < length; start += GATE_BLOCK) {
    const end = Math.min(length, start + GATE_BLOCK);
    let sum = 0;
    for (let i = start; i < end; i++) {
      const value = samples[i];
      sum += value * value;
      peak = Math.max(peak, Math.abs(value));
    }
    total += sum;
    loudestBlock = Math.max(loudestBlock, sum / (end - start));
  }
  return {
    rms: linearToDb(Math.sqrt(total / Math.max(1, length))),
    block: linearToDb(Math.sqrt(loudestBlock)),
    peak: linearToDb(peak),
  };
}

/** Nearest-rank percentile; `share` from 0 to 1. */
export function percentile(values: number[], share: number): number {
  if (!values.length) return -Infinity;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(share * sorted.length) - 1));
  return sorted[index];
}

/**
 * Picks a microphone volume that brings speech to the target level, and a voice threshold that
 * sits above the background and typing but well below speech.
 */
export function calibrate({ silence, typing, speech }: Recordings): Calibration {
  const noise = percentile(
    silence.map((f) => f.rms),
    0.5,
  );
  // In a very quiet room breathing and pauses also stand out from the background; counting them
  // as speech would drag the level down. So speech is what comes near its own loud parts.
  const loud = percentile(
    speech.map((f) => f.rms),
    0.95,
  );
  const speechFloor = Math.max(noise + SPEECH_ABOVE_NOISE_DB, loud - SPEECH_RANGE_DB);
  const active = speech.filter((f) => f.rms > speechFloor);
  if (active.length < MIN_SPEECH_FRAMES) return { ok: false, reason: 'noSpeech' };

  const warnings: CalibrationWarning[] = [];
  const spoken = percentile(
    active.map((f) => f.rms),
    0.5,
  );
  const loudest = percentile(
    active.map((f) => f.peak),
    0.98,
  );
  if (Math.max(loudest, ...typing.map((f) => f.peak)) >= CLIPPING_DB) warnings.push('clipping');

  const wantedDb = Math.min(TARGET_SPEECH_DB - spoken, PEAK_HEADROOM_DB - loudest);
  const wanted = 100 * 10 ** (wantedDb / 20);
  if (wanted > MIC_VOLUME_MAX * 10 ** (TOO_QUIET_TOLERANCE_DB / 20)) warnings.push('tooQuiet');
  const micVolume = Math.min(
    MIC_VOLUME_MAX,
    Math.max(MIC_VOLUME_MIN, Math.round(wanted / MIC_VOLUME_STEP) * MIC_VOLUME_STEP),
  );
  const gain = linearToDb(micVolume / 100);

  const ceiling = spoken - SPEECH_MARGIN_DB;
  const noiseFloor =
    percentile(
      silence.map((f) => f.block),
      0.95,
    ) + NOISE_MARGIN_DB;
  const typingFloor =
    percentile(
      typing.map((f) => f.block),
      0.95,
    ) + TYPING_MARGIN_DB;
  let threshold: number | null;
  if (typingFloor <= ceiling) threshold = Math.max(noiseFloor, typingFloor);
  else if (noiseFloor <= ceiling) {
    threshold = noiseFloor;
    warnings.push('typingAudible');
  } else {
    threshold = null;
    warnings.push('noisy');
  }

  return {
    ok: true,
    micVolume,
    gateDb: threshold === null ? GATE_OFF_DB : gateSetting(threshold + gain),
    noiseDb: Math.round(noise + gain),
    typingDb: Math.round(
      percentile(
        typing.map((f) => f.block),
        0.95,
      ) + gain,
    ),
    speechDb: Math.round(spoken + gain),
    warnings,
  };
}

/** Below the slider's range the background is quiet enough that no gate is needed. */
function gateSetting(db: number): number {
  const rounded = Math.ceil(db);
  if (rounded <= GATE_OFF_DB) return GATE_OFF_DB;
  return Math.min(METER_CEIL_DB, rounded);
}

/** Three tones spread out, so one dip of a small speaker or the room does not hide them all. */
export const PROBE_FREQUENCIES = [1000, 1600, 2500] as const;
const PROBE_RISE_DB = 12;
/**
 * Below this spectrum level the tones are too faint to come back as an audible echo; roughly
 * 35 dB under normal speech. In a silent room even headphones leak enough to rise above the
 * background, so the rise alone is not enough.
 */
const PROBE_AUDIBLE_DB = -70;

/**
 * The microphone hears the output when most probe tones rise clearly above the background and
 * are loud enough to matter. Both lists hold the spectrum level per probe frequency, in dB,
 * without and with the tones playing.
 */
export function hearsOutput(before: number[], during: number[]): boolean {
  const risen = before.filter(
    (level, i) => during[i] - level >= PROBE_RISE_DB && during[i] >= PROBE_AUDIBLE_DB,
  ).length;
  return risen > before.length / 2;
}
