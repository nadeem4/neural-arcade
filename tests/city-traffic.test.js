import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadWorld, lightRed, analyzeRoute, rewardsOf } from '../games/city/sim.js';
import { HYPER } from '../games/city/presets.js';
import { createAgent, trainEpisodes } from '../games/city/train.js';
import { tripEvents } from '../games/city/events.js';
import { routeFrames } from '../games/city/playback.js';
import { driveTrack, stateAt } from '../games/city/drive.js';
import { createTraffic, taxiOf, trafficTier, nearMissCount, newPoses, LANE_M } from '../games/city/traffic.js';

const read = (f) => JSON.parse(readFileSync(new URL('../games/city/' + f, import.meta.url), 'utf8'));
const CITY = read('chicago.json');
const world = loadWorld(CITY);
const cards = read('story.json').cards;
const card = (id) => cards.find((c) => c.id === id);
const taxiFor = (id) => { const { rewards, route } = card(id); return taxiOf(tripEvents(world, rewards, route)); };
const hashOf = (f64) => { let h = 0x811c9dc5; for (const b of new Uint8Array(f64.buffer)) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; } return h; };

// A tiny hand-built city: one straight east-west road, optional signal and one-way.
const strip = (cols, { signalAt = -1, oneway = '' } = {}) => loadWorld({
  cols, rows: 1, cellM: 12, lightPeriod: 8,
  kind: ['r'.repeat(cols)], oneway: [(oneway || '.'.repeat(cols)).padEnd(cols, '.')],
  signals: signalAt >= 0 ? [[signalAt, 0]] : [], pickup: [0, 0], dropoff: [cols - 1, 0],
});
const TICKS = 80;

// Two oriented car boxes (2.85 x 6.3 m, forward = (sin h, cos h)) overlap, by the separating-axis test.
const HW = 1.425, HL = 3.15;
const boxesOverlap = (ax, az, ah, bx, bz, bh) => {
  const dx = bx - ax, dz = bz - az;
  if (dx * dx + dz * dz > 49) return false;
  for (const h of [ah, bh]) for (const [ux, uz] of [[Math.sin(h), Math.cos(h)], [Math.cos(h), -Math.sin(h)]]) {
    const r = (hh) => HL * Math.abs(Math.sin(hh) * ux + Math.cos(hh) * uz) + HW * Math.abs(Math.cos(hh) * ux - Math.sin(hh) * uz);
    if (Math.abs(dx * ux + dz * uz) >= r(ah) + r(bh)) return false;
  }
  return true;
};

describe('traffic is deterministic', () => {
  it('same seed and taxi give the same cars at every tick and the same poses', () => {
    const taxi = taxiFor('walk');
    const a = createTraffic(world, { seed: 3, count: 30, cellM: 12, taxi }), b = createTraffic(world, { seed: 3, count: 30, cellM: 12, taxi });
    a.bakeTo(TICKS); b.bakeTo(TICKS);
    for (let n = 0; n <= TICKS; n++) {
      expect(Array.from(a.snap(n).cell)).toEqual(Array.from(b.snap(n).cell));
      expect(Array.from(a.snap(n).dir)).toEqual(Array.from(b.snap(n).dir));
    }
    const pa = newPoses(30), pb = newPoses(30);
    a.posesAt(17.37, pa); b.posesAt(17.37, pb);
    expect(Array.from(pa.x)).toEqual(Array.from(pb.x));
    expect(Array.from(pa.h)).toEqual(Array.from(pb.h));
  });
  it('asking for a later tick first gives the same state as stepping in order', () => {
    const a = createTraffic(world, { seed: 5, count: 20, cellM: 12 }), b = createTraffic(world, { seed: 5, count: 20, cellM: 12 });
    b.bakeTo(10); b.bakeTo(40);
    expect(Array.from(a.snap(40).cell)).toEqual(Array.from(b.snap(40).cell));
  });
  it('a different seed gives different cars', () => {
    const a = createTraffic(world, { seed: 1, count: 20, cellM: 12 }), b = createTraffic(world, { seed: 2, count: 20, cellM: 12 });
    expect(Array.from(a.snap(0).cell)).not.toEqual(Array.from(b.snap(0).cell));
  });
  it('reads no clock and no Math.random', () => {
    const src = readFileSync(new URL('../games/city/traffic.js', import.meta.url), 'utf8');
    expect(src).not.toMatch(/Math\.random|Date\.now|performance\.now/);
  });
});

