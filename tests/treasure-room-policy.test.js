import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { ROOM, START, valueIteration, greedyPolicy, runPolicy } from '../games/treasure-room/sim.js';
import { stateId } from '../assets/grid.js';
import { flipAction, initialPolicy, setArrow, fixPolicy, diffCells, verdict, mount } from '../games/treasure-room/level-policy.js';
import { fakeUi } from './treasure-room-fake-ui.js';

const isFloor = (x, y) => !'TX#'.includes(ROOM.cells[y][x]);
const id = (x, y) => stateId(ROOM, { x, y });

describe('level 4 policy logic', () => {
  it('flipAction cycles up, down, left, right', () => {
    expect([0, 1, 2, 3].map(flipAction)).toEqual([1, 2, 3, 0]);
  });
  it('initialPolicy has an arrow on each floor tile, nothing elsewhere, and never reaches the treasure', () => {
    const p = initialPolicy(ROOM);
    for (let y = 0; y < ROOM.h; y++) for (let x = 0; x < ROOM.w; x++) {
      if (isFloor(x, y)) expect([0, 1, 2, 3]).toContain(p[id(x, y)]);
      else expect(p[id(x, y)]).toBe(-1);
    }
    expect(runPolicy(ROOM, p).outcome).not.toBe('treasure');
  });
  it('setArrow returns a new array and ignores walls, the treasure and the pit', () => {
    const p = initialPolicy(ROOM);
    const q = setArrow(p, ROOM, { x: 0, y: 0 }, 1);
    expect(q).not.toBe(p);
    expect(p[id(0, 0)]).toBe(3);
    expect(q[id(0, 0)]).toBe(1);
    for (const c of [{ x: 4, y: 2 }, { x: 4, y: 3 }, { x: 2, y: 2 }]) expect(setArrow(p, ROOM, c, 1)).toEqual(p);
  });
  it('the AI fix reaches the treasure and equals the greedy policy at that discount', () => {
    const fixed = fixPolicy(ROOM, 0.9);
    expect(runPolicy(ROOM, fixed).outcome).toBe('treasure');
    expect(fixed).toEqual(greedyPolicy(ROOM, valueIteration(ROOM, { gamma: 0.9 }), { gamma: 0.9 }));
  });
  it('diffCells lists only floor tiles whose arrow changed', () => {
    const d = diffCells(initialPolicy(ROOM), fixPolicy(ROOM, 0.9));
    expect(d.length).toBeGreaterThan(0);
    for (const c of d) expect(isFloor(c.x, c.y)).toBe(true);
    expect(diffCells(fixPolicy(ROOM, 0.9), fixPolicy(ROOM, 0.9))).toEqual([]);
  });
  it('verdict says treasure, pit, circles or out of steps in plain words', () => {
    expect(verdict(runPolicy(ROOM, fixPolicy(ROOM, 0.9)))).toMatch(/treasure/i);
    expect(verdict(runPolicy(ROOM, initialPolicy(ROOM)))).toMatch(/circles/i);
    const toPit = initialPolicy(ROOM);
    toPit[id(START.x, START.y)] = 3; toPit[id(1, 1)] = 3; toPit[id(2, 1)] = 1;
    expect(verdict(runPolicy(ROOM, toPit))).toMatch(/pit/i);
    expect(verdict({ outcome: 'timeout', trace: [{ pos: { x: 0, y: 0 } }, { pos: { x: 1, y: 0 } }] })).toMatch(/steps/i);
  });
});

describe('level 4 view', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('mounts with a minimal ui, draws a tile per floor cell, and destroy removes its listeners', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    const ui = fakeUi();
    const view = mount(ui);
    expect(ui.listenerCount()).toBeGreaterThan(0);
    expect(ui.tiles.innerHTML.match(/<button/g)).toHaveLength(21); // 25 minus 2 walls, the treasure and the pit
    expect(ui.last().policy).toEqual(initialPolicy(ROOM));
    view.destroy();
    expect(ui.listenerCount()).toBe(0);
  });
  it('Let the AI fix it, with reduced motion, applies the fix and walks to the treasure at once', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const ui = fakeUi();
    const view = mount(ui);
    ui.click('#fix');
    expect(ui.last().policy).toEqual(fixPolicy(ROOM, 0.9));
    expect(ui.last().agent).toEqual({ x: 4, y: 3 });
    expect(ui.last().marks ?? []).toEqual([]);
    view.destroy();
  });
});

describe('level 4 css', () => {
  const css = readFileSync('games/treasure-room/treasure-room.css', 'utf8');
  const rules = sel => [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter(m => m[1].split(',').some(s => s.trim() === sel)).map(m => m[2]).join(' ');
  it('keeps every tile and button at least 44px tall', () => {
    expect(rules('.tilegrid button')).toMatch(/min-height:\s*44px/);
    expect(rules('.row-btns .btn')).toMatch(/min-height:\s*44px/);
  });
});
