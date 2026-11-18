import { ACTIONS } from './sim.js';
import { RATE_KEYS } from './reward.js';

// The garage: up to four kept taxis, newest first. Pure, no DOM and no storage.
// A kept taxi stores its rates, its greedy route and the analysis of that route, not the Q-table:
// training is deterministic given SEED, so the route is the whole artefact. DRIVE replays it through tripEvents.
export const MAX_TAXIS = 4;

export const createGarage = (max = MAX_TAXIS) => ({ max, taxis: [] });

const sameTaxi = (a, b) => JSON.stringify([a.rewards, a.route]) === JSON.stringify([b.rewards, b.route]);

// Adds a taxi at the front. The same rates and route again replaces it in place of a copy, keeping its
// id, name and note and the best time; when full, the oldest by keptAt drops.
export function keep(garage, entry) {
  const old = garage.taxis.find(t => sameTaxi(t, entry));
  const added = old
    ? { ...entry, id: old.id, name: old.name, note: old.note, bestSeconds: Math.min(old.bestSeconds, entry.bestSeconds) }
    : entry;
  let taxis = [added, ...garage.taxis.filter(t => t !== old)];
  while (taxis.length > garage.max) {
    const oldest = taxis.reduce((a, b) => (b.keptAt < a.keptAt ? b : a));
    taxis = taxis.filter(t => t !== oldest);
  }
  return { ...garage, taxis };
}

export const remove = (garage, id) => ({ ...garage, taxis: garage.taxis.filter(t => t.id !== id) });

export const serialize = garage => JSON.stringify({ v: 1, taxis: garage.taxis });

const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const isInt = (x, lo, hi) => Number.isInteger(x) && x >= lo && x < hi;
export const MAX_ROUTE = 5000;

// A taxi is replayable only if its route fits the map and the move list; storage can hold anything, so check before use.
export function validTaxi(t, cellCount = Infinity) {
  if (!isObj(t) || typeof t.id !== 'string' || typeof t.name !== 'string' || !isObj(t.analysis)) return false;
  if (!Number.isFinite(t.bestSeconds) || !Number.isFinite(t.keptAt) || !Number.isInteger(t.tries)) return false;
  if (!isObj(t.rewards) || !RATE_KEYS.every(k => Number.isFinite(t.rewards[k]))) return false;
  const r = t.route;
  if (!isObj(r) || !Array.isArray(r.cells) || !Array.isArray(r.actions)) return false;
  if (r.actions.length > MAX_ROUTE || r.cells.length !== r.actions.length + 1) return false;
  return r.cells.every(c => isInt(c, 0, cellCount)) && r.actions.every(a => isInt(a, 0, ACTIONS.length));
}

// Bad JSON, a wrong version or a wrong shape gives an empty garage; it never throws. Bad entries are dropped one by one.
export function parse(text, { max = MAX_TAXIS, cellCount = Infinity } = {}) {
  try {
    const data = JSON.parse(text);
    if (!isObj(data) || data.v !== 1 || !Array.isArray(data.taxis)) return createGarage(max);
    return { max, taxis: data.taxis.filter(t => validTaxi(t, cellCount)).slice(0, max) };
  } catch {
    return createGarage(max);
  }
}