describe('cars obey the road', () => {
  const tr = createTraffic(world, { seed: 7, count: 40, cellM: 12, taxi: taxiFor('speed') });
  tr.bakeTo(120);
  it('stay on road cells, in the legal direction, one car to a cell', () => {
    for (let n = 0; n <= 120; n++) {
      const s = tr.snap(n);
      expect(new Set(s.cell).size).toBe(s.cell.length);
      for (let i = 0; i < s.cell.length; i++) {
        expect(world.kind[s.cell[i]]).toBe(0);
        if (n === 0) continue;
        const from = tr.snap(n - 1).cell[i], to = s.cell[i];
        if (from === to) continue;
        const a = s.dir[i];
        expect(Math.abs(from - to) === 1 || Math.abs(from - to) === world.cols).toBe(true);
        for (const o of [world.oneway[from], world.oneway[to]]) if (o >= 0) expect((o + 2) % 4).not.toBe(a);
      }
    }
  });
  it('never enter a signal cell on red, by the sim light function', () => {
    let entries = 0;
    for (let n = 1; n <= 120; n++) {
      const p = tr.snap(n - 1), s = tr.snap(n);
      for (let i = 0; i < s.cell.length; i++) {
        if (p.cell[i] !== s.cell[i] && world.signal[s.cell[i]]) { entries++; expect(lightRed(world, n - 1, s.dir[i])).toBe(false); }
      }
    }
    expect(entries).toBeGreaterThan(0);
  });
  it('actually drive and queue: most cars move, and some wait', () => {
    let movers = 0, waits = 0;
    for (let i = 0; i < 40; i++) {
      let m = 0;
      for (let n = 1; n <= 120; n++) { if (tr.snap(n).cell[i] !== tr.snap(n - 1).cell[i]) m++; else waits++; }
      if (m > 10) movers++;
    }
    expect(movers).toBeGreaterThan(25);
    expect(waits).toBeGreaterThan(0);
  });
  it('a one-way strip is only driven the one way', () => {
    const w = strip(12, { oneway: 'E'.repeat(12) });
    const t = createTraffic(w, { seed: 1, count: 4, cellM: 12 }); t.bakeTo(30);
    for (let n = 1; n <= 30; n++) for (let i = 0; i < 4; i++) expect(t.snap(n).cell[i]).toBeGreaterThanOrEqual(t.snap(n - 1).cell[i]);
  });
  it('a car waits at a red light and goes on green', () => {
    const w = strip(12, { signalAt: 8, oneway: 'E'.repeat(12) });
    const t = createTraffic(w, { seed: 1, count: 6, cellM: 12 }); t.bakeTo(60);
    let waited = 0, crossed = 0;
    for (let n = 1; n <= 60; n++) for (let i = 0; i < 6; i++) {
      const p = t.snap(n - 1).cell[i], c = t.snap(n).cell[i];
      if (p === 7 && c === 7 && lightRed(w, n - 1, 1)) waited++;
      if (p === 7 && c === 8) { crossed++; expect(lightRed(w, n - 1, 1)).toBe(false); }
    }
    expect(waited).toBeGreaterThan(0);
    expect(crossed).toBeGreaterThan(0);
  });
});

