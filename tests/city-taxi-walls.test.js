import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadWorld } from '../games/city/sim.js';
import { tripEvents } from '../games/city/events.js';
import { legalRoute } from '../games/city/honest.js';
import { routeFrames, tickMsFor } from '../games/city/playback.js';
import { driveTrack, stateAt, rawStateAt } from '../games/city/drive.js';
import { solidRings, clearOffsets } from '../games/city/walls.js';
import { lampSpecs, pairRails, railColumns, columnLegs } from '../games/city/street-furniture.js';
import { headPlacement } from '../games/city/signal-heads.js';
import { bakePeople, newPoses as newPeoplePoses } from '../games/city/people.js';

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
  for (let ms = 0; ms <= track.total; ms += 50) {
    const st = stateAt(track, ms);
    const bad = footprint(st).some(([x, z]) => solid.some((s) => x >= s.bb[0] && x <= s.bb[2] && -z >= s.bb[1] && -z <= s.bb[3] && inRing(x, -z, s.ring)));
    if (bad) hits++;
  }
  return hits;
}

// The mile card has 7 tiles where no clear place exists, both in the map data, not the drawing (checked pose by pose, shifts up to 6 m):
// tiles 12 to 15 (cells 18,73 and 18,74): a dead-end pocket beside a building (x 222.9 to 237.6) whose width is less than the car's
// 6.3 m length, so the car cannot swing round at 90 degrees; tiles 20 and 21 (cells 12,74 and 13,74): a 1.9 m gap between two buildings, narrower than the 2.85 m car.
// The sim's route is what is too tight. Every other card is clear everywhere.
const PINCHED = { mile: 7 };
const clean = story.cards.filter((c) => !PINCHED[c.id]);
describe('the taxi never sinks into a building', () => {
  for (const card of clean) {
    it(`${card.id} card, seed 1`, () => expect(wallHits(card.rewards, card.route)).toBe(0));
  }
  it('the honest route', () => {
    const route = legalRoute(world);
    expect(wallHits({ fare: 100, time: 1, off: 20, red: 30, wrong: 30, perTile: 0 }, route)).toBe(0);
  });
});

// One shift per route tile, eased between tiles: the drawn car never snaps, never turns, and no tile is left blocked.
const driveOf = (rewards, route) => {
  const events = tripEvents(world, rewards, route);
  const frames = routeFrames(world, city.cellM, route);
  return driveTrack(frames, events, { tickMs: tickMsFor(frames.length), walls: solidRings(city) });
};
const honest = () => ({ route: legalRoute(world), rewards: { fare: 100, time: 1, off: 20, red: 30, wrong: 30, perTile: 0 } });
describe('the nudge is one shift per tile, eased', () => {
  for (const card of clean) {
    it(`${card.id} card: moves under 0.2 m more than the raw drive in any 1/60 s frame, and no tile is left blocked`, () => {
      const track = driveOf(card.rewards, card.route);
      let worst = 0, prev = null;
      for (let ms = 0; ms <= track.total; ms += 1000 / 60) {
        const s = stateAt(track, ms), r = rawStateAt(track, ms), d = [s.x - r.x, s.z - r.z];
        expect(s.heading).toBe(r.heading); // the nudge never turns the car
        if (prev) worst = Math.max(worst, Math.hypot(d[0] - prev[0], d[1] - prev[1]));
        prev = d;
      }
      if (process.env.DBG) console.log('WORST', card.id, worst.toFixed(3));
      expect(worst).toBeLessThan(0.2);
      expect(track.unclear).toBe(0);
    });
  }
  it('the mile card has only its known dead-end tiles blocked', () => {
    const c = story.cards.find((x) => x.id === 'mile');
    expect(driveOf(c.rewards, c.route).unclear).toBe(PINCHED.mile);
  });
  it('the honest route leaves no tile blocked', () => {
    const { route, rewards } = honest();
    expect(driveOf(rewards, route).unclear).toBe(0);
  });
  it('the drive is the same twice (a pure function of the trip)', () => {
    const c = story.cards[0], a = driveOf(c.rewards, c.route), b = driveOf(c.rewards, c.route);
    for (const ms of [0, 1234, 5000, 9000]) expect(stateAt(a, ms)).toEqual(stateAt(b, ms));
  });
});

describe('clearOffsets', () => {
  const wall = [{ ring: [[0, -50], [10, -50], [10, 50], [0, 50]], box: [0, -50, 10, 50] }];
  const at = (x) => [{ x, z: 0, heading: 0 }, { x, z: 5, heading: 0 }];
  it('a clear tile gets no shift', () => expect(clearOffsets([at(-20)], wall, 4.5).offsets[0]).toEqual([0, 0]));
  it('a tile against a wall gets the smallest sideways shift that clears it', () => {
    const { offsets, unclear } = clearOffsets([at(-1)], wall, 4.5); // 2.85 m wide car, centre 1 m from the wall
    expect(unclear).toBe(0);
    expect(offsets[0][0]).toBeLessThan(-0.4);
    expect(offsets[0][0]).toBeGreaterThan(-0.8);
  });
  it('a tile that cannot be cleared within the cap is counted', () => {
    expect(clearOffsets([at(5)], wall, 1).unclear).toBe(1); // inside the wall, cap of 1 m
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
  for (let ms = 0; ms <= track.total; ms += 50) {
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
    }, 30000);
  }
});

describe('the nudged taxi never overlaps a person who is not scared', () => {
  for (const c of story.cards) {
    it(`${c.id} card, crowd seeds 1 to 4`, () => {
      const events = tripEvents(world, c.rewards, c.route);
      const frames = routeFrames(world, city.cellM, c.route);
      const track = driveTrack(frames, events, { tickMs: tickMsFor(frames.length), walls: solidRings(city) });
      for (let seed = 1; seed <= 4; seed++) { // the crowd is baked per seed; the car pose does not depend on it
      const crowd = bakePeople(world, city, events, { seed });
      const p = newPeoplePoses(crowd.count);
      let hits = 0;
      for (let ms = 0; ms <= track.total; ms += 50) {
        const st = stateAt(track, ms), fx = Math.sin(st.heading), fz = Math.cos(st.heading);
        crowd.fillPoses(ms / track.tickMs, p);
        for (let i = 0; i < crowd.count; i++) {
          if (p.scared[i]) continue;
          const dx = p.x[i] - st.x, dz = p.z[i] - st.z, along = dx * fx + dz * fz, across = dx * fz - dz * fx;
          if (Math.abs(along) < HL + 0.25 && Math.abs(across) < HW + 0.25) hits++;
        }
      }
        expect(hits, c.id + " seed " + seed).toBe(0);
      }
    });
  }
});
