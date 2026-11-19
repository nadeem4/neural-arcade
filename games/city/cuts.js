// cam=auto: when the footage cuts from the chase to an overhead shot. Pure, no DOM, no three.js.
// Everything is on the seek(ms) clock. Cuts are worked out ahead of time from the offence list (offences.js).
// The shot inside a cut is framed live by the scene (director.js overheadShot): the taxi and the offences still highlighted.

// offences: buildOffences result. Returns [{ from, to }]:
// offences closer than mergeMs share one cut; a cut spans windowMs around them; cuts with under chaseGapMs of chase between merge;
// all of it stays inside the chase phase [introMs, introMs + driveMs].
export function overheadCuts(offences, { introMs, driveMs, windowMs = 2000, mergeMs = 3000, chaseGapMs = 2000 }) {
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
    if (last && from - last.to < chaseGapMs) last.to = to; else cuts.push({ from, to });
  }
  return cuts;
}

// The cut holding seek time ms, or null.
export const cutAt = (cuts, ms) => cuts.find((c) => ms >= c.from && ms < c.to) ?? null;
