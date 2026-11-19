// cam=auto: when the footage cuts from the chase to an overhead shot. Pure, no DOM, no three.js.
// Everything is on the seek(ms) clock. Cuts are worked out ahead of time from the offence list (offences.js).
// The shot inside a cut is framed live by the scene (director.js overheadShot): centred on the taxi, at the height the cut's spread gives.

// offences: buildOffences result. Returns [{ from, to, spread }]; spread (metres, at most CUT_SPREAD_MAX) is how far the cut's offences lie from their
// middle, and fixes the camera height for the whole cut (director.js overheadShot), so the zoom never jumps inside a cut. Offences past the cap may sit off screen:
// offences closer than mergeMs share one cut; a cut spans windowMs around them; cuts with under chaseGapMs of chase between merge;
// all of it stays inside the chase phase [introMs, introMs + driveMs].
export const CUT_SPREAD_MAX = 100; // metres: past this the camera would rise until the taxi is too small to read

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
    if (last && from - last.to < chaseGapMs) { last.to = to; last.offs.push(...g); } else cuts.push({ from, to, offs: [...g] });
  }
  return cuts.map(({ from, to, offs }) => {
    const mx = offs.reduce((a, o) => a + o.x, 0) / offs.length, mz = offs.reduce((a, o) => a + o.z, 0) / offs.length;
    return { from, to, spread: Math.min(CUT_SPREAD_MAX, Math.max(...offs.map((o) => Math.hypot(o.x - mx, o.z - mz)))) };
  });
}

// The cut holding seek time ms, or null.
export const cutAt = (cuts, ms) => cuts.find((c) => ms >= c.from && ms < c.to) ?? null;
