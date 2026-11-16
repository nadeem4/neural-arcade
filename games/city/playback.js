// Reward City playback maths: pure, no DOM, no three.js.
import { cellCentre } from './geometry.js';
import { STEP_CAP } from './presets.js';

// False when the visitor asked for reduced motion; true when matchMedia is missing.
export function motionAllowed(mq = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')) {
  return !mq?.matches;
}

// One frame per second of the route (start plus one per action, at most STEP_CAP actions).
// Heading is radians with forward = (sin h, cos h) in (x, z); north is -z. A wait keeps the last heading.
export function routeFrames(world, cellM, route) {
  const city = { cellM, rows: world.rows };
  const n = Math.min(route.actions.length, STEP_CAP, route.cells.length - 1);
  const frames = [];
  let heading = Math.PI; // facing north until the first move
  let prev = null;
  for (let i = 0; i <= n; i++) {
    const cell = route.cells[i];
    const [x, z] = cellCentre(cell % world.cols, Math.floor(cell / world.cols), city);
    if (prev) {
      const dx = x - prev.x, dz = z - prev.z;
      if (dx || dz) heading = Math.atan2(dx, dz);
    }
    prev = { x, z, heading, tick: i };
    frames.push(prev);
  }
  return frames;
}

// 0 = north-south green (east-west red), 1 = swapped; agrees with sim.js lightRed.
export const lightPhase = (world, tick) => (tick % world.period >= world.period / 2 ? 1 : 0);

export function chaseCamera(frame, { back = 14, up = 7, ahead = 0 } = {}) {
  const fx = Math.sin(frame.heading), fz = Math.cos(frame.heading);
  return {
    pos: [frame.x - fx * back, up, frame.z - fz * back],
    target: [frame.x + fx * ahead, 1, frame.z + fz * ahead],
  };
}

// Black at zero (draw it additively or with the count as alpha), rising to bright orange.
export function heatColour(count, max) {
  const t = max > 0 && count > 0 ? Math.min(1, count / max) : 0;
  return [t, 0.55 * t, 0.1 * t];
}

export const TICK_MS = 400;
// A drive takes at most about 20 s: a long (capped) route plays faster than one step per 400 ms.
export const tickMsFor = (nFrames, maxMs = 20000) => Math.min(TICK_MS, Math.floor(maxMs / Math.max(1, nFrames - 1)));

// The taxi at `ms` into the drive: linear between frames, turning to the new heading in the first third of each move.
// `tick` is the frame it is leaving, so lights match the step being taken; `done` once the last frame is reached.
export function frameAt(frames, ms, tickMs = TICK_MS) {
  const last = frames.length - 1;
  const t = Math.max(0, ms) / tickMs;
  if (last <= 0 || t >= last) return { ...frames[last], done: true };
  const i = Math.floor(t), u = t - i, a = frames[i], b = frames[i + 1];
  const turn = Math.atan2(Math.sin(b.heading - a.heading), Math.cos(b.heading - a.heading));
  return {
    x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u,
    heading: a.heading + turn * Math.min(1, u * 3), tick: a.tick, done: false,
  };
}
