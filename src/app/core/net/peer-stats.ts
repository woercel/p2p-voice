export type Route = 'direct' | 'direct-ipv6' | 'relay';

export type PeerStats = {
  inKbps: number | null;
  outKbps: number | null;
  rttMs: number | null;
  lossPercent: number | null;
  route: Route | null;
};

export type StatsSample = {
  at: number;
  bytesIn?: number;
  bytesOut?: number;
  packetsIn?: number;
  packetsLost?: number;
};

type StatsEntry = {
  type: string;
  kind?: string;
  bytesReceived?: number;
  bytesSent?: number;
  packetsReceived?: number;
  packetsLost?: number;
  selectedCandidatePairId?: string;
  selected?: boolean;
  nominated?: boolean;
  state?: string;
  currentRoundTripTime?: number;
  localCandidateId?: string;
  remoteCandidateId?: string;
  candidateType?: string;
  address?: string;
  ip?: string;
};

export type StatsReportLike = {
  forEach(callback: (entry: StatsEntry) => void): void;
  get(id: string): StatsEntry | undefined;
};

function kbps(bytes: number | undefined, previous: number | undefined, elapsedMs: number) {
  if (bytes === undefined || previous === undefined || elapsedMs <= 0) return null;
  return Math.max(0, Math.round(((bytes - previous) * 8) / elapsedMs));
}

/**
 * Loss over the last interval, like the bitrates. The counters run from the start of the
 * connection, so their totals would bury a dropout in a long call under everything before it.
 */
function lossPercent(inbound: StatsEntry | undefined, previous: StatsSample | undefined) {
  const { packetsReceived, packetsLost } = inbound ?? {};
  if (packetsReceived === undefined || packetsLost === undefined) return null;
  if (previous?.packetsIn === undefined || previous.packetsLost === undefined) return null;
  const received = Math.max(0, packetsReceived - previous.packetsIn);
  // A late packet is counted lost first and received later, so the lost count can go down.
  const lost = Math.max(0, packetsLost - previous.packetsLost);
  return received + lost > 0 ? (lost / (received + lost)) * 100 : null;
}

export function readPeerStats(
  report: StatsReportLike,
  previous: StatsSample | undefined,
  now: number,
): { stats: PeerStats; sample: StatsSample } {
  let inbound: StatsEntry | undefined;
  let outbound: StatsEntry | undefined;
  let pair: StatsEntry | undefined;

  report.forEach((entry) => {
    if (entry.type === 'inbound-rtp' && entry.kind === 'audio') inbound = entry;
    if (entry.type === 'outbound-rtp' && entry.kind === 'audio') outbound = entry;
    if (entry.type === 'transport' && entry.selectedCandidatePairId) {
      pair = report.get(entry.selectedCandidatePairId);
    }
  });
  if (!pair) {
    report.forEach((entry) => {
      const active = entry.selected || (entry.nominated && entry.state === 'succeeded');
      if (entry.type === 'candidate-pair' && active) pair = entry;
    });
  }

  const elapsed = previous ? now - previous.at : 0;

  let route: Route | null = null;
  if (pair) {
    const local = pair.localCandidateId ? report.get(pair.localCandidateId) : undefined;
    const remote = pair.remoteCandidateId ? report.get(pair.remoteCandidateId) : undefined;
    const relayed = local?.candidateType === 'relay' || remote?.candidateType === 'relay';
    const address = remote?.address ?? remote?.ip ?? '';
    route = relayed ? 'relay' : address.includes(':') ? 'direct-ipv6' : 'direct';
  }

  return {
    stats: {
      inKbps: kbps(inbound?.bytesReceived, previous?.bytesIn, elapsed),
      outKbps: kbps(outbound?.bytesSent, previous?.bytesOut, elapsed),
      rttMs:
        pair?.currentRoundTripTime !== undefined
          ? Math.round(pair.currentRoundTripTime * 1000)
          : null,
      lossPercent: lossPercent(inbound, previous),
      route,
    },
    sample: {
      at: now,
      bytesIn: inbound?.bytesReceived,
      bytesOut: outbound?.bytesSent,
      packetsIn: inbound?.packetsReceived,
      packetsLost: inbound?.packetsLost,
    },
  };
}
