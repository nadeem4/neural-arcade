// Smooth driving for one trip, drawn from the same route and events as the sim. Pure, no DOM.
// The policy still moves one tile per tick; here each tick becomes a glide with eased speed, turns through corners
// and a stop for every wait (red lights and the like). Presentation only: it never changes what the sim decided.
import { tickMsFor } from './playback.js';
import { ringsNear, fitShifts, shiftAt, smooth, SHIFT_CAP, PER } from './walls.js';

const TURN_IN = 0.45;  // a U-turn (no arc is possible): stop, then swing round while pulling away from rest (the first 45% of the tile)

const diff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a)); // shortest signed turn from a to b
const angle = (a, b) => Math.abs(diff(a, b));
const towards = (a, b, t) => a + diff(a, b) * t;

// Position along a tile as a cubic with end slopes m0 and m1 (0 = at rest, 1 = cruising); f(0)=0, f(1)=1.
function ease(u, m0, m1) {
  const u2 = u * u, u3 = u2 * u;
  const f = (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) + (u3 - u2) * m1;
  const df = (3 * u2 - 4 * u + 1) * m0 + (-6 * u2 + 6 * u) + (3 * u2 - 2 * u) * m1;
  return [f, df];
}

// A corner between two moves is one circular arc, tangent to both streets, that starts and ends half a tile either side of
// the tile centre P (radius = half a tile, so the car stays on its own lane's tile). Heading follows the arc, so the car
// never slides: it points where it goes. The car passes the arc's middle exactly at the tick boundary.
const rot = (x, z, a) => [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)]; // turn (x, z) the way heading turns
function cornerAt(P, h1, h2, prev, next) {
  const th = diff(h1, h2);
  if (Math.abs(th) < 0.2 || Math.abs(th) > 2.9) return null; // straight, or a U-turn (stop and turn on the spot)
  const R = Math.min(Math.hypot(P.x - prev.x, P.z - prev.z), Math.hypot(next.x - P.x, next.z - P.z)) / 2;
  const d1 = [Math.sin(h1), Math.cos(h1)], d2 = [Math.sin(h2), Math.cos(h2)];
  const S = [P.x - d1[0] * R, P.z - d1[1] * R];
  const C = [S[0] + d2[0] * R, S[1] + d2[1] * R];
  return { th, R, h1, C, r0: [S[0] - C[0], S[1] - C[1]], len: Math.abs(th) * R };
}
// At a corner tick boundary the taxi is on the arc's middle, about 0.21 cell from the cell centre but still inside the cell.
// The point and heading a fraction t (0..1) round the arc.
function arcAt(c, t) {
  const [rx, rz] = rot(c.r0[0], c.r0[1], c.th * t);
  return { x: c.C[0] + rx, z: c.C[1] + rz, heading: c.h1 + c.th * t, curvature: Math.sign(c.th) / c.R };
}

// The path of move i as pieces (a straight, or half an arc), each with a length and at(s) -> { x, z, heading, curvature }.
function movePath(frames, i, cin, cout, h1) {
  const a = frames[i], b = frames[i + 1];
  const pieces = [];
  if (cin) pieces.push({ len: cin.len / 2, at: (s) => arcAt(cin, 0.5 + s / cin.len) });
  const p0 = cin ? arcAt(cin, 1) : a, p1 = cout ? arcAt(cout, 0) : b;
  const dx = p1.x - p0.x, dz = p1.z - p0.z, len = Math.hypot(dx, dz);
  pieces.push({ len, at: (s) => ({ x: p0.x + (len ? dx * s / len : 0), z: p0.z + (len ? dz * s / len : 0), heading: h1, curvature: 0 }) });
  if (cout) pieces.push({ len: cout.len / 2, at: (s) => arcAt(cout, s / cout.len) });
  return { pieces, len: pieces.reduce((t, p) => t + p.len, 0) };
}
function pathAt(path, s) {
  let rest = Math.max(0, Math.min(path.len, s));
  for (const p of path.pieces) {
    if (rest <= p.len) return p.at(rest);
    rest -= p.len;
  }
  const last = path.pieces[path.pieces.length - 1];
  return last.at(last.len);
}

