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

export function chaseCamera(frame, { back = 14, up = 7 } = {}) {
  const fx = Math.sin(frame.heading), fz = Math.cos(frame.heading);
  return {
    pos: [frame.x - fx * back, up, frame.z - fz * back],
    target: [frame.x, 1, frame.z],
  };
}

// Black at zero (draw it additively or with the count as alpha), rising to bright orange.
export function heatColour(count, max) {
  const t = max > 0 && count > 0 ? Math.min(1, count / max) : 0;
  return [t, 0.55 * t, 0.1 * t];
}
