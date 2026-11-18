import { tuneOpus } from './opus-sdp';

const sdp = (fmtp: string | null) =>
  [
    'v=0',
    'm=audio 9 UDP/TLS/RTP/SAVPF 111 0',
    'a=rtpmap:111 opus/48000/2',
    ...(fmtp === null ? [] : [`a=fmtp:111 ${fmtp}`]),
    'a=rtpmap:0 PCMU/8000',
    '',
  ].join('\r\n');

const fmtpOf = (text: string) => text.match(/a=fmtp:111 ([^\r\n]*)/)?.[1] ?? '';

const paramsOf = (text: string) =>
  Object.fromEntries(
    fmtpOf(text)
      .split(';')
      .map((pair) => pair.split('=')),
  );

describe('tuneOpus', () => {
  it('requests stereo at the given bitrate and keeps existing parameters', () => {
    const tuned = fmtpOf(tuneOpus(sdp('minptime=10;useinbandfec=1;foo=bar'), 256_000));
    expect(tuned).toContain('stereo=1');
    expect(tuned).toContain('sprop-stereo=1');
    expect(tuned).toContain('maxaveragebitrate=256000');
    expect(tuned).toContain('foo=bar');
    expect(tuned).toContain('usedtx=0');
  });

  it('overrides conflicting values instead of duplicating them', () => {
    const tuned = tuneOpus(sdp('stereo=0;maxaveragebitrate=32000'), 510_000);
    expect(fmtpOf(tuned).match(/(^|;)stereo=/g)).toHaveLength(1);
    expect(paramsOf(tuned)).toMatchObject({ stereo: '1', maxaveragebitrate: '510000' });
  });

  it('adds an fmtp line when there is none', () => {
    const tuned = tuneOpus(sdp(null), 128_000);
    expect(tuned).toMatch(/a=rtpmap:111 opus\/48000\/2\r\na=fmtp:111 .*maxaveragebitrate=128000/);
  });

  it('leaves SDPs without Opus untouched', () => {
    const plain = 'v=0\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n';
    expect(tuneOpus(plain, 510_000)).toBe(plain);
  });
});
