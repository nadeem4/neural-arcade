import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { INFO } from '../games/treasure-room/words.js';
import { levelPanelHtml, mountLevelPlay, BUILT_LEVELS, levelName, forwardTap, tileSelector, wireTileFocus } from '../games/treasure-room/level-panel.js';

const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const html = levelPanelHtml();
const panel = read('games/treasure-room/level-panel.js');

describe('levelPanelHtml', () => {
  it('has every id the panel looks up', () => {
    for (const id of ['say', 'levelPanel', 'steps', 'score', 'sees', 'log', 'arrowOut', 'arrowBack', 'handover', 'restart', 'levelTitle', 'levelBrief', 'status', 'tiles', 'roomBox']) {
      expect(html, id).toContain(`id="${id}"`);
    }
  });
  it('has the level 3 to 6 controls', () => {
    for (const id of ['stepTabs', 'sendCoin', 'sendChest', 'gamma', 'go', 'fix', 'resetArrows', 'sweep', 'sweep10', 'walkUp', 'resetSweeps', 'icy', 'dry', 'walkPlan', 'trips', 'showMdp', 'tags']) {
      expect(html, id).toContain(`id="${id}"`);
    }
  });
  it('uses each element id once, since every level looks its controls up by id', () => {
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });
  it('shows the hand-over button only on the state level', () => {
    expect(html).toMatch(/id="handover" data-levels="state"/);
  });
  it('wraps the 2D canvas in the room box the host swaps backends in, and draws through the host', () => {
    expect(html).toMatch(/<div class="room" id="roomBox"/);
    expect(panel).toMatch(/createRoomHost\(/);
    expect(panel).not.toMatch(/getContext\('2d'\)/);
    expect(panel).toMatch(/host\.destroy\(\)/);
  });
  it('mounts the loader and wires Try again to the host', () => {
    expect(panel).toMatch(/createLoader\(/);
    expect(panel).toMatch(/onRetry/);
    expect(panel).toMatch(/host\.retry\(\)/);
    expect(panel).toMatch(/onState/);
    expect(panel).toMatch(/onProgress/);
    expect(panel).toMatch(/loader\.destroy\(\)/);
  });
  it('creates the loader before the host, which reports its first state synchronously', () => {
    const body = panel.slice(panel.indexOf('export function mountLevelPlay'));
    expect(body.indexOf('createLoader(')).toBeGreaterThan(-1);
    expect(body.indexOf('createLoader(')).toBeLessThan(body.indexOf('createRoomHost('));
  });
  it('has a line for why Walk uphill is disabled', () => {
    expect(html).toContain('id="walkUpWhy"');
  });
  it('has the room box with a label for the 3D canvas, and a live line that is not announced', () => {
    expect(html).toMatch(/id="roomBox"[^>]*data-label="[^"]+"/);
    expect(html).not.toContain('id="stage"');
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
    for (const id of BUILT_LEVELS) expect(html).toMatch(new RegExp(`data-levels="([^"]* )?${id}( [^"]*)?"`));
    for (const m of html.matchAll(/data-levels="([\w -]+)"/g)) for (const id of m[1].split(' ')) expect(BUILT_LEVELS).toContain(id);
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
  it('lists the six built levels in track order and exports a mount function', () => {
    expect(BUILT_LEVELS).toEqual(['loop', 'state', 'return', 'policy', 'value', 'mdp']);
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

describe('forwardTap while 3D is not up', () => {
  for (const room of ['loading', 'failed']) {
    it(`does nothing when the room is ${room}`, () => {
      const clicked = [], target = {};
      const tiles = { hidden: false, contains: () => false, querySelector: () => ({ click: () => clicked.push('tile') }) };
      const host = { cellAt: vi.fn(() => ({ x: 1, y: 1 })) };
      forwardTap({ e: { target }, box: { dataset: { room } }, tiles, host });
      expect(host.cellAt).not.toHaveBeenCalled();
      expect(clicked).toEqual([]);
    });
  }
});

describe('tap bridge', () => {
  it('builds the tile selector', () => {
    expect(tileSelector(2, 3)).toBe('[data-x="2"][data-y="3"]');
  });
  it('the panel has the Walk uphill reason line, wires tile focus to the ring, and hides the 3D tile grid', () => {
    expect(levelPanelHtml()).toContain('id="walkUpWhy"');
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
  const whyIdOf = { walkUp: 'walkUpWhy', resetSweeps: 'walkUpWhy' };
  const views = {
    loop: () => import('../games/treasure-room/level-agent.js'), 'state': () => import('../games/treasure-room/level-triples.js'),
    return: () => import('../games/treasure-room/level-return.js'), policy: () => import('../games/treasure-room/level-policy.js'),
    value: () => import('../games/treasure-room/level-value.js'), mdp: () => import('../games/treasure-room/level-mdp.js'),
  };
  it('every level has a view to audit', () => {
    expect(Object.keys(views)).toEqual(BUILT_LEVELS);
  });
  for (const n of Object.keys(views)) {
    it(`level ${n}: each button disabled at start has a non-empty reason`, async () => {
      vi.stubGlobal('matchMedia', () => ({ matches: true }));
      vi.stubGlobal('document', { addEventListener() {}, removeEventListener() {} });
      let view;
      try {
        const { fakeUi } = await import('./treasure-room-fake-ui.js');
        const ui = fakeUi();
        view = (await views[n]()).mount(ui);
        const disabled = buttonIds.filter(id => ui.panel.querySelector('#' + id).disabled);
        for (const id of disabled) {
          expect(whyIdOf[id], `${id} has a why element`).toBeTruthy();
          const why = ui.panel.querySelector('#' + whyIdOf[id]);
          expect(why.textContent, `${id} says why`).not.toBe('');
        }
      } finally {
        view?.destroy?.();
        vi.unstubAllGlobals();
      }
    });
  }
});

describe('levelName', () => {
  it('is the lesson name for every built level, never the generic fallback', () => {
    for (const id of BUILT_LEVELS) {
      expect(levelName(id)).toBeTruthy();
      expect(levelName(id)).not.toBe('The treasure room');
    }
  });
  it('an unbuilt level uses the first level (as the mount does)', () => {
    expect(levelName('bandit')).toBe(levelName(BUILT_LEVELS[0]));
  });
});

describe('level labels in the panel (source guards)', () => {
  it('mounts the label layer only for a level that has markers, and shows it only in 3D', () => {
    expect(panel).toMatch(/import \{[^}]*markersFor[^}]*\} from '\.\/room-markers\.js'/);
    expect(panel).toMatch(/list\.length \? createMarkerLayer\(/);
    expect(panel).toMatch(/markers\?\.setShown\(state === '3d'\)/);
    expect(panel).toMatch(/markers\?\.destroy\(\)/);
  });
});
