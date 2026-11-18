import { StatsReportLike, readPeerStats } from './peer-stats';

function report(entries: Record<string, Record<string, unknown>>): StatsReportLike {
  const map = new Map(Object.entries(entries).map(([id, e]) => [id, { id, ...e }]));
  return {
    forEach: (callback) => map.forEach((entry) => callback(entry as never)),
    get: (id) => map.get(id) as never,
  };
}

const base = {
  in: {
    type: 'inbound-rtp',
    kind: 'audio',
    bytesReceived: 125_000,
    packetsReceived: 990,
    packetsLost: 10,
  },
  out: { type: 'outbound-rtp', kind: 'audio', bytesSent: 62_500 },
  transport: { type: 'transport', selectedCandidatePairId: 'pair' },
  pair: {
    type: 'candidate-pair',
    currentRoundTripTime: 0.023,
    localCandidateId: 'l',
    remoteCandidateId: 'r',
  },
  l: { type: 'local-candidate', candidateType: 'host' },
  r: { type: 'remote-candidate', candidateType: 'srflx', address: '203.0.113.7' },
};

describe('readPeerStats', () => {
  it('derives bitrates from the previous sample', () => {
    const previous = { at: 0, bytesIn: 0, bytesOut: 0, packetsIn: 0, packetsLost: 0 };
    const { stats, sample } = readPeerStats(report(base), previous, 1000);
    expect(stats.inKbps).toBe(1000);
    expect(stats.outKbps).toBe(500);
    expect(stats.rttMs).toBe(23);
    expect(stats.lossPercent).toBeCloseTo(1);
    expect(stats.route).toBe('direct');
    expect(sample).toEqual({
      at: 1000,
      bytesIn: 125_000,
      bytesOut: 62_500,
      packetsIn: 990,
      packetsLost: 10,
    });
  });

  it('has no bitrate or loss without a previous sample', () => {
    const { stats } = readPeerStats(report(base), undefined, 1000);
    expect(stats.inKbps).toBeNull();
    expect(stats.outKbps).toBeNull();
    expect(stats.lossPercent).toBeNull();
  });

  it('reports the loss of the last interval, not of the whole call', () => {
    // A long clean call, then a second in which 30 of 100 packets went missing.
    const previous = { at: 0, packetsIn: 100_000, packetsLost: 10 };
    const now = { ...base, in: { ...base.in, packetsReceived: 100_070, packetsLost: 40 } };
    expect(readPeerStats(report(now), previous, 1000).stats.lossPercent).toBeCloseTo(30);
  });

  it('detects relayed and IPv6 routes', () => {
    const relayed = { ...base, l: { type: 'local-candidate', candidateType: 'relay' } };
    expect(readPeerStats(report(relayed), undefined, 0).stats.route).toBe('relay');

    const ipv6 = {
      ...base,
      r: { type: 'remote-candidate', candidateType: 'host', address: '2001:db8::1' },
    };
    expect(readPeerStats(report(ipv6), undefined, 0).stats.route).toBe('direct-ipv6');
  });

  it('falls back to the selected candidate pair (Firefox)', () => {
    const { transport: _, ...rest } = base;
    const firefox = { ...rest, pair: { ...base.pair, selected: true } };
    expect(readPeerStats(report(firefox), undefined, 0).stats.rttMs).toBe(23);
  });
});
