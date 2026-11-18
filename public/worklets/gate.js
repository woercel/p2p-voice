// Noise gate on the audio thread: keeps working while the tab is in the background.
// Opens within ~2 ms when the block RMS exceeds the threshold, holds 350 ms, then fades out.
class Gate extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: 'threshold', defaultValue: 0, minValue: 0, maxValue: 1 }];
  }

  constructor() {
    super();
    this.gain = 1;
    this.hold = 0;
    this.open = true;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0) {
      for (const channel of output) channel.fill(0);
      return true;
    }

    const threshold = parameters.threshold[0];
    const frames = input[0].length;
    let sum = 0;
    for (const channel of input) for (let i = 0; i < frames; i++) sum += channel[i] * channel[i];
    const rms = Math.sqrt(sum / (frames * input.length));

    this.hold =
      threshold <= 0 || rms >= threshold ? sampleRate * 0.35 : Math.max(0, this.hold - frames);
    const target = this.hold > 0 ? 1 : 0;
    const coefficient = 1 - Math.exp(-1 / ((target > this.gain ? 0.002 : 0.08) * sampleRate));

    for (let i = 0; i < frames; i++) {
      this.gain += (target - this.gain) * coefficient;
      for (let c = 0; c < output.length; c++) {
        output[c][i] = input[Math.min(c, input.length - 1)][i] * this.gain;
      }
    }

    const open = target === 1;
    if (open !== this.open) {
      this.open = open;
      this.port.postMessage(open);
    }
    return true;
  }
}

registerProcessor('gate', Gate);
