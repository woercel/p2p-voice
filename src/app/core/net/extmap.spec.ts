import { dropExtmapCollisions } from './extmap';

const sdp = (...sections: string[][]) =>
  [['v=0', 'a=group:BUNDLE 0 1'], ...sections].map((lines) => lines.join('\r\n')).join('\r\n') +
  '\r\n';

const data = ['m=application 9 UDP/DTLS/SCTP webrtc-datachannel', 'a=mid:0'];

const chromeAudio = [
  'm=audio 9 UDP/TLS/RTP/SAVPF 111',
  'a=mid:1',
  'a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level',
  'a=extmap:2 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time',
  'a=extmap:4 urn:ietf:params:rtp-hdrext:sdes:mid',
];

const firefoxReoffer = [
  'm=audio 9 UDP/TLS/RTP/SAVPF 109',
  'a=mid:1',
  'a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level',
  'a=extmap:2/recvonly urn:ietf:params:rtp-hdrext:csrc-audio-level',
  'a=extmap:4 urn:ietf:params:rtp-hdrext:sdes:mid',
  'a=extmap:7 urn:ietf:params:rtp-hdrext:toffset',
];

describe('dropExtmapCollisions', () => {
  it('drops extensions that reuse an active ID for another URI', () => {
    const patched = dropExtmapCollisions(sdp(data, firefoxReoffer), [sdp(data, chromeAudio)]);
    expect(patched).not.toContain('csrc-audio-level');
    expect(patched).toContain('a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level');
    expect(patched).toContain('a=extmap:4 urn:ietf:params:rtp-hdrext:sdes:mid');
    expect(patched).toContain('a=extmap:7 urn:ietf:params:rtp-hdrext:toffset');
  });

  it('keeps the rest of the description byte for byte', () => {
    const offer = sdp(data, firefoxReoffer);
    const patched = dropExtmapCollisions(offer, [sdp(data, chromeAudio)]);
    const expected = offer.replace(
      'a=extmap:2/recvonly urn:ietf:params:rtp-hdrext:csrc-audio-level\r\n',
      '',
    );
    expect(patched).toBe(expected);
  });

  it('leaves new media sections and first offers alone', () => {
    const offer = sdp(data, firefoxReoffer);
    expect(dropExtmapCollisions(offer, [])).toBe(offer);
    expect(dropExtmapCollisions(offer, [sdp(data)])).toBe(offer);
  });
});
