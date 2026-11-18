import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadWorld, lightRed } from '../games/city/sim.js';
import { tripEvents } from '../games/city/events.js';
import { trueGoal, goalAt } from '../games/city/goal.js';
import { meterAt } from '../games/city/meter.js';
import { GOAL_SECONDS, SEED } from '../games/city/presets.js';
import { bakePeople, peopleTier, newPoses, crossingFlags, outfitOf, WALK_TICKS, SCARE_M } from '../games/city/people.js';
import { cellCentre } from '../games/city/geometry.js';

const read = (f) => JSON.parse(readFileSync(new URL('../games/city/' + f, import.meta.url), 'utf8'));
const city = read('chicago.json');
const world = loadWorld(city);
const story = read('story.json');
const card = (id) => story.cards.find((c) => c.id === id);
const eventsOf = (id) => tripEvents(world, card(id).rewards, card(id).route);
const tier = peopleTier();
const bake = (id, o = {}) => bakePeople(world, city, eventsOf(id), { seed: SEED, ...tier, ...o });
const WALKABLE = (c) => world.kind[c] === 1 || world.kind[c] === 2;

describe('peopleTier', () => {
  it('phones get fewer people', () => {
    expect(peopleTier({ phone: true }).count).toBeLessThan(peopleTier().count);
    expect(peopleTier({ phone: true }).count).toBeGreaterThan(0);
  });
});

describe('bakePeople: determinism', () => {
  it('the same inputs give the same people, paths and scares', () => {
    const a = bake('speed'), b = bake('speed');
    expect(a.scares).toEqual(b.scares);
    const pa = newPoses(a.count), pb = newPoses(b.count);
    for (const t of [0, 3.3, 17.5, 40]) {
      a.fillPoses(t, pa); b.fillPoses(t, pb);
      expect(Array.from(pa.x)).toEqual(Array.from(pb.x));
      expect(Array.from(pa.z)).toEqual(Array.from(pb.z));
    }
  });
  it('a different seed gives different people', () => {
    const a = bake('speed'), b = bake('speed', { seed: SEED + 1 });
    const pa = newPoses(a.count), pb = newPoses(b.count);
    a.fillPoses(10, pa); b.fillPoses(10, pb);
    expect(Array.from(pa.x)).not.toEqual(Array.from(pb.x));
  });
  it('uses no clock and no unseeded random numbers', () => {
    const src = readFileSync(new URL('../games/city/people.js', import.meta.url), 'utf8');
    expect(src).not.toMatch(/Math\.random|Date\.now|performance\.now/);
    const scene = readFileSync(new URL('../games/city/scene-people.js', import.meta.url), 'utf8');
    expect(scene).not.toMatch(/Math\.random|Date\.now|performance\.now/);
  });
  it('colours come from a seeded hash', () => {
    expect(outfitOf(1, 5)).toEqual(outfitOf(1, 5));
    const set = new Set(Array.from({ length: 40 }, (_, i) => outfitOf(1, i).cloth));
    expect(set.size).toBeGreaterThan(3);
  });
});

