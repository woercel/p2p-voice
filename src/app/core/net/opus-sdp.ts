const OPUS_RTPMAP = /a=rtpmap:(\d+) opus\/48000\/2/i;

function parseParams(params: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const pair of params.split(';')) {
    const [key, value] = pair.trim().split('=');
    if (key) result[key] = value ?? '';
  }
  return result;
}

export function tuneOpus(sdp: string, bitrate: number): string {
  const rtpmap = sdp.match(OPUS_RTPMAP);
  if (!rtpmap) return sdp;

  const payloadType = rtpmap[1];
  const wanted: Record<string, string | number> = {
    minptime: 10,
    useinbandfec: 1,
    stereo: 1,
    'sprop-stereo': 1,
    maxaveragebitrate: bitrate,
    maxplaybackrate: 48000,
    'sprop-maxcapturerate': 48000,
    cbr: 0,
    usedtx: 0,
  };
  const render = (params: Record<string, string | number>) =>
    `a=fmtp:${payloadType} ` +
    Object.entries(params)
      .map(([key, value]) => `${key}=${value}`)
      .join(';');

  const fmtp = new RegExp(`a=fmtp:${payloadType} ([^\\r\\n]*)`);
  const existing = sdp.match(fmtp);
  return existing
    ? sdp.replace(fmtp, render({ ...parseParams(existing[1]), ...wanted }))
    : sdp.replace(rtpmap[0], `${rtpmap[0]}\r\n${render(wanted)}`);
}