describe('cars react to the taxi', () => {
  it('a car stops short of a taxi standing in its lane and never enters its cell', () => {
    const w = strip(12, { oneway: 'E'.repeat(12) });
    const t = createTraffic(w, { seed: 1, count: 2, cellM: 12, taxi: { cells: new Array(60).fill(9), alarm: () => false } });
    t.bakeTo(50);
    for (let n = 0; n <= 50; n++) for (const c of t.snap(n).cell) expect(c).not.toBe(9);
    expect(Math.max(...t.snap(50).cell)).toBeLessThan(9);
  });
  it('no car drives into the taxi: none enters its cell or the next two, on every card', () => {
    const cm = 12;
    for (const c of cards) {
      const taxi = taxiFor(c.id);
      const t = createTraffic(world, { seed: 11, count: 60, cellM: cm, taxi });
      const n = taxi.cells.length - 1;
      t.bakeTo(n + 2);
      for (let k = 1; k <= n; k++) for (let i = 0; i < t.count; i++) {
        if (t.snap(k).cell[i] === t.snap(k - 1).cell[i]) continue;
        for (const j of [-1, 0, 1]) expect(t.snap(k).cell[i]).not.toBe(taxi.cells[Math.min(n, Math.max(0, k + j))]);
      }
    }
  });
  it('no car box ever overlaps the taxi box, stopped cars included, on the real drive of every card', () => {
    for (const c of cards) {
      const events = tripEvents(world, c.rewards, c.route);
      const track = driveTrack(routeFrames(world, 12, c.route), events);
      const t = createTraffic(world, { seed: 1, count: trafficTier().count, cellM: 12, taxi: taxiOf(events) });
      const p = newPoses(t.count);
      let hits = 0;
      for (let ms = 0; ms <= track.total; ms += track.tickMs / 16) {
        const s = stateAt(track, ms);
        t.posesAt(ms / track.tickMs, p);
        for (let i = 0; i < t.count; i++) if (boxesOverlap(s.x, s.z, s.heading, p.x[i], p.z[i], p.h[i])) hits++;
      }
      expect(hits, c.id).toBe(0);
    }
  });
  it('no two car boxes overlap, on every card', () => {
    for (const c of cards) {
      const events = tripEvents(world, c.rewards, c.route);
      const track = driveTrack(routeFrames(world, 12, c.route), events);
      const t = createTraffic(world, { seed: 1, count: trafficTier().count, cellM: 12, taxi: taxiOf(events) });
      const p = newPoses(t.count);
      let hits = 0;
      for (let ms = 0; ms <= track.total; ms += track.tickMs / 16) {
        t.posesAt(ms / track.tickMs, p);
        for (let i = 0; i < t.count; i++) for (let j = i + 1; j < t.count; j++) if (boxesOverlap(p.x[i], p.z[i], p.h[i], p.x[j], p.z[j], p.h[j])) hits++;
      }
      expect(hits, c.id).toBe(0);
    }
  });
  it('cars near a taxi going the wrong way brake hard and honk once; a calm taxi causes none', () => {
    const w = strip(12);
    const base = { seed: 2, count: 6, cellM: 12 };
    const wrong = { steps: [{ red: false, wrong: true, from: 5, cell: 4 }, { red: false, wrong: true, from: 4, cell: 3 }, { red: false, wrong: false, from: 3, cell: 3 }] };
    const t = createTraffic(w, { ...base, taxi: taxiOf(wrong) }); t.bakeTo(6);
    expect(nearMissCount(t)).toBeGreaterThan(0);
    for (const m of t.nearMisses()) { expect(m.kind).toBe('wrong'); expect(m.tick).toBeLessThan(2); }
    const calm = createTraffic(w, { ...base, taxi: taxiOf({ steps: [{ red: false, wrong: false, from: 5, cell: 5 }] }) }); calm.bakeTo(10);
    expect(nearMissCount(calm)).toBe(0);
  });
  it('a red-light run near cars is a near miss of kind red', () => {
    const w = strip(12);
    const t = createTraffic(w, { seed: 2, count: 6, cellM: 12, taxi: taxiOf({ steps: [{ red: true, wrong: false, from: 5, cell: 6 }] }) });
    t.bakeTo(4);
    expect(t.nearMisses().map((m) => m.kind)).toContain('red');
  });
  it('the legal card has no near misses; the red-light card has some, each car honking at most every 4 ticks', () => {
    const run = (id) => { const taxi = taxiFor(id); const t = createTraffic(world, { seed: 4, count: 120, cellM: 12, taxi }); t.bakeTo(taxi.cells.length); return t; };
    expect(nearMissCount(run('legal'))).toBe(0);
    const w = run('walk'), ms = w.nearMisses();
    expect(nearMissCount(w)).toBe(ms.length);
    const seen = new Map();
    for (const m of ms) { expect(m.tick - (seen.get(m.car) ?? -99)).toBeGreaterThanOrEqual(4); seen.set(m.car, m.tick); }
  });
});

