export type Cue = 'join' | 'leave';

const NOTES: Record<Cue, readonly number[]> = {
  join: [659.25, 987.77],
  leave: [987.77, 659.25],
};

const NOTE_GAP_S = 0.09;
const NOTE_LENGTH_S = 0.22;
const PEAK_GAIN = 0.12;

/** Short two-note chime, synthesised so no audio files need to be shipped. */
export function playCue(context: BaseAudioContext, cue: Cue): void {
  const start = context.currentTime + 0.01;
  NOTES[cue].forEach((frequency, index) => {
    const at = start + index * NOTE_GAP_S;
    const oscillator = context.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;

    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(PEAK_GAIN, at + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + NOTE_LENGTH_S);

    oscillator.connect(envelope).connect(context.destination);
    oscillator.start(at);
    oscillator.stop(at + NOTE_LENGTH_S + 0.02);
    oscillator.onended = () => envelope.disconnect();
  });
}
