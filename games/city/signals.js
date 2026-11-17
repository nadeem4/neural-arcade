// Traffic signals as the taxi sees them. Pure, no DOM, no three.js.
import { lightRed } from './sim.js';
import { cellCentre } from './geometry.js';

// Heading (radians, forward = (sin h, cos h), north is -z) to the nearest sim action: 0 north, 1 east, 2 south, 3 west.
export function headingAction(heading) {
  const fx = Math.sin(heading), fz = Math.cos(heading);
  if (Math.abs(fz) >= Math.abs(fx)) return fz < 0 ? 0 : 2;
  return fx > 0 ? 1 : 3;
}

// 'stop' exactly when the sim would fine entering this signal cell travelling in `heading` at `tick`; only the taxi's own direction.
export function signalState(world, cell, heading, tick) {
  if (!world.signal[cell]) return 'go';
  return lightRed(world, tick, headingAction(heading)) ? 'stop' : 'go';
}

// Where the lamp stands: the corner of the signal's cell (east, south side), never on the carriageway centre line.
export function signalCorners(world, cell, cellM) {
  const [x, z] = cellCentre(cell % world.cols, Math.floor(cell / world.cols), { cellM, rows: world.rows });
  return { x: x + cellM / 2, z: z + cellM / 2 };
}
