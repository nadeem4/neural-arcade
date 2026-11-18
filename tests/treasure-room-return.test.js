import { describe, it, expect, vi, afterEach } from 'vitest';
import { ROOM, START, adjacentToPit } from '../games/treasure-room/sim.js';
import { ROUTES, scoreRoute, routeFromTaps, treasureScale, frames, mount } from '../games/treasure-room/level-return.js';
import { fakeUi } from './treasure-room-fake-ui.js';
import { readFileSync } from 'node:fs';

const route = id => ROUTES.find(r => r.id === id);
const [short, detour, pit] = ['short', 'detour', 'pit'].map(route);

describe('level 3 routes', () => {
  it('has a short way, a longer safe detour and a way that ends in the pit', () => {
    expect(ROUTES.map(r => r.id)).toEqual(['short', 'detour', 'pit']);
    expect(scoreRoute(ROOM, short, 1)).toMatchObject({ outcome: 'treasure', steps: 6 });
    const d = scoreRoute(ROOM, detour, 1);
    expect(d.outcome).toBe('treasure');
    expect(d.steps).toBeGreaterThan(6);
    expect(d.cells.slice(1, -1).some(c => adjacentToPit(ROOM, c))).toBe(false);
    expect(scoreRoute(ROOM, pit, 1).outcome).toBe('pit');
  });
  it('adds the rewards on the route into one score', () => {
    const s = scoreRoute(ROOM, short, 1);
    expect(s.rewards).toEqual([-1, -1, -1, -1, -1, 10]);
    expect(s.total).toBe(5);
  });
  it('a discount below 1 shrinks the total', () => {
    expect(scoreRoute(ROOM, short, 0.9).total).toBeLessThan(scoreRoute(ROOM, short, 1).total);
    expect(scoreRoute(ROOM, short, 0.9).terms[5]).toBeCloseTo(10 * 0.9 ** 5);
  });
  it('shorter paths win at every discount from 0.5 up', () => {
    for (const g of [0.5, 0.9, 1]) {
      expect(scoreRoute(ROOM, short, g).total).toBeGreaterThan(scoreRoute(ROOM, detour, g).total);
    }
  });
  it('at discount 0.1 the treasure is hardly worth the walk, so even the best route scores below 0', () => {
    expect(scoreRoute(ROOM, short, 0.1).terms[5]).toBeLessThan(0.5);
    const best = Math.max(...ROUTES.filter(r => r.id !== 'pit').map(r => scoreRoute(ROOM, r, 0.1).total));
    expect(best).toBeLessThan(0);
  });
  it('the pit route scores below -9 at discount 0.9 and 1, and below the short route even at 0.5', () => {
    for (const g of [0.9, 1]) expect(scoreRoute(ROOM, pit, g).total).toBeLessThan(-9);
    expect(scoreRoute(ROOM, pit, 0.5).total).toBeLessThan(scoreRoute(ROOM, short, 0.5).total);
  });
});

describe('routeFromTaps', () => {
  it('turns taps on neighbouring tiles into actions', () => {
    const cells = scoreRoute(ROOM, short, 1).cells.slice(1);
    expect(routeFromTaps(ROOM, cells)).toEqual(short.actions);
  });
  it('rejects a tap that is not next to the route end, on a wall, or after the episode ended', () => {
    expect(routeFromTaps(ROOM, [{ x: 3, y: 3 }])).toBeNull();
    expect(routeFromTaps(ROOM, [{ x: 0, y: 0 }, { x: 0, y: 3 }])).toBeNull();
    expect(routeFromTaps(ROOM, [{ x: 1, y: 3 }])).toBeNull(); // not adjacent anyway
    expect(routeFromTaps(ROOM, [{ x: 0, y: 2 }, { x: 0, y: 3 }, { x: 1, y: 3 }])).toBeNull(); // wall
    expect(routeFromTaps(ROOM, [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 2, y: 3 }])).toBeNull(); // past the pit
    expect(routeFromTaps(ROOM, [])).toEqual([]);
  });
});

describe('treasureScale', () => {
  it('shrinks with distance and never vanishes', () => {
    expect(treasureScale(8, 0.9)).toBeLessThan(treasureScale(4, 0.9));
    expect(treasureScale(0, 1)).toBe(1);
    expect(treasureScale(50, 0.5)).toBe(0.15);
  });
});

describe('frames (the walk, one per step)', () => {
  it('starts on the start tile and ends on the route end with the full total', () => {
    const f = frames(ROOM, short, 0.9);
    expect(f[0]).toMatchObject({ pos: START, total: 0, tag: null });
    expect(f).toHaveLength(short.actions.length + 1);
    expect(f.at(-1).total).toBeCloseTo(scoreRoute(ROOM, short, 0.9).total);
    expect(f[1].tag).toMatchObject({ text: '−1', tone: 'step' });
  });
});

describe('level 3 view', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('mounts with a minimal ui, registers listeners, and destroy removes them', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    const ui = fakeUi();
    const view = mount(ui);
    expect(typeof view.destroy).toBe('function');
    expect(ui.listenerCount()).toBeGreaterThan(0);
    expect(ui.drawn.length).toBeGreaterThan(0);
    view.destroy();
    expect(ui.listenerCount()).toBe(0);
  });
  it('tags the treasure tile with its worth from the current distance', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    const ui = fakeUi();
    const view = mount(ui);
    const tag = ui.last().tags.find(t => t.x === 4 && t.y === 3);
    expect(tag.text).toBe('+5.3 here');
    ui.panel.querySelector('#gamma').value = '0.5';
    ui.input('#gamma');
    expect(ui.last().tags.find(t => t.x === 4 && t.y === 3).text).toBe('+0.2 here');
    view.destroy();
  });
  it('compares all three routes at the current discount, rebuilt when the slider moves', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    const ui = fakeUi();
    const view = mount(ui);
    const el = ui.panel.querySelector('#compare');
    expect(el.textContent).toBe('Short way 1.81 · Detour −0.43 · Risky way −10');
    ui.panel.querySelector('#gamma').value = '0.1';
    ui.input('#gamma');
    expect(el.textContent).toMatch(/^Short way −1.11 · Detour −1.11 · Risky way −1.2$/);
    view.destroy();
  });
  it('with reduced motion Walk it finishes at once', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const ui = fakeUi();
    const view = mount(ui);
    ui.click('#walk');
    expect(ui.last().agent).toEqual({ x: 4, y: 3 });
    view.destroy();
  });
});

describe('level 3 css', () => {
  const css = readFileSync('games/treasure-room/treasure-room.css', 'utf8');
  const rules = sel => [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter(m => m[1].split(',').some(s => s.trim() === sel)).map(m => m[2]).join(' ');
  it('gives the discount slider and the route buttons a 44px tap height', () => {
    expect(rules('.gamma')).toMatch(/min-height:\s*44px/);
    expect(rules('.routes button')).toMatch(/min-height:\s*44px/);
  });
});
