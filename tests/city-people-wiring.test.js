import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from '../games/city/vendor/three.module.min.js';
import { loadWorld } from '../games/city/sim.js';
import { tripEvents, tagsFor } from '../games/city/events.js';
import { endCardModel } from '../games/city/endcard.js';
import { INFO } from '../games/city/words.js';
import { SCARE_COST } from '../games/city/goal.js';
import { GOAL_SECONDS, SEED } from '../games/city/presets.js';
import { bakePeople, peopleTier } from '../games/city/people.js';
import { createPeopleLayer } from '../games/city/scene-people.js';
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
  });
});

describe('scene-people', () => {
  const scene = () => ({ children: [], add(...o) { this.children.push(...o); }, remove(...o) { this.children = this.children.filter((c) => !o.includes(c)); } });
  const baked = (phone) => bakePeople(world, city, events, { seed: SEED, ...peopleTier({ phone }) });
  it('two InstancedMesh with one instance per person: 60 on desktop, fewer on a phone', () => {
    const s = scene(), b = baked(false);
    const layer = createPeopleLayer(s, b, { phone: false });
    expect(s.children.length).toBe(2);
    expect(s.children.every((m) => m.isInstancedMesh && m.count === b.count)).toBe(true);
    expect(layer.count).toBe(peopleTier().count);
    expect(layer.drawCalls).toBe(4); // two meshes, drawn again in the shadow pass
    layer.dispose();
    const sp = scene(), lp = createPeopleLayer(sp, baked(true), { phone: true });
    expect(lp.count).toBe(peopleTier({ phone: true }).count);
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
    const a = bakePeople(world, city, events, { seed: SEED, ...peopleTier() }).scares.length;
    createPeopleLayer({ add() {}, remove() {} }, bakePeople(world, city, events, { seed: SEED, ...peopleTier() })).update(10);
    expect(bakePeople(world, city, events, { seed: SEED, ...peopleTier() }).scares.length).toBe(a);
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
