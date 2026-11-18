const EXTMAP = /^a=extmap:(\d+)(?:\/\w+)? (\S+)/;
const MID = /^a=mid:(\S+)/m;

type ExtmapsByMid = Map<string, Map<string, string>>;

function mediaSections(sdp: string): string[] {
  return sdp.split(/\r?\n(?=m=)/).slice(1);
}

function collect(sdps: readonly string[]): ExtmapsByMid {
  const result: ExtmapsByMid = new Map();
  for (const sdp of sdps) {
    for (const section of mediaSections(sdp)) {
      const mid = section.match(MID)?.[1];
      if (!mid) continue;
      const ids = result.get(mid) ?? new Map<string, string>();
      for (const line of section.split(/\r?\n/)) {
        const [, id, uri] = line.match(EXTMAP) ?? [];
        if (id && !ids.has(id)) ids.set(id, uri);
      }
      result.set(mid, ids);
    }
  }
  return result;
}

/**
 * Chrome rejects a re-offer that maps an extension ID already in use on a media section to a
 * different URI, which Firefox does for extensions that were offered but never agreed on.
 * Dropping those lines from the remote offer keeps the agreed ones and lets negotiation succeed.
 */
export function dropExtmapCollisions(offer: string, known: readonly string[]): string {
  const inUse = collect(known);
  if (inUse.size === 0) return offer;

  const lineBreak = offer.includes('\r\n') ? '\r\n' : '\n';
  const [session, ...sections] = offer.split(/\r?\n(?=m=)/);
  const patched = sections.map((section) => {
    const ids = inUse.get(section.match(MID)?.[1] ?? '');
    if (!ids) return section;
    return section
      .split(/\r?\n/)
      .filter((line) => {
        const [, id, uri] = line.match(EXTMAP) ?? [];
        return !id || !ids.has(id) || ids.get(id) === uri;
      })
      .join(lineBreak);
  });
  return [session, ...patched].join(lineBreak);
}
