import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from '../games/city/vendor/three.module.min.js';
import { loadWorld } from '../games/city/sim.js';
import { tripEvents, tagsFor } from '../games/city/events.js';
import { endCardModel } from '../games/city/endcard.js';
import { INFO } from '../games/city/words.js';
import { SCARE_COST, SCARE_MAX, trueGoal } from '../games/city/goal.js';
import { Y_CROSS, Y_WALK } from '../games/city/street-model.js';
import { tierFor } from '../games/city/quality.js';
import { GOAL_SECONDS, SEED } from '../games/city/presets.js';
import { bakePeople, SURF_WALK, SURF_PARK, SURF_CROSS } from '../games/city/people.js';
import { createPeopleLayer, surfaceY, Y_PARK } from '../games/city/scene-people.js';
import { createFallbackStage } from '../games/city/stage.js';

const read = (f) => JSON.parse(readFileSync(new URL('../games/city/' + f, import.meta.url), 'utf8'));
const city = read('chicago.json'), story = read('story.json');
const world = loadWorld(city);
const speed = story.cards.find((c) => c.id === 'speed');
const events = tripEvents(world, speed.rewards, speed.route);
const R = speed.rewards;

describe('the scared tag', () => {
  it('shows "scared N" in the fine style, and nothing when nobody was scared', () => {
    const step = { off: false, red: false, wrong: false, done: false };
    expect(tagsFor(step, R, 2)).toEqual([{ text: 'scared 2', kind: 'fine' }]);
    expect(tagsFor(step, R, 0)).toEqual([]);
    expect(tagsFor(step, R)).toEqual([]);
  });
});

describe('the end card', () => {
  it('takes the scared people off the city score and says so in a plain line', () => {
    const base = endCardModel(R, speed.analysis, GOAL_SECONDS);
    const m = endCardModel(R, speed.analysis, GOAL_SECONDS, null, 3);
    expect(m.city).toBe(base.city - 3 * SCARE_COST);
    expect(m.scaredLine).toBe('Scared 3 people');
    expect(endCardModel(R, speed.analysis, GOAL_SECONDS, null, 1).scaredLine).toBe('Scared 1 person');
    expect(base.scaredLine).toBe('');
  });
});

describe('the info text', () => {
  it('says scared people cost points, with the number from the constant', () => {
    expect(INFO.meters).toContain(`minus ${SCARE_COST} for each person it scares`);
    expect(INFO.meters).toContain(`at most ${SCARE_MAX}`);
    expect(INFO.meters).not.toMatch(/red light.*scares|scares.*red light/);
  });
});

describe('scene-people', () => {
  const scene = () => ({ children: [], add(...o) { this.children.push(...o); }, remove(...o) { this.children = this.children.filter((c) => !o.includes(c)); } });
  const baked = () => bakePeople(world, city, events, { seed: SEED });
  it('two InstancedMesh with one instance per person: 60 on desktop, fewer on a phone', () => {
    const s = scene(), b = baked(false);
    const layer = createPeopleLayer(s, b, { drawn: tierFor({ phone: false }).peopleDrawn, shadows: true });
    expect(s.children.length).toBe(2);
    expect(s.children.every((m) => m.isInstancedMesh && m.count === 60)).toBe(true);
    expect(layer.count).toBe(60);
    expect(layer.drawCalls).toBe(4); // two meshes, drawn again in the shadow pass
    layer.dispose();
    const sp = scene(), lp = createPeopleLayer(sp, baked(), { drawn: tierFor({ phone: true }).peopleDrawn, shadows: false });
    expect(lp.count).toBe(tierFor({ phone: true }).peopleDrawn);
    expect(lp.drawCalls).toBe(2);
    expect(sp.children.some((m) => m.castShadow)).toBe(false);
  });
  it('update places every person from the trip clock, and dispose removes the meshes', () => {
    const s = scene(), b = baked(false);
    const layer = createPeopleLayer(s, b);
    layer.update(5);
    const a = Array.from(s.children[0].instanceMatrix.array);
    layer.update(5);
    expect(Array.from(s.children[0].instanceMatrix.array)).toEqual(a); // the same clock gives the same frame
    layer.update(20);
    expect(Array.from(s.children[0].instanceMatrix.array)).not.toEqual(a);
    layer.dispose();
    expect(s.children.length).toBe(0);
  });
});

describe('the no-WebGL fallback', () => {
  it('playTrip with people still finishes at once', () => {
    let done = 0;
    createFallbackStage({ ownerDocument: { getElementById: () => null } }, 'x').playTrip({ track: {}, events, people: bakePeople(world, city, events, { seed: SEED, count: 5 }), onDone: () => done++ });
    expect(done).toBe(1);
  });
  it('the city score comes from people.js alone, so it is the same with or without a stage', () => {
    const a = bakePeople(world, city, events, { seed: SEED }).scares.length;
    createPeopleLayer({ add() {}, remove() {} }, bakePeople(world, city, events, { seed: SEED }), { drawn: 24 }).update(10);
    expect(bakePeople(world, city, events, { seed: SEED }).scares.length).toBe(a);
  });
});

describe('the page wires people in', () => {
  const main = readFileSync(new URL('../games/city/main.js', import.meta.url), 'utf8');
  it('bakes people for a trip, passes them to the stage and feeds the city meter and end card', () => {
    expect(main).toContain('people: peopleFor(events)');
    expect(main).toContain('people: t.people');
    expect(main).toContain('hud.people.scaresAt(');
    expect(main).toContain('t.people.scares.length');
  });
  it('the end card has a scared line', () => {
    expect(readFileSync(new URL('../games/city/index.html', import.meta.url), 'utf8')).toContain('id="endScared"');
  });
});

describe('feet on the surface', () => {
  it('heights come from the surface constants', () => {
    expect(surfaceY(SURF_WALK)).toBe(Y_WALK);
    expect(surfaceY(SURF_CROSS)).toBe(Y_CROSS);
    expect(surfaceY(SURF_PARK)).toBe(Y_PARK);
    expect(Y_PARK).toBeGreaterThan(0);
  });
  it('nobody is drawn below the ground: every body starts at or above the lowest surface', () => {
    const s = { children: [], add(...o) { this.children.push(...o); }, remove() {} };
    const layer = createPeopleLayer(s, bakePeople(world, city, events, { seed: SEED }));
    for (const t of [0, 4, 9, 20, 33]) {
      layer.update(t);
      const a = s.children[0].instanceMatrix.array;
      for (let i = 0; i < layer.count; i++) expect(a[i * 16 + 13]).toBeGreaterThanOrEqual(Y_PARK);
    }
  });
});

describe('the scare cap', () => {
  const A = { arrived: true, seconds: 50, offTiles: 0, redRuns: 0, wrongWays: 0 };
  it('takes at most SCARE_MAX off, so an arriving trip never scores as low as one that never arrives', () => {
    expect(SCARE_MAX).toBe(30);
    const many = trueGoal({ analysis: { ...A, offTiles: 3 }, scares: 40, goalSeconds: GOAL_SECONDS }).score;
    expect(many).toBe(60 - SCARE_MAX);
    expect(many).toBeGreaterThan(trueGoal({ analysis: { ...A, arrived: false, offTiles: 3 }, scares: 40, goalSeconds: GOAL_SECONDS }).score);
  });
});