describe('bakePeople: where people are', () => {
  it('bakes the tier count of people', () => {
    expect(bake('speed').count).toBe(tier.count);
  });
  it('every person stands on a footpath or park cell, or is crossing a road at a mapped crossing', () => {
    const flags = crossingFlags(world, city);
    const b = bake('speed');
    const p = newPoses(b.count);
    for (let t = 0; t <= 80; t += 0.5) {
      b.fillPoses(t, p, { noJump: true });
      for (let i = 0; i < b.count; i++) {
        const col = Math.floor(p.x[i] / city.cellM);
        // cellCentre: z = -(rows-1-r+0.5)*cellM, so r = rows - 1 - floor(-z / cellM)
        const r = city.rows - 1 - Math.floor(-p.z[i] / city.cellM);
        const c = r * world.cols + col;
        const onRoad = world.kind[c] === 0;
        if (onRoad) {
          // somebody on a road is mid-crossing: the crossing starts at a mapped crossing cell on the footpath side
          expect(b.crossingAt(i, t), `person ${i} at t=${t} is on a road off a crossing`).toBe(true);
        } else {
          expect(WALKABLE(c), `person ${i} at t=${t} on kind ${world.kind[c]}`).toBe(true);
        }
      }
    }
    expect(flags.some((f) => f)).toBe(true);
  });
  it('people are placed near the route so the drive shows them', () => {
    const ev = eventsOf('speed');
    const cells = new Set(ev.steps.map((s) => s.cell));
    const b = bake('speed');
    const p = newPoses(b.count);
    b.fillPoses(0, p, { noJump: true });
    let near = 0;
    for (let i = 0; i < b.count; i++) {
      for (const c of cells) {
        const [x, z] = cellCentre(c % world.cols, Math.floor(c / world.cols), city);
        if (Math.hypot(x - p.x[i], z - p.z[i]) < city.cellM * 12) { near++; break; }
      }
    }
    expect(near).toBe(b.count);
  });
});

describe('bakePeople: crossings', () => {
  it('some people do cross a road on the real map', () => {
    const b = bake('speed');
    expect(b.crossings.length).toBeGreaterThan(0);
  });
  it('nobody is on a crossing at a tick when the pedestrian light is red', () => {
    for (const id of ['speed', 'legal']) {
      const b = bake(id);
      for (const x of b.crossings) {
        for (let t = x.tEnter; t < x.tEnter + x.span; t++) {
          // ped moving along `axis` is safe when the cars across them (the other axis) are red
          const across = x.dir % 2 === 0 ? 1 : 0;
          expect(lightRed(world, t, across), `crossing at ${x.tEnter} dir ${x.dir} tick ${t}`).toBe(true);
        }
      }
    }
  });
  it('people only step onto a road from a mapped crossing cell', () => {
    const flags = crossingFlags(world, city);
    const b = bake('speed');
    for (const x of b.crossings) {
      const first = x.from + [-world.cols, 1, world.cols, -1][x.dir];
      expect(world.kind[first]).toBe(0);
      expect(flags[first] & (x.dir % 2 === 0 ? 1 : 2)).toBeTruthy();
    }
  });
});