describe('reaction only: the sim is untouched', () => {
  it('traffic changes no sim number, world array or learned table', () => {
    const rewards = rewardsOf({ off: 20, red: 20 });
    const before = { k: world.kind.slice(), o: world.oneway.slice(), s: world.signal.slice() };
    const lone = hashOf(trainEpisodes(createAgent(loadWorld(CITY), 1), rewards, 300, HYPER).q.v);
    const taxi = taxiFor('walk');
    createTraffic(world, { seed: 1, count: 60, cellM: 12, taxi }).bakeTo(200);
    const { rewards: r, route } = card('walk');
    const a1 = analyzeRoute(world, route, r), ev1 = tripEvents(world, r, route);
    createTraffic(world, { seed: 9, count: 60, cellM: 12, taxi }).bakeTo(200);
    expect(analyzeRoute(world, route, r)).toEqual(a1);
    expect(tripEvents(world, r, route)).toEqual(ev1);
    expect(hashOf(trainEpisodes(createAgent(loadWorld(CITY), 1), rewards, 300, HYPER).q.v)).toBe(lone);
    expect(Array.from(world.kind)).toEqual(Array.from(before.k));
    expect(Array.from(world.oneway)).toEqual(Array.from(before.o));
    expect(Array.from(world.signal)).toEqual(Array.from(before.s));
  });
  it('traffic.js imports nothing that trains or scores', () => {
    const src = readFileSync(new URL('../games/city/traffic.js', import.meta.url), 'utf8');
    expect(src).not.toMatch(/from '\.\/(train|presets|goal|honest|meter|receipt|endcard)\.js'/);
  });
});

describe('poses and tiers', () => {
  it('a car eases its heading through a corner: no jump between frames, and the turn is smooth at both ends', () => {
    const t = createTraffic(world, { seed: 1, count: 20, cellM: 12 });
    const p = newPoses(t.count); let worst = 0, prev = null;
    for (let k = 0; k < 60; k += 0.05) {
      t.posesAt(k, p);
      if (prev) for (let i = 0; i < t.count; i++) { const d = Math.atan2(Math.sin(p.h[i] - prev[i]), Math.cos(p.h[i] - prev[i])); worst = Math.max(worst, Math.abs(d)); }
      prev = Array.from(p.h);
    }
    expect(worst).toBeLessThan(0.5); // even a U-turn (pi) is spread over many 0.05-tick frames; the old early snap moved 0.5+ at once
  });
  it('poses sit one lane width from their cell centre and stay finite while moving', () => {
    const t = createTraffic(world, { seed: 1, count: 10, cellM: 12 });
    const p = newPoses(10); t.posesAt(0, p);
    const s = t.snap(0);
    for (let i = 0; i < 10; i++) {
      const col = s.cell[i] % world.cols, row = Math.floor(s.cell[i] / world.cols);
      expect(Math.hypot(p.x[i] - (col + 0.5) * 12, p.z[i] + (world.rows - 1 - row + 0.5) * 12)).toBeCloseTo(LANE_M, 4);
    }
    for (let k = 0; k < 6; k += 0.37) {
      t.posesAt(k, p);
      for (let i = 0; i < 10; i++) { expect(Number.isFinite(p.x[i] + p.z[i] + p.h[i])).toBe(true); expect([0, 1]).toContain(p.braking[i]); }
    }
  });
  it('phones get fewer cars and no lamps', () => {
    const d = trafficTier({ phone: false }), p = trafficTier({ phone: true });
    expect(p.count).toBeLessThan(d.count);
    expect(d.lamps).toBe(true); expect(p.lamps).toBe(false);
    expect(d.count).toBe(90); expect(p.count).toBe(16);
  });
});
