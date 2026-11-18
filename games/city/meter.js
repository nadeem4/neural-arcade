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

// "What the city wanted" is a score out of 100, so its bar is 0 to 100.
export const METER_SCALE = 100;
export const barFraction = (v) => Math.max(0, Math.min(1, v / METER_SCALE));

// Pay has no fixed top (a trip can climb to 800 or dip below 0), so its bar runs over the trip's own range,
// found once per trip from the whole route: at least 0 to 100, wider if the trip goes past either end.
export function payRange(events) {
  let lo = 0, hi = METER_SCALE, t = 0;
  for (const s of events.steps) { t += s.delta; lo = Math.min(lo, t); hi = Math.max(hi, t); }
  return { lo, hi };
}
export const payFraction = (v, { lo, hi }) => Math.max(0, Math.min(1, (v - lo) / (hi - lo)));

// The big number: whole, with a real minus sign (a gain gets a plus).
export function meterText(total) {
  const n = Math.round(total);
  return n === 0 ? '0' : n < 0 ? `−${-n}` : `+${n}`;
}
