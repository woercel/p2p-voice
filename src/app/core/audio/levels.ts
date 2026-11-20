export const METER_FLOOR_DB = -70;
export const METER_CEIL_DB = -6;
export const GATE_OFF_DB = -70;
export const SPEAKING_DB = -45;
export const SPEAKING_HOLD_MS = 300;
/** The microphone volume goes up to this, in percent. */
export const MIC_VOLUME_MAX = 200;

export const dbToLinear = (db: number): number => 10 ** (db / 20);

export const linearToDb = (value: number): number => 20 * Math.log10(Math.max(value, 1e-6));

export function meterPercent(db: number): number {
  const percent = ((db - METER_FLOOR_DB) / (METER_CEIL_DB - METER_FLOOR_DB)) * 100;
  return Math.min(100, Math.max(0, percent));
}

export function rmsDb(samples: Float32Array, length = samples.length): number {
  let sum = 0;
  for (let i = 0; i < length; i++) sum += samples[i] * samples[i];
  return linearToDb(Math.sqrt(sum / length));
}

export function analyserDb(analyser: AnalyserNode, buffer: Float32Array<ArrayBuffer>): number {
  analyser.getFloatTimeDomainData(buffer);
  return rmsDb(buffer, Math.min(buffer.length, analyser.fftSize));
}

export const isGateEnabled = (db: number): boolean => db > GATE_OFF_DB;
