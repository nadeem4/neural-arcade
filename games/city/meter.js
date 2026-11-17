// The live reward meter: what the trip has earned so far, `f` steps into it (a float). Pure, no DOM.
// Whole steps count in full; the step in progress counts by how far through it the taxi is, so the number glides.
export function meterAt(events, f) {
  const { steps } = events;
  const whole = Math.min(steps.length, Math.max(0, Math.floor(f)));
  const counts = { off: 0, red: 0, wrong: 0, tiles: 0 };
  let total = 0;
  for (let i = 0; i < whole; i++) {
    const s = steps[i];
    total += s.delta;
    if (s.off) counts.off++;
    if (s.red) counts.red++;
    if (s.wrong) counts.wrong++;
    if (s.moved) counts.tiles++;
  }
  if (whole < steps.length) total += steps[whole].delta * Math.max(0, Math.min(1, f - whole));
  return { total, counts, seconds: whole };
}
