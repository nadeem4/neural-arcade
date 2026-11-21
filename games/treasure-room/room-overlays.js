// Treasure Room 3D overlays: which ones a level draws, and what each one puts on the floor. Pure: no three.js and no DOM.
// Each overlay is { list(room, opts) -> draw list }; room-overlay-meshes.js turns a list into meshes.
import { ACTIONS } from '../../assets/grid.js';
import { TAG_CAPACITY } from './room-math.js';

const isFloor = (room, x, y) => !'TX#'.includes(room.cells[y][x]);
const clamp01 = h => (h > 0 ? Math.min(1, h) : 0); // NaN and negatives are 0

// The numbers on the floor tiles and the heat tint behind them (the value level). Nothing when there are no values yet.
export function valuesList(room, values, heat) {
  const labels = [], tiles = [];
  if (!values) return { labels, tiles };
  for (let y = 0; y < room.h; y++) for (let x = 0; x < room.w; x++) {
    if (!isFloor(room, x, y)) continue;
    const i = y * room.w + x, text = values[i].toFixed(1);
    labels.push({ x, y, text: text === '-0.0' ? '0.0' : text });
    tiles.push({ x, y, h: clamp01(heat?.[i] ?? 0) });
  }
  return { labels, tiles };
}

// One arrow per floor tile that has a policy action. rotY turns a model that points north.
const COMPASS = { up: ['N', 0], right: ['E', -Math.PI / 2], down: ['S', Math.PI], left: ['W', Math.PI / 2] };
export function arrowsList(room, policy, actions) {
  const out = [];
  if (!policy) return out;
  for (let y = 0; y < room.h; y++) for (let x = 0; x < room.w; x++) {
    if (!isFloor(room, x, y)) continue;
    const name = actions[policy[y * room.w + x]]?.name, c = COMPASS[name];
    if (c) out.push({ x, y, dir: c[0], rotY: c[1] });
  }
  return out;
}

// The route the robot takes, one marker per cell, shrinking by gamma per step. ghost is one route or two (the second is faint).
export function trailList(room, ghost, gamma = 1) {
  const list = Array.isArray(ghost) ? (Array.isArray(ghost[0]) ? ghost : [ghost]) : [];
  const kept = list.filter(r => r.length >= 2);
  return {
    routes: kept.map(r => r.map(({ x, y }, i) => ({ x, y, scale: Math.max(0.25, gamma ** i) }))),
    faint: kept.map((_, i) => i === 1),
  };
}

// The reward numbers floating over cells (levels 2, 3 and 6). onEnd tags sit on the treasure or trap.
const TONES = ['step', 'good', 'bad'];
export const tagsList = (room, tags) => (Array.isArray(tags) ? tags : []).slice(0, TAG_CAPACITY).map(({ x, y, text, tone }) => ({
  x, y, text, tone: TONES.includes(tone) ? tone : 'step', onEnd: 'TX'.includes(room.cells[y]?.[x]),
}));

// The icy floor (level 6): every floor cell when on.
export function iceList(room, ice) {
  const out = [];
  if (!ice) return out;
  for (let y = 0; y < room.h; y++) for (let x = 0; x < room.w; x++) if (isFloor(room, x, y)) out.push({ x, y });
  return out;
}

// The outlined tiles. Part of the base room, not an overlay.
export const marksList = marks => (marks ?? []).map(({ x, y }) => ({ x, y }));

export const OVERLAYS = {
  values: { list: (room, opts) => valuesList(room, opts.values, opts.heat) },
  arrows: { list: (room, opts) => arrowsList(room, opts.policy, ACTIONS) },
  trail: { list: (room, opts) => trailList(room, opts.ghost, opts.gamma) },
  tags: { list: (room, opts) => tagsList(room, opts.tags) },
  ice: { list: (room, opts) => iceList(room, opts.ice) },
};

export const OVERLAYS_FOR_LEVEL = { 1: [], 2: ['tags'], 3: ['trail', 'tags'], 4: ['arrows'], 5: ['values'], 6: ['trail', 'tags', 'ice'] };

export function overlayNames(names) {
  const list = names ?? [];
  for (const n of list) if (!(n in OVERLAYS)) throw new Error(`Unknown overlay: ${n}`);
  return list;
}
