// Two kept taxis, one trip, one clock. Pure, no DOM and no three.js.
// Both cars start at the pickup on tick 0, so the lights are the same for both; each car has its own events and meter.
import { cellCentre } from './geometry.js';
import { routeFrames, tickMsFor } from './playback.js';
import { tripEvents } from './events.js';
import { driveTrack, stateAt } from './drive.js';
import { meterAt } from './meter.js';

export const MAX_PICK = 2;
// Car A is the yellow taxi, car B is tinted pink; the same colours drive the 3D cars, the meters and the minimap.
export const TINTS = [
  { body: '#F5B820', cab: '#FFD25A', route: '#5BC0EB', css: '#F5B820' },
  { body: '#E8589C', cab: '#FF8DBB', route: '#FF7AB6', css: '#FF7AB6' },
];

// The picks after tapping a taxi's Race toggle: on, off, or (a third) in place of the oldest pick.
export function togglePick(picks, id) {
  if (picks.includes(id)) return picks.filter(p => p !== id);
  return [...picks, id].slice(-MAX_PICK);
}

// entries are two valid kept taxis. Their routes must start at the same pickup. One tick length for both,
// the shorter of the two, so the same tick means the same moment for each car.
export function raceTracks(world, cellM, entries, walls = null) {
  const [a, b] = entries;
  if (a.route.cells[0] !== b.route.cells[0]) throw new Error('A race needs the same pickup for both taxis');
  const frames = entries.map(e => routeFrames(world, cellM, e.route));
  const tickMs = Math.min(...frames.map(f => tickMsFor(f.length)));
  const cars = entries.map((entry, i) => {
    const events = tripEvents(world, entry.rewards, entry.route);
    return { entry, events, track: driveTrack(frames[i], events, { tickMs, walls }) };
  });
  const goal = cellCentre(world.goal % world.cols, Math.floor(world.goal / world.cols), { cellM, rows: world.rows });
  return { cars, tickMs, total: Math.max(...cars.map(c => c.track.total)), goal: { x: goal[0], z: goal[1] } };
}

// Both cars `ms` into the race. Past the end the clock stops: every car is where it finished, with its full meter.
export function raceStateAt(race, ms) {
  const t = Math.min(Math.max(0, ms), race.total);
  const cars = race.cars.map(c => {
    const state = stateAt(c.track, t);
    return { state, meter: meterAt(c.events, state.progress), finished: state.done };
  });
  const dist = cars.map(c => Math.hypot(c.state.x - race.goal.x, c.state.z - race.goal.z));
  const gap = Math.abs(dist[0] - dist[1]);
  // tick is the shared light clock: the lights run for the whole race, whichever car has finished.
  return { cars, tick: Math.floor(t / race.tickMs), leader: gap < 1e-6 ? null : dist[0] < dist[1] ? 0 : 1, done: cars.every(c => c.finished) };
}

// Sound in a race is the leader's only, to avoid noise. `done` is how many steps each car has already been through;
// returns the leader's newly finished steps and the new counts (the trailing car's count moves on without a sound).
export function leaderBlips(race, rs, done) {
  const next = rs.cars.map((c, i) => Math.min(c.state.stepIndex, race.cars[i].events.steps.length));
  // A car that has finished is silent while the other still drives; that one is the voice until it arrives.
  const driving = rs.cars.findIndex(c => !c.finished);
  const voice = rs.cars.some(c => c.finished) && driving >= 0 ? driving : rs.leader;
  const steps = voice === null ? [] : race.cars[voice].events.steps.slice(done[voice], next[voice]);
  return { steps, done: next };
}

// Who won. Arriving beats not arriving; then fewer seconds; equal seconds is a dead heat, whatever each earned.
// by is the gap in seconds (null when only one taxi arrived).
export function result(race) {
  const [a, b] = race.cars.map(c => c.events.totals);
  if (!a.arrived && !b.arrived) return { winner: 'tie', by: 0, reason: 'none' };
  if (a.arrived !== b.arrived) return { winner: a.arrived ? 0 : 1, by: null, reason: 'arrived' };
  if (a.seconds !== b.seconds) return { winner: a.seconds < b.seconds ? 0 : 1, by: Math.abs(a.seconds - b.seconds), reason: 'time' };
  return { winner: 'tie', by: 0, reason: 'time' }; // pay never decides a race: the earner is not the winner
}

// The line in the garage's race bar for the names picked so far.
export function raceBarLine(names) {
  if (names.length === 0) return '';
  if (names.length < MAX_PICK) return `Pick one more taxi to race ${names[0]}`;
  return `Race: ${names[0]} vs ${names[1]}, same pickup, same lights`;
}

// The banner headline for a result.
export function bannerLine(res, names) {
  if (res.winner === 'tie') return res.reason === 'none' ? 'Neither taxi arrived' : 'A dead heat';
  const win = names[res.winner], lose = names[1 - res.winner];
  if (res.reason === 'arrived') return `${win} wins: ${lose} never arrived`;
  return `${win} wins by ${res.by} s`;
}
