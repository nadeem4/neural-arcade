// Smooth driving for one trip, drawn from the same route and events as the sim. Pure, no DOM.
// The policy still moves one tile per tick; here each tick becomes a glide with eased speed, turns through corners
// and a stop for every wait (red lights and the like). Presentation only: it never changes what the sim decided.
import { tickMsFor } from './playback.js';

const TURN_IN = 0.3;   // first 30% of a tile after a corner: finish the turn
const TURN_OUT = 0.6;  // last 40% of a tile before a corner: start the turn

const smooth = (u) => u * u * (3 - 2 * u);
const diff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a)); // shortest signed turn from a to b
const towards = (a, b, t) => a + diff(a, b) * t;

// Position along a tile as a cubic with end slopes m0 and m1 (0 = at rest, 1 = cruising); f(0)=0, f(1)=1.
function ease(u, m0, m1) {
  const u2 = u * u, u3 = u2 * u;
  const f = (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) + (u3 - u2) * m1;
  const df = (3 * u2 - 4 * u + 1) * m0 + (-6 * u2 + 6 * u) + (3 * u2 - 2 * u) * m1;
  return [f, df];
}

// segs[i] describes tick i. A move has h0, h1, h2: the heading before, during and after it. A wait has from and to.
export function driveTrack(frames, events, { tickMs = tickMsFor(frames.length) } = {}) {
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
  return { frames, segs, tickMs, total: tickMs * n };
}

// The taxi `ms` into the drive. stepIndex is the tick being driven (the tick count once done), so steps below it are
// complete; facing is the heading of the move being made (not the eased heading), for the signal lamp; progress is stepIndex plus how far through the tile; tick is the light tick, as the sim uses it.
export function stateAt(track, ms) {
  const { frames, segs, tickMs, total } = track;
  const n = segs.length;
  if (n === 0 || ms >= total) {
    const f = frames[n];
    return { x: f.x, z: f.z, heading: f.heading, facing: f.heading, speed: 0, braking: false, stepIndex: n, progress: n, tick: f.tick, done: true };
  }
  const t = Math.max(0, ms) / tickMs;
  const i = Math.floor(t), u = t - i;
  const s = segs[i], a = frames[i], b = frames[i + 1];
  if (s.wait) {
    return { x: a.x, z: a.z, heading: towards(s.from, s.to, smooth(u)), facing: s.to, speed: 0, braking: true, stepIndex: i, progress: i, tick: a.tick, done: false };
  }
  const [f, df] = ease(u, s.m0, s.m1);
  let heading = s.h1;
  if (s.h0 !== s.h1 || s.h1 !== s.h2) {
    const from = s.prevMoved ? towards(s.h0, s.h1, 0.5) : s.h0; // a moving car already turned half way at the corner
    const to = towards(s.h1, s.h2, 0.5);
    if (u < TURN_IN) heading = towards(from, s.h1, smooth(u / TURN_IN));
    else if (u > TURN_OUT) heading = towards(s.h1, to, smooth((u - TURN_OUT) / (1 - TURN_OUT)));
  }
  const dist = Math.hypot(b.x - a.x, b.z - a.z);
  return {
    x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, heading, facing: s.h1,
    speed: Math.abs(df) * dist / (tickMs / 1000),
    braking: s.m1 === 0 && u > 0.5,
    stepIndex: i, progress: i + f, tick: a.tick, done: false,
  };
}
