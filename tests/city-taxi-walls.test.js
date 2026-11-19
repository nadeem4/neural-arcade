import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadWorld } from '../games/city/sim.js';
import { tripEvents } from '../games/city/events.js';
import { legalRoute } from '../games/city/honest.js';
import { routeFrames, tickMsFor } from '../games/city/playback.js';
import { driveTrack, stateAt } from '../games/city/drive.js';
import { solidRings, clearOfWalls } from '../games/city/walls.js';
import { lampSpecs, pairRails, railColumns, columnLegs } from '../games/city/street-furniture.js';
import { headPlacement } from '../games/city/signal-heads.js';

const read = (f) => JSON.parse(readFileSync(new URL('../games/city/' + f, import.meta.url), 'utf8'));
const city = read('chicago.json');
const world = loadWorld(city);
const story = read('story.json');

// The taxi's drawn footprint: 1.9 m x 4.2 m, scaled, at the drawn pose (forward = (sin h, cos h) in x, z; z = -map y).
const HW = 0.95 * 1.5, HL = 2.1 * 1.5; // the model half sizes times TAXI_SCALE (1.5)
function footprint(st) {
  const fx = Math.sin(st.heading), fz = Math.cos(st.heading), rx = fz, rz = -fx;
  const pts = [];
  for (let i = 0; i <= 8; i++) for (let j = 0; j <= 16; j++) {
    const a = -HW + (2 * HW * i) / 8, b = -HL + (2 * HL * j) / 16;
    pts.push([st.x + rx * a + fx * b, st.z + rz * a + fz * b]);
  }
  return pts;
}
const inRing = (x, y, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
// Solid buildings: drawn outlines that touch the ground (a bridge between towers is raised, the taxi passes beneath).
const solid = city.buildings.filter((b) => !(b.hasParts && !b.part) && (b.minH ?? 0) < 2).map((b) => ({ ring: b.ring, bb: bbox(b.ring) }));
function bbox(r) { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const [x, y] of r) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return [x0, y0, x1, y1]; }

// How many sampled moments (every 100 ms) the taxi box has a point inside a building footprint.
export function wallHits(rewards, route) {
  const events = tripEvents(world, rewards, route);
  const frames = routeFrames(world, city.cellM, route);
  const track = driveTrack(frames, events, { tickMs: tickMsFor(frames.length), walls: solidRings(city) });
  let hits = 0;
  for (let ms = 0; ms <= track.total; ms += 100) {
    const st = stateAt(track, ms);
    const bad = footprint(st).some(([x, z]) => solid.some((s) => x >= s.bb[0] && x <= s.bb[2] && -z >= s.bb[1] && -z <= s.bb[3] && inRing(x, -z, s.ring)));
    if (bad) hits++;
  }
  return hits;
}

describe('the taxi never sinks into a building', () => {
  for (const card of story.cards) {
    it(`${card.id} card, seed 1`, () => expect(wallHits(card.rewards, card.route)).toBe(0));
  }
  it('the honest route', () => {
    const route = legalRoute(world);
    expect(wallHits({ fare: 100, time: 1, off: 20, red: 30, wrong: 30, perTile: 0 }, route)).toBe(0);
  });
});

describe('clearOfWalls', () => {
  const square = [{ ring: [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]], box: [0, 0, 10, 10] }];
  it('leaves a clear car alone', () => expect(clearOfWalls(-20, 0, 0, square)).toMatchObject({ x: -20, z: 0, heading: 0 }));
  it('moves a car that overlaps a wall out, by about the overlap', () => {
    const out = clearOfWalls(-1, -5, 0, square); // facing +z, 2.85 m wide, centre 1 m from the wall at x = 0
    expect(out.x).toBeLessThan(-1.4);
    expect(out.x).toBeGreaterThan(-2.0);
    expect(out.z).toBeCloseTo(-5, 1);
  });
});

// Posts the drawn taxi must not touch: street lamps, signal poles and the L's columns, each as a circle (poles about 0.3 m, legs 0.7 m square).
const roads = city.roads ?? [];
const poles = (city.signalHeads ?? []).map((h) => { const p = headPlacement(h, roads); return { x: p.x, z: -p.y, r: 0.3 }; });
const lamps = lampSpecs(city.lamps ?? [], roads, poles).map((p) => ({ ...p, r: 0.3 }));
const legs = pairRails(city.rail ?? []).filter((r) => r.elevated)
  .flatMap((r) => railColumns(r.pts, roads, { sep: r.sep ?? 0 }).flatMap((k) => columnLegs(k).map(([x, z]) => ({ x, z, r: 0.5 }))));
function postHits(posts, rewards, route) {
  const events = tripEvents(world, rewards, route);
  const frames = routeFrames(world, city.cellM, route);
  const track = driveTrack(frames, events, { tickMs: tickMsFor(frames.length), walls: solidRings(city) });
  let hits = 0;
  for (let ms = 0; ms <= track.total; ms += 100) {
    const st = stateAt(track, ms), fx = Math.sin(st.heading), fz = Math.cos(st.heading);
    if (posts.some((p) => { // inside the box grown by the post's radius
      const dx = p.x - st.x, dz = p.z - st.z, along = dx * fx + dz * fz, across = dx * fz - dz * fx;
      return Math.hypot(Math.max(Math.abs(along) - HL, 0), Math.max(Math.abs(across) - HW, 0)) < p.r;
    })) hits++;
  }
  return hits;
}
describe('the taxi never drives through a post', () => {
  for (const [name, posts] of [['street lamp', lamps], ['signal pole', poles], ['L column', legs]]) {
    it(`${name}s, every card`, () => {
      const counts = story.cards.map((c) => postHits(posts, c.rewards, c.route));
      if (process.env.DBG) console.log('POSTS', name, posts.length, counts);
      expect(counts).toEqual(counts.map(() => 0));
    });
  }
});
