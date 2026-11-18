import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { ROOM, START, SLIP, valueIteration, greedyPolicy } from '../games/treasure-room/sim.js';
import { TAGS, tagNote, compareRoutes, simulateTrips, tripsVerdict, mount } from '../games/treasure-room/level-mdp.js';
import { LEVELS, navModel } from '../games/treasure-room/levels.js';
import { fakeUi } from './treasure-room-fake-ui.js';

const read = f => readFileSync(new URL(`../games/treasure-room/${f}`, import.meta.url), 'utf8');
const html = read('index.html'), main = read('main.js');
const plan = slip => greedyPolicy(ROOM, valueIteration(ROOM, { gamma: 0.9, slip }), { gamma: 0.9, slip });

describe('compareRoutes', () => {
  const { dry, icy } = compareRoutes(ROOM, 0.9, SLIP);
  it('the dry plan hugs the pit and the icy plan keeps away from it, going the longer way round', () => {
    expect(dry.pitAdjacent).toBe(true);
    expect(icy.pitAdjacent).toBe(false);
    expect(icy.cells.length).toBeGreaterThan(dry.cells.length);
  });
  it('ice lowers the value of the start, and the numbers match the room', () => {
    expect(icy.startValue).toBeLessThan(dry.startValue);
    expect(dry.startValue).toBeCloseTo(1.81, 2);
    expect(icy.startValue).toBeCloseTo(-2.259, 2);
    expect(dry.cells[0]).toEqual(START);
  });
});

describe('simulateTrips', () => {
  const dry = plan(0), icy = plan(SLIP);
  const a = simulateTrips(ROOM, dry, { slipEach: SLIP, n: 500, seed: 1 });
  const b = simulateTrips(ROOM, icy, { slipEach: SLIP, n: 500, seed: 1 });
  it('the dry plan falls in the pit more often on ice than the icy plan', () => {
    expect(a.pit).toBeGreaterThan(b.pit);
    expect(b.meanTotal).toBeGreaterThan(a.meanTotal);
    expect(a.treasure + a.pit).toBeLessThanOrEqual(500);
  });
  it('is the same for the same seed and different for another', () => {
    expect(simulateTrips(ROOM, dry, { slipEach: SLIP, n: 500, seed: 1 })).toEqual(a);
    expect(simulateTrips(ROOM, dry, { slipEach: SLIP, n: 500, seed: 2 })).not.toEqual(a);
  });
  it('on a dry floor every trip is the same', () => {
    expect(simulateTrips(ROOM, dry, { slipEach: 0, n: 20, seed: 1 })).toMatchObject({ treasure: 20, pit: 0 });
  });
});

describe('tags', () => {
  it('has five, in the order they light up', () => {
    expect(TAGS).toEqual(['states', 'actions', 'rewards', 'slip', 'gamma']);
  });
  it('the slip note says 80% and 10%, the gamma note carries the number', () => {
    const s = tagNote('slip', { slip: 0.1 });
    expect(s).toMatch(/80%/);
    expect(s).toMatch(/10%/);
    expect(tagNote('gamma', { gamma: 0.9 })).toContain('0.9');
    for (const t of TAGS) expect(tagNote(t, { slip: 0.1, gamma: 0.9 }).length).toBeGreaterThan(10);
  });
});

describe('tripsVerdict', () => {
  it('says which plan did better from the counts, and says so when they tie', () => {
    expect(tripsVerdict({ pit: 3, meanTotal: -1 }, { pit: 0, meanTotal: 2 })).toMatch(/made for ice/);
    expect(tripsVerdict({ pit: 0, meanTotal: 2 }, { pit: 3, meanTotal: -1 })).toMatch(/dry plan/);
    expect(tripsVerdict({ pit: 1, meanTotal: 2 }, { pit: 1, meanTotal: 2 })).toMatch(/same/i);
  });
});

describe('level 6 view and wiring', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
  it('toggling the floor swaps which route is drawn strong (first) and which faint (second)', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const ui = fakeUi();
    const view = mount(ui);
    const { dry, icy } = compareRoutes(ROOM, 0.9, SLIP);
    expect(ui.last().ghost).toEqual([dry.cells, icy.cells]);
    ui.click('#icy');
    expect(ui.last().ghost).toEqual([icy.cells, dry.cells]);
    ui.click('#dry');
    expect(ui.last().ghost).toEqual([dry.cells, icy.cells]);
    view.destroy();
  });
  it('Run 20 trips shows both count lines and a verdict', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const ui = fakeUi();
    const view = mount(ui);
    ui.click('#trips');
    const out = ui.panel.querySelector('#tripsOut').textContent;
    expect(out).toMatch(/Dry plan on ice: \d+ treasure, \d+ pit/);
    expect(out).toMatch(/Icy plan on ice: \d+ treasure, \d+ pit/);
    expect(ui.said.at(-1).length).toBeGreaterThan(10);
    view.destroy();
  });
  it('a hidden tab pauses the walk: the robot does not move until the tab is back', () => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    vi.stubGlobal('document', { hidden: true });
    const ui = fakeUi();
    const view = mount(ui);
    ui.click('#walkPlan');
    vi.advanceTimersByTime(5000);
    expect(ui.last().agent).toEqual(START);
    document.hidden = false;
    vi.advanceTimersByTime(5000);
    expect(ui.last().agent).not.toEqual(START);
    view.destroy();
  });
  it('the tag list names each part once, and the states note does not count walls', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const ui = fakeUi();
    const view = mount(ui);
    ui.click('#showMdp');
    expect(ui.panel.querySelector('#tags').innerHTML).not.toMatch(/<b>/);
    expect(tagNote('states')).not.toMatch(/25/);
    view.destroy();
  });
  it('with reduced motion, Show the MDP lights all five tags at once', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const ui = fakeUi();
    const view = mount(ui);
    ui.click('#showMdp');
    expect(ui.panel.querySelector('#tags').innerHTML.match(/class="lit"/g)).toHaveLength(5);
    view.destroy();
  });
  it('mounts on a fake page, runs each button, and removes every listener on destroy', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    const ui = fakeUi();
    const view = mount(ui);
    expect(ui.drawn.length).toBeGreaterThan(0);
    for (const id of ['#icy', '#dry', '#walkPlan', '#trips', '#showMdp']) ui.click(id);
    view.destroy();
    expect(ui.listenerCount()).toBe(0);
  });
  it('the nav lists all six levels and every level has a registered view', () => {
    expect(navModel([1, 2, 3, 4, 5, 6], 6).map(n => n.n)).toEqual([1, 2, 3, 4, 5, 6]);
    for (const l of LEVELS) expect(main).toMatch(new RegExp(`\\b${l.n}:\\s*level`));
    for (const m of html.matchAll(/data-levels="([\d ]+)"/g)) for (const n of m[1].split(' ')) expect(main).toMatch(new RegExp(`\\b${n}:\\s*level`));
  });
  it('has the level 5 and 6 controls', () => {
    for (const id of ['sweep', 'sweep10', 'walkUp', 'resetSweeps', 'icy', 'dry', 'walkPlan', 'trips', 'showMdp', 'tags']) expect(html).toContain(`id="${id}"`);
  });
});
