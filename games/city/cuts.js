// cam=auto: when the footage cuts from the chase to an overhead shot. Pure, no DOM, no three.js.
// Everything is on the seek(ms) clock. Cuts are worked out ahead of time from the offence list (offences.js).

// offences: buildOffences result. posAt(ms): { x, z } of the taxi at seek time ms. Returns [{ from, to, points }]:
// offences closer than mergeMs share one cut; a cut spans windowMs around them; cuts with under chaseGapMs of chase between merge;
// all of it stays inside the chase phase [introMs, introMs + driveMs]. points ([[x, z]]) are the offence spots and the taxi
// along the cut, for overheadShot to frame.
export function overheadCuts(offences, { introMs, driveMs, posAt, windowMs = 2000, mergeMs = 3000, chaseGapMs = 2000 }) {
  const lo = introMs, hi = introMs + driveMs, half = windowMs / 2;
  const groups = [];
  for (const o of [...offences].sort((a, b) => a.ms - b.ms)) {
    const g = groups.at(-1);
    if (g && o.ms - g.at(-1).ms < mergeMs) g.push(o); else groups.push([o]);
  }
  const cuts = [];
  for (const g of groups) {
    const from = Math.max(lo, g[0].ms - half), to = Math.min(hi, g.at(-1).ms + half);
    const last = cuts.at(-1);
    if (last && from - last.to < chaseGapMs) { last.to = to; last.offences.push(...g); } else cuts.push({ from, to, offences: [...g] });
  }
  return cuts.map(({ from, to, offences: os }) => {
    const points = os.map((o) => [o.x, o.z]);
    for (let ms = from; ms < to; ms += 1000) { const p = posAt(ms); points.push([p.x, p.z]); } // the taxi along the cut, so it stays in view
    const end = posAt(to); points.push([end.x, end.z]);
    return { from, to, points };
  });
}

// The cut holding seek time ms, or null.
export const cutAt = (cuts, ms) => cuts.find((c) => ms >= c.from && ms < c.to) ?? null;
