// Traffic signals as the taxi sees them. Pure, no DOM, no three.js.
import { lightRed } from './sim.js';

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

// A mapped head beside a road with bearing `dirDeg` (0 to 179, clockwise from north) controls traffic along that road, both ways.
// Both ways are on one phase (the sim keys red on the north-south or east-west axis), so a head has one state: the one signalState gives a taxi on that road.
export const headAxis = (dirDeg) => headingAction(Math.PI - (dirDeg * Math.PI) / 180) % 2;
export function headState(world, tick, dirDeg) {
  return lightRed(world, tick, headAxis(dirDeg)) ? 'stop' : 'go';
}