describe('scares', () => {
  it('the legal card scares nobody; the cheat cards do', () => {
    const legal = bake('legal'), speed = bake('speed');
    expect(legal.scares.length).toBe(0);
    expect(speed.scares.length).toBeGreaterThan(0);
  });
  it('scares come only from park or footpath driving or a red light run', () => {
    for (const id of ['speed', 'walk', 'lights', 'legal', 'mile']) {
      const ev = eventsOf(id);
      for (const s of bake(id).scares) {
        const step = ev.steps[s.tick];
        expect(step.off || step.red).toBeTruthy();
      }
    }
  });
  it('each person is scared at most once', () => {
    const b = bake('speed');
    const ids = b.scares.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('the scared person was within SCARE_M of the taxi path on that step', () => {
    const ev = eventsOf('speed');
    const b = bake('speed');
    const p = newPoses(b.count);
    for (const s of b.scares) {
      const step = ev.steps[s.tick];
      const [ax, az] = cellCentre(step.from % world.cols, Math.floor(step.from / world.cols), city);
      const [bx, bz] = cellCentre(step.cell % world.cols, Math.floor(step.cell / world.cols), city);
      let best = Infinity;
      for (const t of [s.tick, s.tick + 1]) {
        b.fillPoses(t, p, { noJump: true });
        const px = p.x[s.id], pz = p.z[s.id];
        const u = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (pz - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2 || 1)));
        best = Math.min(best, Math.hypot(px - (ax + u * (bx - ax)), pz - (az + u * (bz - az))));
      }
      expect(best).toBeLessThanOrEqual(SCARE_M + 1e-6);
    }
  });
  it('scaresAt counts the scares of whole steps done, and never falls', () => {
    const b = bake('speed');
    let prev = 0;
    for (let n = 0; n <= eventsOf('speed').steps.length + 2; n++) {
      const c = b.scaresAt(n);
      expect(c).toBeGreaterThanOrEqual(prev);
      prev = c;
    }
    expect(b.scaresAt(0)).toBe(0);
    expect(prev).toBe(b.scares.length);
  });
  it('a scared person jumps aside by a fixed distance over one tick, and is never hit', () => {
    const b = bake('speed');
    const s = b.scares[0];
    const p0 = newPoses(b.count), p1 = newPoses(b.count), p2 = newPoses(b.count);
    b.fillPoses(s.tick, p0, { noJump: true });
    b.fillPoses(s.tick, p1);
    b.fillPoses(s.tick + 1, p2, {});
    expect(p1.x[s.id]).toBeCloseTo(p0.x[s.id]);
    b.fillPoses(s.tick + 1, p1, { noJump: true });
    expect(Math.hypot(p2.x[s.id] - p1.x[s.id], p2.z[s.id] - p1.z[s.id])).toBeGreaterThan(1);
  });
  it('rendering cannot change the count: scares are identical however many frames were drawn', () => {
    const a = bake('speed'), b = bake('speed');
    const p = newPoses(b.count);
    for (let t = 0; t < 60; t += 0.1) b.fillPoses(t, p); // "render" b a lot, a not at all
    expect(b.scares).toEqual(a.scares);
    expect(b.scaresAt(1000)).toBe(a.scaresAt(1000));
  });
});

describe('the city score with scares', () => {
  it('the legal card still scores 100', () => {
    const ev = eventsOf('legal');
    const b = bake('legal');
    expect(trueGoal({ analysis: card('legal').analysis, scares: b.scares, goalSeconds: GOAL_SECONDS }).score).toBe(100);
  });
  it('a cheat card scores below its no-scare score', () => {
    const b = bake('speed');
    const without = trueGoal({ analysis: card('speed').analysis, goalSeconds: GOAL_SECONDS }).score;
    const withScares = trueGoal({ analysis: card('speed').analysis, scares: b.scares, goalSeconds: GOAL_SECONDS }).score;
    expect(withScares).toBeLessThan(without);
  });
  it('the live city meter only falls and its last frame equals the final score', () => {
    for (const id of ['speed', 'walk', 'lights', 'legal']) {
      const ev = eventsOf(id), b = bake(id);
      let prev = Infinity;
      for (let f = 0; f <= ev.steps.length; f += 0.25) {
        const g = goalAt(ev, b.scaresAt(Math.floor(f)), f, GOAL_SECONDS);
        expect(g).toBeLessThanOrEqual(prev);
        prev = g;
      }
      const end = trueGoal({ analysis: card(id).analysis, scares: b.scares, goalSeconds: GOAL_SECONDS }).score;
      expect(goalAt(ev, b.scaresAt(ev.steps.length), ev.steps.length, GOAL_SECONDS)).toBe(end);
    }
  });
  it('people never change the pay meter or the trip events', () => {
    const ev = eventsOf('speed');
    const before = JSON.stringify([ev, meterAt(ev, ev.steps.length)]);
    bake('speed');
    expect(JSON.stringify([ev, meterAt(ev, ev.steps.length)])).toBe(before);
  });
});

describe('training is untouched', () => {
  it('people.js does not import the trainer or write to the sim', () => {
    const src = readFileSync(new URL('../games/city/people.js', import.meta.url), 'utf8');
    expect(src).not.toMatch(/train\.js|worker\.js|stepWorld/);
  });
  it('WALK_TICKS is a whole number of ticks per cell', () => {
    expect(Number.isInteger(WALK_TICKS) && WALK_TICKS > 0).toBe(true);
  });
});
