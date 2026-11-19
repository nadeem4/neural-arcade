// The camera director: map, swoop in, chase while driving, pull back, map. Pure keyframe maths, no DOM, no three.js.
// A shot is { pos: [x, y, z], target: [x, y, z], fov }.
export const SWOOP_MS = 1400;
export const PULLBACK_MS = 1200;

const smooth = (p) => p * p * (3 - 2 * p);
// The crane between the chase shot and the map shot, p of the way to the map (p is time, eased here). The height moves with q, the ground position
// with q^1.5, so leaving the chase the camera rises over the taxi before it pulls away (and the swoop, played backwards, comes down last).
// roof(x, z) is the height the camera must keep over a ground point (scene-math roofAt): the ground position holds wherever its next stretch is
// under a roof, the camera climbs (CLIMB m a ms) until it clears it, then catches up. That is worked out in fixed steps from the chase end, so
// the shot is a pure function of p and starts exactly on the chase shot. The view is blended apart from the position: its compass angle the short
// way round and its pitch (below), so it never spins as the camera passes over the taxi and is never steeper than the steeper of the two shots.
// push(x, z, y) -> [dx, dz] | null (scene-math wallPush): below a roof beside a wall the camera also drifts away from it (DRIFT m a ms), so a pull-back that
// starts hugging a tower leaves its face instead of rising up it; the drift is gone between those two values of p, long after the camera is over the roofs.
const STEPS = 160, CATCH_UP = 2, CLIMB = 1, LOOK = 3, DRIFT = 0.25, DRIFT_END = [0.25, 0.5]; // CATCH_UP: ground progress per unit of p, a little over the plain path's own top speed (about 1.75)
const lookOf = (s) => { const v = s.target.map((x, k) => x - s.pos[k]), r = Math.hypot(...v); return { r, yaw: Math.atan2(v[0], v[2]), pitch: Math.asin(v[1] / r) }; };
const crane = (chase, map, p, roof, push, len) => {
  if (p <= 0) return chase;
  if (p >= 1) return map;
  const ground = (k) => [chase.pos[0] + (map.pos[0] - chase.pos[0]) * k, chase.pos[2] + (map.pos[2] - chase.pos[2]) * k];
  const height = (q) => chase.pos[1] + (map.pos[1] - chase.pos[1]) * q;
  const clear = (k0, k1, y) => { // every LOOK m of the ground from k0 to k1 is open at height y
    const a = ground(k0), b = ground(k1), n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / LOOK));
    for (let i = 1; i <= n; i++) if (roof(a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n) > y) return false;
    return true;
  };
  let k = 0, lift = 0, ox = 0, oz = 0;
  for (let s = 0; s < p - 1e-12;) {
    const h = Math.min(1 / STEPS, p - s), q = smooth((s += h)), next = Math.min(q ** 1.5, k + CATCH_UP * h);
    if (next > k && !clear(k, next, height(q) + lift)) lift += CLIMB * h * len; // blocked: hold and climb
    else { if (next > k) k = next; lift = Math.max(0, lift - CLIMB * h * len, roof(...ground(k)) - height(q)); } // open: move on, and settle back onto the path
    const [gx, gz] = ground(k), away = push(gx + ox, gz + oz, height(q) + lift);
    if (away) { ox += away[0] * DRIFT * h * len; oz += away[1] * DRIFT * h * len; }
  }
  const fade = 1 - smooth(Math.min(1, Math.max(0, (p - DRIFT_END[0]) / (DRIFT_END[1] - DRIFT_END[0]))));
  const q = smooth(p), [gx, gz] = ground(k), x = gx + ox * fade, z = gz + oz * fade, pos = [x, height(q) + lift, z];
  const a = lookOf(chase), b = lookOf(map), turn = Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw));
  // The view settles on the map's angle by halfway, fast at first (an ease-out), so as the camera rises it looks down at the street, not out at the haze.
  const w = 1 - (1 - Math.min(1, 2 * q)) ** 2;
  const yaw = a.yaw + turn * w, pitch = a.pitch + (b.pitch - a.pitch) * w, r = a.r + (b.r - a.r) * q, cp = Math.cos(pitch);
  return { pos, target: [x + Math.sin(yaw) * cp * r, pos[1] + Math.sin(pitch) * r, z + Math.cos(yaw) * cp * r], fov: chase.fov + (map.fov - chase.fov) * q };
};

// The camera for `phase` at `t` ms into it. Under reduced motion a swoop or pullback is its end shot at once. roof: see crane (none by default).
export function shotAt(phase, t, mapShot, chaseShot, { reduced = false, roof = () => 0, push = () => null } = {}) {
  switch (phase) {
    case 'chase': return chaseShot;
    case 'swoop': {
      const p = reduced ? 1 : Math.min(1, Math.max(0, t / SWOOP_MS));
      return crane(chaseShot, mapShot, 1 - p, roof, push, SWOOP_MS);
    }
    case 'pullback': {
      const p = reduced ? 1 : Math.min(1, Math.max(0, t / PULLBACK_MS));
      return crane(chaseShot, mapShot, p, roof, push, PULLBACK_MS); // the swoop played backwards
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
