import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { stateId } from '../assets/grid.js';
import { ROOM, START, sweepOnce, valueIteration } from '../games/treasure-room/sim.js';
import { heatOf, uphillWalk, sweepsToSettle, walkUpState, resetState, mount } from '../games/treasure-room/level-value.js';
import { fakeUi } from './treasure-room-fake-ui.js';

const zeros = () => new Array(ROOM.w * ROOM.h).fill(0);
const css = readFileSync(new URL('../games/treasure-room/treasure-room.css', import.meta.url), 'utf8');
const rules = sel => [...css.matchAll(new RegExp(`${sel.replace(/[.#]/g, '\\$&')}\\s*[^{]*\\{([^}]*)\\}`, 'g'))].map(m => m[1]).join('');

describe('heatOf', () => {
  const settled = valueIteration(ROOM, { gamma: 0.9 });
  it('stays within 0..1, brightest next to the treasure, dimmest far away', () => {
    const h = heatOf(settled);
    expect(Math.max(...h)).toBe(1);
    expect(Math.min(...h)).toBe(0);
    expect(h[stateId(ROOM, { x: 3, y: 3 })]).toBe(1);
  });
  it('is all zeros when the values are flat', () => {
    expect(heatOf(zeros()).every(x => x === 0)).toBe(true);
  });
});

describe('uphillWalk', () => {
  it('reaches the treasure with strictly rising values at discount 0.9', () => {
    const v = valueIteration(ROOM, { gamma: 0.9 });
    const w = uphillWalk(ROOM, v, START);
    expect(w.outcome).toBe('treasure');
    expect(w.path[0]).toEqual(START);
    const vals = w.path.slice(0, -1).map(c => v[stateId(ROOM, c)]);
    for (let i = 1; i < vals.length; i++) expect(vals[i]).toBeGreaterThan(vals[i - 1]);
  });
  it('stands still when there is no value around it yet', () => {
    const w = uphillWalk(ROOM, zeros(), START);
    expect(w.path).toEqual([START]);
    expect(w.outcome).toBe('still');
  });
  it('stands still after one sweep, when no neighbour of the robot is better yet', () => {
    const v = sweepOnce(ROOM, zeros(), { gamma: 0.9 });
    expect(uphillWalk(ROOM, v, START).outcome).toBe('still');
  });
});

describe('sweepsToSettle', () => {
  it('is a small positive whole number', () => {
    for (const g of [0.3, 0.9, 0.99]) {
      const n = sweepsToSettle(ROOM, g);
      expect(Number.isInteger(n) && n > 0 && n < 60, String(g)).toBe(true);
    }
  });
  it('a low discount settles sooner, and a high one never sooner (a dry room settles once the farthest tile is reached, so 0.9 and 0.99 tie)', () => {
    expect(sweepsToSettle(ROOM, 0.3)).toBeLessThan(sweepsToSettle(ROOM, 0.9));
    expect(sweepsToSettle(ROOM, 0.99)).toBeGreaterThanOrEqual(sweepsToSettle(ROOM, 0.9));
  });
});

describe('buttons that cannot act say why', () => {
  it('Walk uphill waits for a sweep', () => {
    expect(walkUpState({ sweeps: 0, busy: false })).toEqual({ disabled: true, why: 'Sweep first, so there is value to climb.' });
    expect(walkUpState({ sweeps: 3, busy: false })).toEqual({ disabled: false, why: '' });
    expect(walkUpState({ sweeps: 3, busy: true })).toEqual({ disabled: true, why: '' });
  });
  it('Reset waits for a sweep', () => {
    expect(resetState({ sweeps: 0 })).toEqual({ disabled: true, why: 'Nothing to reset yet.' });
    expect(resetState({ sweeps: 2 })).toEqual({ disabled: false, why: '' });
    expect(resetState({ sweeps: 2, busy: true })).toEqual({ disabled: true, why: '' });
  });
  it('a mounted level shows the reason before the first sweep and clears it after', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const ui = fakeUi();
    const view = mount(ui);
    expect(ui.panel.querySelector('#walkUp').disabled).toBe(true);
    expect(ui.panel.querySelector('#walkUpWhy').textContent).toMatch(/Sweep first/);
    expect(ui.panel.querySelector('#resetSweeps').disabled).toBe(true);
    ui.click('#sweep');
    expect(ui.panel.querySelector('#walkUp').disabled).toBe(false);
    expect(ui.panel.querySelector('#walkUpWhy').textContent).toBe('');
    expect(ui.panel.querySelector('#resetSweeps').disabled).toBe(false);
    view.destroy();
    vi.unstubAllGlobals();
  });
  it('the why line is styled and only shows when it has text', () => {
    expect(css).toMatch(/\.why\s*\{/);
    expect(css).toMatch(/\.why:empty\s*\{\s*display:\s*none/);
  });
});

describe('level 5 view', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('with reduced motion, Sweep x10 jumps straight to ten sweeps and Walk uphill finishes at once', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const ui = fakeUi();
    const view = mount(ui);
    ui.click('#sweep10');
    let v = zeros();
    for (let i = 0; i < 10; i++) v = sweepOnce(ROOM, v, { gamma: 0.9 });
    expect(ui.last().values).toEqual(v);
    for (let i = 0; i < 40; i++) ui.click('#sweep10');
    ui.click('#walkUp');
    expect(ui.last().agent).not.toEqual(START);
    view.destroy();
  });
  it('walking uphill with no sweeps says sweep first; after a few sweeps it says no neighbour is better yet', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const ui = fakeUi();
    const view = mount(ui);
    ui.click('#walkUp');
    expect(ui.said.at(-1)).toMatch(/sweep first/);
    ui.click('#sweep'); ui.click('#sweep');
    ui.click('#walkUp');
    expect(ui.said.at(-1)).toBe('No tile next to the robot is better yet: sweep some more.');
    view.destroy();
  });
  it('a hidden tab pauses the uphill walk', () => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    vi.stubGlobal('document', { hidden: false });
    const ui = fakeUi();
    const view = mount(ui);
    ui.click('#sweep10');
    vi.advanceTimersByTime(3000);
    ui.click('#walkUp');
    document.hidden = true;
    vi.advanceTimersByTime(5000);
    expect(ui.last().agent).toEqual(START);
    view.destroy();
    vi.useRealTimers();
  });
  it('mounts on a fake page, draws, and removes every listener on destroy', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    const ui = fakeUi();
    const view = mount(ui);
    expect(ui.drawn.length).toBeGreaterThan(0);
    expect(ui.listenerCount()).toBeGreaterThan(0);
    for (const id of ['#sweep', '#sweep10', '#walkUp', '#resetSweeps']) ui.click(id);
    expect(ui.last().values).toBeDefined();
    view.destroy();
    expect(ui.listenerCount()).toBe(0);
  });
  it('has a heat legend and 44px sweep buttons', () => {
    expect(css).toMatch(/\.heat-legend/);
    expect(rules('.row-btns .btn')).toMatch(/min-height:\s*44px/);
  });
});
