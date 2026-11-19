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

// The race camera: behind and above the midpoint of the two cars, rising and pulling back as they spread apart (up to a limit), so both stay in view.
// a and b are { x, z, heading }; the view faces the way the two cars head on average.
const RACE = { back: 26, up: 34, backPer: 0.4, upPer: 0.75, maxBack: 160, maxUp: 300 };
export function raceShot(a, b, { fov = 55 } = {}) {
  const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
  const h = Math.atan2(Math.sin(a.heading) + Math.sin(b.heading), Math.cos(a.heading) + Math.cos(b.heading));
  const fx = Math.sin(h), fz = Math.cos(h), gap = Math.hypot(a.x - b.x, a.z - b.z);
  const back = Math.min(RACE.maxBack, RACE.back + gap * RACE.backPer), up = Math.min(RACE.maxUp, RACE.up + gap * RACE.upPer);
  return { pos: [mx - fx * back, up, mz - fz * back], target: [mx, 1, mz], fov };
}

// The overhead footage shot: high above centre ([x, z], the taxi), a little south of straight down so north stays up and tall buildings
// lean away from the taxi. The height is set by spread (metres from the centre, plus a margin of road) and the screen's aspect (width / height),
// so a cut uses one height for its whole length (cuts.js).
const OVERHEAD = { fov: 22, pad: 25, tilt: 0.03, min: 360, max: 800 }; // a long lens from above the tallest tower (346 m), so no building hides the road
export function overheadShot([cx, cz], { aspect = 1.6, spread = 0 } = {}) {
  const t = Math.tan((OVERHEAD.fov * Math.PI) / 360);
  const need = Math.max((spread + OVERHEAD.pad) / (t * aspect), (spread + OVERHEAD.pad) / t);
  const h = Math.min(OVERHEAD.max, Math.max(OVERHEAD.min, need));
  return { pos: [cx, h, cz + h * OVERHEAD.tilt], target: [cx, 0, cz], fov: OVERHEAD.fov };
}

// Which phase `ms` into a trip of `driveMs` falls in. swoop:false starts straight in the chase view and ends without a pullback.
export function timeline(driveMs, ms, { swoop = true } = {}) {
  const intro = swoop ? SWOOP_MS : 0, outro = swoop ? PULLBACK_MS : 0;
  if (ms < intro) return { phase: 'swoop', t: ms };
  if (ms < intro + driveMs) return { phase: 'chase', t: ms - intro };
  if (ms < intro + driveMs + outro) return { phase: 'pullback', t: ms - intro - driveMs };
  return { phase: 'map', t: ms - intro - driveMs - outro };
}
