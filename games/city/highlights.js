// Which offences are highlighted in the world at a moment of the seek(ms) clock. Pure, no DOM, no three.js.
// scene-highlights.js draws whatever this returns; the tags read the same offence list, so they cannot disagree.
export const HOLD_MS = 1700; // as long as a tag stays up (events.js TAG_LIFE_MS)
const PULSE_HZ = 2;

export const OVERHEAD_BOOST = 1.6; // from the overhead shot the arrow and ring are this much bigger
// How a highlight is drawn at pulse k (0 to 1): its opacity and size multiplier. Overhead the tile flash is near opaque, the arrow and ring bigger.
export function highlightLook(type, k, overhead) {
  const base = type === 'wrong' ? 0.6 : 0.3;
  const opacity = overhead && type === 'off' ? 0.7 + 0.3 * k : base + 0.4 * k;
  return { opacity, boost: overhead && type !== 'off' ? OVERHEAD_BOOST : 1 };
}

// offences: buildOffences result. Returns [{ type, x, z, heading, k }] for each offence 0 <= clockMs - ms < HOLD_MS.
// k (0 to 1) pulses at 2 Hz from the offence's own age; under reduced motion it is a constant 1, so the highlight is static.
export function highlightsAt(offences, clockMs, { reduced = false } = {}) {
  const out = [];
  for (const o of offences ?? []) {
    const age = clockMs - o.ms;
    if (age < 0 || age >= HOLD_MS) continue;
    out.push({ type: o.type, x: o.type === 'wrong' ? o.ax ?? o.x : o.x, z: o.type === 'wrong' ? o.az ?? o.z : o.z, heading: o.heading, k: reduced ? 1 : 0.5 + 0.5 * Math.cos(2 * Math.PI * PULSE_HZ * (age / 1000)) });
  }
  return out;
}
