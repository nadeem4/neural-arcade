// The camera director: map, swoop in, chase while driving, pull back, map. Pure keyframe maths, no DOM, no three.js.
// A shot is { pos: [x, y, z], target: [x, y, z], fov }.
export const SWOOP_MS = 1400;
export const PULLBACK_MS = 1200;

const smooth = (p) => p * p * (3 - 2 * p);
const mix = (a, b, p) => a.map((v, k) => v + (b[k] - v) * p);
const blend = (from, to, p) => ({ pos: mix(from.pos, to.pos, p), target: mix(from.target, to.target, p), fov: from.fov + (to.fov - from.fov) * p });

// The camera for `phase` at `t` ms into it. Under reduced motion a swoop or pullback is its end shot at once.
export function shotAt(phase, t, mapShot, chaseShot, { reduced = false } = {}) {
  switch (phase) {
    case 'chase': return chaseShot;
    case 'swoop': {
      const p = reduced ? 1 : smooth(Math.min(1, Math.max(0, t / SWOOP_MS)));
      return p >= 1 ? chaseShot : blend(mapShot, chaseShot, p);
    }
    case 'pullback': {
      const p = reduced ? 1 : smooth(Math.min(1, Math.max(0, t / PULLBACK_MS)));
      return p >= 1 ? mapShot : blend(chaseShot, mapShot, p); // the swoop played backwards
    }
    default: return mapShot;
  }
}

// Which phase `ms` into a trip of `driveMs` falls in. swoop:false starts straight in the chase view and ends without a pullback.
export function timeline(driveMs, ms, { swoop = true } = {}) {
  const intro = swoop ? SWOOP_MS : 0, outro = swoop ? PULLBACK_MS : 0;
  if (ms < intro) return { phase: 'swoop', t: ms };
  if (ms < intro + driveMs) return { phase: 'chase', t: ms - intro };
  if (ms < intro + driveMs + outro) return { phase: 'pullback', t: ms - intro - driveMs };
  return { phase: 'map', t: ms - intro - driveMs - outro };
}