// segs[i] describes tick i. A move has h0, h1, h2: the heading before, during and after it, and its path and the distance
// driven before it (dist0). A wait has from and to.
// `walls` (optional) is walls.js solidRings(city): each tile gets one small sideways shift (found once, here) that keeps the drawn car
// clear of buildings, lamps and poles; stateAt eases it between tiles. unclear counts tiles where no shift within the cap cleared the car.
export function driveTrack(frames, events, { tickMs = tickMsFor(frames.length), walls = null } = {}) {
  const n = frames.length - 1;
  const stepAt = (i) => events.steps[i];
  const isWait = (i) => i >= 0 && i < n && (stepAt(i)?.moved === false || (frames[i].x === frames[i + 1].x && frames[i].z === frames[i + 1].z));
  // The heading of the next real move at or after tick i (the last heading if there is none).
  const nextHeading = new Array(n + 1);
  nextHeading[n] = frames[n].heading;
  for (let i = n - 1; i >= 0; i--) nextHeading[i] = isWait(i) ? nextHeading[i + 1] : frames[i + 1].heading;
  const segs = [];
  let hold = nextHeading[0]; // before the first move the car already faces where it will go
  for (let i = 0; i < n; i++) {
    const wait = isWait(i);
    const hb = frames[i + 1].heading;
    const prevMoved = i > 0 && !isWait(i - 1);
    if (wait) {
      // A stopped car turns to face its next move during the first tick of the stop, then holds.
      segs.push({ wait, from: hold, to: nextHeading[i], m0: 0, m1: 0 });
      hold = nextHeading[i];
      continue;
    }
    segs.push({
      wait, prevMoved,
      m0: i === 0 || isWait(i - 1) ? 0 : 1,
      m1: i === n - 1 || isWait(i + 1) ? 0 : 1,
      h0: prevMoved ? frames[i].heading : hold,
      h1: hb,
      h2: i + 1 < n && !isWait(i + 1) ? frames[i + 2].heading : hb,
    });
    hold = hb;
  }
  // Corners sit at the tile centre between two moves with no wait between them; then each move gets its path.
  const corner = new Array(n + 1).fill(null);
  for (let j = 1; j < n; j++) {
    const a = segs[j - 1], b = segs[j];
    if (a.wait || b.wait) continue;
    corner[j] = cornerAt(frames[j], a.h1, b.h1, frames[j - 1], frames[j + 1]);
    if (!corner[j] && angle(a.h1, b.h1) > 2.9) { a.m1 = 0; b.m0 = 0; b.uturn = true; } // a U-turn: brake to a stop first
  }
  let dist = 0;
  segs.forEach((g, i) => {
    g.dist0 = dist;
    if (g.wait) return;
    g.path = movePath(frames, i, corner[i], corner[i + 1], g.h1);
    g.cornerIn = !!corner[i]; // already turned by the arc, so no separate heading easing
    const chord = Math.hypot(frames[i + 1].x - frames[i].x, frames[i + 1].z - frames[i].z);
    if (g.m0) g.m0 = chord / g.path.len; // cruising speed is the same on a straight and on an arc (a shorter path is not driven slower)
    if (g.m1) g.m1 = chord / g.path.len;
    dist += g.path.len;
  });
  const track = { frames, segs, tickMs, total: tickMs * n, length: dist, shifts: null, unclear: 0 };
  if (walls) {
    const poses = [], maxStep = (0.18 * tickMs) / (1000 / 60) / 1.5; // the eased shift moves at most 1.5 x the step per tile: keep it under 0.18 m a 60 fps frame
    for (let k = 0; k <= n * PER; k++) { const { x, z, heading } = rawStateAt(track, Math.min(k / PER, n) * tickMs); poses.push({ x, z, heading }); }
    const { offsets, unclear } = fitShifts(poses, n, ringsNear(walls, frames), SHIFT_CAP, maxStep);
    track.shifts = offsets; track.unclear = unclear;
  }
  return track;
}

// The taxi `ms` into the drive. stepIndex is the tick being driven (the tick count once done), so steps below it are
// complete; facing is the heading of the move being made (not the eased heading), for the signal lamp; progress is stepIndex plus how far through the tile; tick is the light tick, as the sim uses it.
export function stateAt(track, ms) {
  const st = rawStateAt(track, ms), sh = track.shifts;
  if (sh) { const s = shiftAt(sh, Math.max(0, ms) / track.tickMs); st.x += s[0]; st.z += s[1]; } // the tile shifts, eased between tiles
  return st;
}
export function rawStateAt(track, ms) {
  const { frames, segs, tickMs, total } = track;
  const n = segs.length;
  if (n === 0 || ms >= total) {
    const f = frames[n];
    return { x: f.x, z: f.z, heading: f.heading, facing: f.heading, speed: 0, braking: false, curvature: 0, dist: track.length ?? 0, stepIndex: n, progress: n, tick: f.tick, done: true };
  }
  const t = Math.max(0, ms) / tickMs;
  const i = Math.floor(t), u = t - i;
  const s = segs[i], a = frames[i], b = frames[i + 1];
  if (s.wait) {
    return { x: a.x, z: a.z, heading: towards(s.from, s.to, smooth(u)), facing: s.to, speed: 0, braking: true, curvature: 0, dist: s.dist0, stepIndex: i, progress: i, tick: a.tick, done: false };
  }
  // A U-turn has no arc: the car yaws round while creeping away from rest, so it barely moves while it points the wrong way.
  const turning = s.uturn && u < TURN_IN;
  const [f, df] = ease(u, s.m0, s.m1); // the whole tile is driven, so a U-turn exit peaks like any start from rest (about 1.33 x cruise)
  const p = pathAt(s.path, f * s.path.len);
  const heading = turning ? towards(s.h0, s.h1, smooth(u / TURN_IN)) : p.heading;
  return {
    x: p.x, z: p.z, heading, facing: s.h1,
    speed: Math.abs(df) * s.path.len / (tickMs / 1000),
    braking: turning || (s.m1 === 0 && u > 0.5),
    curvature: p.curvature, dist: s.dist0 + f * s.path.len,
    stepIndex: i, progress: i + f, tick: a.tick, done: false,
  };
}
