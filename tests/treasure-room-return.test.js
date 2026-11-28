import { describe, it, expect, vi, afterEach } from 'vitest';
import { ROOM, COIN_ROOM, REWARD, START, roomForLevel, pathActions } from '../games/treasure-room/sim.js';
import { ROUTES, scoreRoute, pickAt, flipPoint, worthScale, frames, tabsHtml, discountRows, mount } from '../games/treasure-room/level-return.js';
import { layoutRoom, atTreasure } from '../games/treasure-room/room-math.js';
import { tagsList } from '../games/treasure-room/room-overlays.js';
import { fakeUi } from './treasure-room-fake-ui.js';
import { readFileSync } from 'node:fs';

const [coin, chest] = ROUTES;
const total = (route, g) => scoreRoute(COIN_ROOM, route, g).total;
const r2 = v => Math.sign(v) * Math.round(Math.abs(v) * 100) / 100;

describe('the coin room', () => {
  it('level 3 has a coin tile and no other level does', () => {
    expect(roomForLevel('return')).toBe(COIN_ROOM);
    expect(COIN_ROOM.cells[3][0]).toBe('C');
    for (const id of ['agent', 'state-action-reward', 'policy', 'value', 'mdp']) expect(roomForLevel(id)).toBe(ROOM);
    expect(ROOM.cells.flat()).not.toContain('C');
  });
  it('stepping onto the coin pays 2 and ends the round', () => {
    const w = pathActions(COIN_ROOM, START, coin.actions);
    expect(w.trace.map(t => t.reward)).toEqual([-1, REWARD.coin]);
    expect(w.trace.at(-1).done).toBe(true);
    expect(w.outcome).toBe('coin');
  });
  it('the 3D layout puts a second, smaller coin stack on the coin tile, and the robot cheers there', () => {
    const L = layoutRoom(COIN_ROOM);
    expect(L.coinTile).toMatchObject({ part: 'coin_stack_medium' });
    expect(L.coinTile.scale).toBeLessThan(L.coin.scale);
    expect(layoutRoom(ROOM).coinTile).toBeNull();
    expect(atTreasure(COIN_ROOM, { x: 0, y: 3 })).toBe(true);
  });
  it('a reward tag on the coin tile sits on the end tile', () => {
    expect(tagsList(COIN_ROOM, [{ x: 0, y: 3, text: '+2', tone: 'good' }])[0].onEnd).toBe(true);
  });
});

describe('coin or chest returns', () => {
  it('are 1 and 5 at discount 1, 0.8 and 1.81 at 0.9, 0 and -1.63 at 0.5', () => {
    expect([total(coin, 1), total(chest, 1)].map(r2)).toEqual([1, 5]);
    expect([total(coin, 0.9), total(chest, 0.9)].map(r2)).toEqual([0.8, 1.81]);
    expect([total(coin, 0.5), total(chest, 0.5)].map(r2)).toEqual([0, -1.63]);
  });
  it('the pick flips between 0.84 and 0.85, and the flip point is computed', () => {
    expect(pickAt(COIN_ROOM, 0.85)).toBe(chest);
    expect(pickAt(COIN_ROOM, 0.84)).toBe(coin);
    expect(flipPoint(COIN_ROOM)).toBeGreaterThan(0.84);
    expect(flipPoint(COIN_ROOM)).toBeLessThan(0.85);
  });
  it('prizes shrink with delay and never vanish', () => {
    expect(worthScale(5, 0.9)).toBeLessThan(worthScale(1, 0.9));
    expect(worthScale(0, 1)).toBe(1);
    expect(worthScale(5, 0.1)).toBe(0.15);
  });
  it('the discount table runs 10 points from now to 5 steps later', () => {
    expect(discountRows(0.9).map(r => r.value)).toEqual(['10', '9', '8.1', '7.29', '6.56', '5.9']);
  });
});

describe('frames (the walk, one per step)', () => {
  it('starts on the start tile and ends on the route end with the full total', () => {
    const f = frames(COIN_ROOM, chest, 0.9);
    expect(f[0]).toMatchObject({ pos: START, total: 0, tag: null });
    expect(f).toHaveLength(chest.actions.length + 1);
    expect(f.at(-1).total).toBeCloseTo(total(chest, 0.9));
    expect(f[1].tag).toMatchObject({ text: '−1', tone: 'step' });
    expect(frames(COIN_ROOM, coin, 1).at(-1).tag).toMatchObject({ text: '+2', tone: 'good' });
  });
});

describe('the step tabs', () => {
  it('are three buttons and only the open one is aria-current="step"', () => {
    for (const open of [1, 2, 3]) {
      const tabs = [...tabsHtml(open).matchAll(/<button[^>]*>/g)].map(m => m[0]);
      expect(tabs).toHaveLength(3);
      tabs.forEach((t, i) => expect(t.includes('aria-current="step"')).toBe(i + 1 === open));
    }
  });
});

describe('level 3 view', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('mounts with a minimal ui, registers listeners, and destroy removes them', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    const ui = fakeUi(COIN_ROOM);
    const view = mount(ui);
    expect(ui.listenerCount()).toBeGreaterThan(0);
    expect(ui.drawn.length).toBeGreaterThan(0);
    view.destroy();
    expect(ui.listenerCount()).toBe(0);
  });
  it('with reduced motion a route jumps to its end and both totals fill in', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const ui = fakeUi(COIN_ROOM);
    const view = mount(ui);
    ui.click('#sendCoin');
    expect(ui.last().agent).toEqual({ x: 0, y: 3 });
    expect(ui.panel.querySelector('#tally').textContent).toBe('−1 +2 = 1');
    ui.click('#sendChest');
    expect(ui.last().agent).toEqual({ x: 4, y: 3 });
    expect(ui.panel.querySelector('#vchest').textContent).toBe('5');
    view.destroy();
  });
  it('step 3 shows both returns and who the robot picks, and the room shrinks with the dial', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const ui = fakeUi(COIN_ROOM);
    const tabs = [1, 2, 3].map(n => ({ dataset: { step: String(n) }, current: n === 1, setAttribute() { this.current = true; }, removeAttribute() { this.current = false; } }));
    ui.panel.querySelectorAll = sel => (sel === '[data-step]' ? tabs : []);
    const view = mount(ui);
    ui.panel.querySelector('#stepTabs').closest = () => tabs[2];
    ui.click('#stepTabs');
    expect(tabs.map(t => t.current)).toEqual([false, false, true]);
    const slider = ui.panel.querySelector('#gamma');
    slider.value = '0.5';
    ui.input('#gamma');
    expect(ui.panel.querySelector('#ret3coin').textContent).toBe('0');
    expect(ui.panel.querySelector('#ret3chest').textContent).toBe('−1.63');
    expect(ui.panel.querySelector('#pick').textContent).toBe('Coin');
    expect(ui.panel.querySelector('#hint3').textContent).toMatch(/^Drag above 0\.85/);
    expect(ui.last().treasureScale).toBe(0.15);
    expect(ui.last().coinScale).toBeCloseTo(0.5);
    view.destroy();
  });
});

describe('level 3 css', () => {
  const css = readFileSync('games/treasure-room/treasure-room.css', 'utf8');
  const rules = sel => [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter(m => m[1].split(',').some(s => s.trim() === sel)).map(m => m[2]).join(' ');
  it('gives the discount slider, the route buttons and the step tabs a 44px tap height', () => {
    expect(rules('.gamma')).toMatch(/min-height:\s*44px/);
    expect(rules('.routes button')).toMatch(/min-height:\s*44px/);
    expect(rules('.steps button')).toMatch(/min-height:\s*44px/);
  });
});
