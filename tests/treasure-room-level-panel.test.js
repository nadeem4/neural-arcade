import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { INFO } from '../games/treasure-room/words.js';
import { levelPanelHtml, mountLevelPlay, BUILT_LEVELS, forwardTap, tileSelector, wireTileFocus } from '../games/treasure-room/level-panel.js';

const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const html = levelPanelHtml();
const panel = read('games/treasure-room/level-panel.js');

describe('levelPanelHtml', () => {
  it('has every id the panel looks up', () => {
    for (const id of ['stage', 'say', 'levelPanel', 'steps', 'score', 'sees', 'log', 'arrowOut', 'arrowBack', 'handover', 'restart', 'levelTitle', 'levelBrief', 'status', 'tiles', 'roomBox']) {
      expect(html, id).toContain(`id="${id}"`);
    }
  });
  it('has the level 3 to 6 controls', () => {
    for (const id of ['routes', 'gamma', 'walk', 'go', 'fix', 'resetArrows', 'sum', 'sweep', 'sweep10', 'walkUp', 'resetSweeps', 'icy', 'dry', 'walkPlan', 'trips', 'showMdp', 'tags']) {
      expect(html, id).toContain(`id="${id}"`);
    }
  });
  it('wraps the 2D canvas in the room box the host swaps backends in, and draws through the host', () => {
    expect(html).toMatch(/<div class="room" id="roomBox"/);
    expect(panel).toMatch(/createRoomHost\(/);
    expect(panel).not.toMatch(/getContext\('2d'\)/);
    expect(panel).toMatch(/host\.destroy\(\)/);
  });
  it('has a line for why Walk uphill is disabled', () => {
    expect(html).toContain('id="walkUpWhy"');
  });
  it('has the stage canvas with a label, and a live line that is not announced', () => {
    expect(html).toMatch(/<canvas id="stage"[^>]*aria-label="[^"]+"/);
    expect(html).toMatch(/id="say"[^>]*aria-live="off"|aria-live="off"[^>]*id="say"/);
  });
  it('has four move buttons, one per action, as real buttons', () => {
    expect([...html.matchAll(/<button[^>]*data-move="(\d)"/g)].map(m => m[1]).sort()).toEqual(['0', '1', '2', '3']);
  });
  it('has an (i) button on every control, each with its INFO sentence', () => {
    const controls = [...html.matchAll(/class="info"[^>]*aria-controls="([\w-]+)"/g)].map(m => m[1]);
    expect(controls.length).toBeGreaterThanOrEqual(4);
    for (const id of controls) expect(html, id).toMatch(new RegExp(`class="info-text"[^>]*id="${id}"[^>]*hidden|id="${id}"[^>]*class="info-text"[^>]*hidden`));
    for (const k of [...html.matchAll(/data-info="(\w+)"/g)].map(m => m[1])) expect(INFO, k).toHaveProperty(k);
    expect(panel).toMatch(/INFO\[/);
  });
  it('marks each panel part with the levels that show it, and every level has a view', () => {
    for (const n of BUILT_LEVELS) expect(html).toMatch(new RegExp(`data-levels="[^"]*\\b${n}\\b`));
    for (const m of html.matchAll(/data-levels="([\d ]+)"/g)) for (const n of m[1].split(' ')) expect(panel).toMatch(new RegExp(`\\b${n}:\\s*level`));
  });
  it('calls the level 6 section "The floor"', () => {
    expect(html).toContain('<span id="mh">The floor</span>');
    expect(html).not.toContain('The icy floor</span>');
  });
  it('leaves the title out when asked', () => {
    expect(html).toContain('id="levelTitle"');
    expect(levelPanelHtml({ showTitle: false })).not.toContain('id="levelTitle"');
    expect(levelPanelHtml({ showTitle: false })).toContain('id="levelBrief"');
  });
  it('lists the six built levels and exports a mount function', () => {
    expect(BUILT_LEVELS).toEqual([1, 2, 3, 4, 5, 6]);
    expect(typeof mountLevelPlay).toBe('function');
  });
});

describe('forwardTap', () => {
  const mk = inside => {
    const clicked = [];
    const target = {};
    const tile = { click: () => clicked.push('tile') };
    const tiles = { hidden: false, contains: t => inside && t === target, querySelector: () => tile };
    const host = { cellAt: vi.fn(() => ({ x: 1, y: 1 })) };
    return { clicked, tiles, host, e: { target }, box: { dataset: { room: '3d' } } };
  };
  it('clicks the tile under a tap on the room', () => {
    const { clicked, tiles, host, e, box } = mk(false);
    forwardTap({ e, box, tiles, host });
    expect(clicked).toEqual(['tile']);
  });
  it('ignores a click that came from a tile itself', () => {
    const { clicked, tiles, host, e, box } = mk(true);
    forwardTap({ e, box, tiles, host });
    expect(host.cellAt).not.toHaveBeenCalled();
    expect(clicked).toEqual([]);
  });
});

describe('tap bridge', () => {
  it('builds the tile selector', () => {
    expect(tileSelector(2, 3)).toBe('[data-x="2"][data-y="3"]');
  });
  it('the panel has the Walk it reason line, wires tile focus to the ring, and hides the 3D tile grid', () => {
    expect(levelPanelHtml()).toContain('id="walkItWhy"');
    const src = readFileSync(new URL('../games/treasure-room/level-panel.js', import.meta.url), 'utf8');
    expect(src).toMatch(/focusin/);
    expect(src).toMatch(/host\.setFocus\(null\)/);
    expect(read('games/treasure-room/treasure-room.css')).toMatch(/#roomBox\[data-room="3d"\] \.tilegrid[^}]*opacity:\s*0/);
  });
});

describe('tap bridge guards and focus wiring', () => {
  const mk = ({ room = '3d', cell = { x: 2, y: 3 }, hidden = false } = {}) => {
    const clicked = [], asked = [];
    const tile = { click: () => clicked.push('tile') };
    const tiles = { hidden, contains: () => false, querySelector: s => { asked.push(s); return tile; } };
    return { clicked, asked, tiles, host: { cellAt: vi.fn(() => cell) }, e: { target: {} }, box: { dataset: { room } } };
  };
  it('asks for the tile at the tapped cell', () => {
    const t = mk();
    forwardTap(t);
    expect(t.asked).toEqual([tileSelector(2, 3)]);
  });
  it('does nothing in 2D, on a miss or drag, or when the grid is hidden', () => {
    for (const t of [mk({ room: '2d' }), mk({ cell: null }), mk({ hidden: true })]) {
      forwardTap(t);
      expect(t.clicked).toEqual([]);
    }
  });
  it('focus on a tile sets the ring cell, and leaving the grid clears it', () => {
    const on = {};
    const tiles = { addEventListener: (t, fn) => { on[t] = fn; } };
    const host = { setFocus: vi.fn() };
    wireTileFocus({ tiles, host });
    on.focusin({ target: { dataset: { x: '1', y: '2' } } });
    expect(host.setFocus).toHaveBeenLastCalledWith({ x: 1, y: 2 });
    on.focusin({ target: { dataset: {} } });
    expect(host.setFocus).toHaveBeenCalledTimes(1);
    on.focusout();
    expect(host.setFocus).toHaveBeenLastCalledWith(null);
  });
});

// Button audit: a button that cannot act at the start is disabled and shows why, on every level.
describe('button audit: disabled at start says why', () => {
  const buttonIds = [...html.matchAll(/<button\b[^>]*\bid="(\w+)"/g)].map(m => m[1]);
  const whyIdOf = { walk: 'walkItWhy', walkUp: 'walkUpWhy', resetSweeps: 'walkUpWhy' };
  const views = {
    1: () => import('../games/treasure-room/level-agent.js'), 2: () => import('../games/treasure-room/level-triples.js'),
    3: () => import('../games/treasure-room/level-return.js'), 4: () => import('../games/treasure-room/level-policy.js'),
    5: () => import('../games/treasure-room/level-value.js'), 6: () => import('../games/treasure-room/level-mdp.js'),
  };
  it('every level has a view to audit', () => {
    expect(Object.keys(views).map(Number)).toEqual(BUILT_LEVELS);
  });
  for (const n of [1, 2, 3, 4, 5, 6]) {
    it(`level ${n}: each button disabled at start has a non-empty reason`, async () => {
      vi.stubGlobal('matchMedia', () => ({ matches: true }));
      vi.stubGlobal('document', { addEventListener() {}, removeEventListener() {} });
      const { fakeUi } = await import('./treasure-room-fake-ui.js');
      const ui = fakeUi();
      const view = (await views[n]()).mount(ui);
      const disabled = buttonIds.filter(id => ui.panel.querySelector('#' + id).disabled);
      for (const id of disabled) {
        const why = ui.panel.querySelector('#' + (whyIdOf[id] ?? ''));
        expect(whyIdOf[id], `${id} has a why element`).toBeTruthy();
        expect(why.textContent, `${id} says why`).not.toBe('');
      }
      view?.destroy?.();
      vi.unstubAllGlobals();
    });
  }
});
