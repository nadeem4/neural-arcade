// Which offences are highlighted in the world at a moment of the seek(ms) clock. Pure, no DOM, no three.js.
// scene-highlights.js draws whatever this returns; the tags read the same offence list, so they cannot disagree.
export const HOLD_MS = 1700; // as long as a tag stays up (events.js TAG_LIFE_MS)
const PULSE_HZ = 2;

// offences: buildOffences result. Returns [{ type, x, z, heading, k }] for each offence 0 <= clockMs - ms < HOLD_MS.
// k (0 to 1) pulses at 2 Hz from the offence's own age; under reduced motion it is a constant 1, so the highlight is static.
export function highlightsAt(offences, clockMs, { reduced = false } = {}) {
  const out = [];
  for (const o of offences ?? []) {
    const age = clockMs - o.ms;
    if (age < 0 || age >= HOLD_MS) continue;
    out.push({ type: o.type, x: o.x, z: o.z, heading: o.heading, k: reduced ? 1 : 0.5 + 0.5 * Math.cos(2 * Math.PI * PULSE_HZ * (age / 1000)) });
  }
  return out;
}
