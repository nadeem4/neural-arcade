import { describe, it, expect } from 'vitest';
import { shade, arrowFor, lightOf, turnCell, isoLayout, screenDir, facingFor, actionBetween, floorTile, paintOrder, explorerPose, walkAt, drawMaze, smooth, curvePoints } from '../games/maze/render.js';
import { loadMap, ACTIONS } from '../games/maze/sim.js';

const theme = { tray: '#111', ink: '#ink', red: '#f00', amber: '#fa0', 'amber-ink': '#320', rule: '#555', ground: '#ground', car: '#car', body: 'sans-serif' };
const recorder = () => {
  const calls = [];
  const ctx = new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : (...args) => calls.push([k, ...args, t.fillStyle, t.strokeStyle, t.globalAlpha])),
    set: (t, k, v) => { t[k] = v; return true; },
  });
  return { ctx, calls };
};
const art = { tiles: { id: 'tiles' }, explorer: { id: 'explorer' } };
const lightCanvas = () => { const { ctx, calls } = recorder(); return { getContext: () => ctx, calls }; };

describe('shade', () => {
  it('is 0 at or below zero, clamped, and 1 at vmax', () => {
    expect(shade(0)).toBe(0);
    expect(shade(-3)).toBe(0);
    expect(shade(5)).toBe(0.5);
    expect(shade(10)).toBe(1);
    expect(shade(99)).toBe(1);
    expect(shade(2, 4)).toBe(0.5);
  });
});

describe('arrowFor', () => {
  it('returns the four arrows in ACTIONS order', () => {
    expect([0, 1, 2, 3].map(arrowFor)).toEqual(['↑', '↓', '←', '→']);
    expect(ACTIONS.map(a => a.name)).toEqual(['up', 'down', 'left', 'right']);
  });
});

describe('lightOf', () => {
  it('is 0 at or below zero, rises, and is 1 from 9 up', () => {
    expect(lightOf(0)).toBe(0);
    expect(lightOf(-4)).toBe(0);
    expect(lightOf(9)).toBe(1);
    expect(lightOf(30)).toBe(1);
    expect(lightOf(3)).toBeGreaterThan(0);
    expect(lightOf(6)).toBeGreaterThan(lightOf(3));
  });
});

describe('the quarter turn', () => {
  const map = loadMap('near-or-far');
  it('draws map cell (r, c) at screen grid position (R-1-c, r)', () => {
    expect(turnCell(map, 0)).toEqual({ r: 5, c: 0 }); // the big treasure, top-left
    expect(turnCell(map, map.start)).toEqual({ r: 5, c: 5 }); // Start, bottom-left, goes to the front corner
    expect(turnCell(map, 5)).toEqual({ r: 0, c: 0 }); // top-right goes to the back corner
  });
  it('is a bijection onto the 6 by 6 screen grid', () => {
    const seen = new Set();
    for (let s = 0; s < map.nStates; s++) { const { r, c } = turnCell(map, s); seen.add(r * 6 + c); }
    expect(seen.size).toBe(36);
  });
  it('puts Start at the frontmost tile', () => {
    const order = paintOrder(map);
    expect(order.at(-1)).toBe(map.start);
    expect(order).toHaveLength(map.nStates);
  });
  it('moves a tile on screen the way its action points after the turn', () => {
    const lay = isoLayout(map, 600, 400);
    const mid = 14; // row 2, column 2: open on all four sides
    const [x0, y0] = lay.centre(mid);
    const moved = [-6, 6, -1, 1].map(d => lay.centre(mid + d)); // up, down, left, right on the map
    expect(moved.map(([x, y]) => [Math.sign(x - x0), Math.sign(y - y0)])).toEqual([[-1, -1], [1, 1], [-1, 1], [1, -1]]);
    expect(ACTIONS.map(a => [a.dr, a.dc])).toEqual([[-1, 0], [1, 0], [0, -1], [0, 1]]);
  });
  it('gives each action an on-screen direction and a matching explorer facing', () => {
    expect([0, 1, 2, 3].map(screenDir)).toEqual([[0, -1], [0, 1], [1, 0], [-1, 0]]);
    expect([0, 1, 2, 3].map(facingFor)).toEqual([6, 2, 4, 0]); // up-left, down-right, down-left, up-right
  });
  it('finds the action between two neighbouring tiles, or null when he did not move', () => {
    expect(actionBetween(map, 14, 8)).toBe(0);
    expect(actionBetween(map, 8, 14)).toBe(1);
    expect(actionBetween(map, 14, 13)).toBe(2);
    expect(actionBetween(map, 13, 14)).toBe(3);
    expect(actionBetween(map, 14, 14)).toBeNull();
  });
});

describe('isoLayout', () => {
  const map = loadMap('near-or-far');
  for (const [w, h] of [[600, 400], [340, 300]]) {
    it(`keeps every tile centre inside a ${w}x${h} canvas`, () => {
      const lay = isoLayout(map, w, h);
      for (let s = 0; s < map.nStates; s++) {
        const [x, y] = lay.centre(s);
        expect(x).toBeGreaterThan(0); expect(x).toBeLessThan(w);
        expect(y).toBeGreaterThan(0); expect(y).toBeLessThan(h);
      }
      expect(lay.th).toBeCloseTo(lay.tw / 2);
    });
    it(`centres the grid horizontally in ${w}x${h}`, () => {
      const lay = isoLayout(map, w, h);
      const xs = Array.from({ length: map.nStates }, (_, s) => lay.centre(s)[0]);
      expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(w / 2);
    });
  }
});

describe('painter order', () => {
  const map = loadMap('near-or-far');
  const depth = s => { const { r, c } = turnCell(map, s); return r + c; };
  it('draws a tile further front after every tile behind it', () => {
    const order = paintOrder(map);
    for (let i = 1; i < order.length; i++) expect(depth(order[i])).toBeGreaterThanOrEqual(depth(order[i - 1]));
    expect(order[0]).toBe(5); // the back corner
  });
});

describe('floorTile', () => {
  it('picks one of the first three floor tiles, the same every time', () => {
    const seen = new Set();
    for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) { const i = floorTile(r, c); seen.add(i); expect([0, 1, 2]).toContain(i); expect(floorTile(r, c)).toBe(i); }
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('explorerPose', () => {
  const map = loadMap('near-or-far');
  it('stands idle on his tile, facing up-right by default', () => {
    const p = explorerPose(map, { to: map.start });
    expect(p).toMatchObject({ ...turnCell(map, map.start), row: 0, col: 0, alpha: 1, sink: 0 });
  });
  it('runs between two tiles with run frames, facing the move', () => {
    const a = turnCell(map, 14), b = turnCell(map, 8);
    const half = explorerPose(map, { from: 14, to: 8, action: 0, k: 0.5 });
    expect(half.r).toBeCloseTo((a.r + b.r) / 2); expect(half.c).toBeCloseTo((a.c + b.c) / 2);
    expect(half.col).toBeGreaterThanOrEqual(1); expect(half.col).toBeLessThanOrEqual(10);
    expect(half.row).toBe(facingFor(0) / 2);
    expect(explorerPose(map, { from: 14, to: 8, action: 0, k: 0 })).toMatchObject(a);
  });
  it('picks up at a treasure, sinks into a pit and fades when out of steps', () => {
    const pick = explorerPose(map, { to: 0, action: 2, outcome: 'big', k: 1, e: 0.3 });
    expect(pick.col).toBeGreaterThanOrEqual(11); expect(pick.col).toBeLessThanOrEqual(20);
    expect(explorerPose(map, { to: 0, outcome: 'small', k: 1, e: 0.1 }).alpha).toBe(1);
    const pit = explorerPose(map, { to: 0, outcome: 'pit', k: 1, e: 0.3 });
    expect(pit.sink).toBeGreaterThan(0); expect(pit.alpha).toBeLessThan(1);
    expect(explorerPose(map, { to: 0, outcome: 'cap', k: 1, e: 0.2 }).alpha).toBeLessThan(1);
    expect(explorerPose(map, { to: 0, outcome: 'cap', k: 1, e: 5 }).alpha).toBe(0);
  });
});

describe('walkAt', () => {
  const map = loadMap('near-or-far');
  const path = [30, 24, 18, 12]; // Start, then up three tiles to the treasure side
  it('walks one tile per beat, facing the move, and starts on the first tile', () => {
    const a = walkAt(map, path, 'big', 0), b = walkAt(map, path, 'big', 15 + 7.5);
    expect(a).toMatchObject({ from: 30, to: 24, k: 0, outcome: null, done: false, action: 0 });
    expect(b).toMatchObject({ from: 24, to: 18, outcome: null });
    expect(b.k).toBeCloseTo(0.5);
  });
  it('arrives, then shows its outcome with seconds since arrival, then is done', () => {
    const arrived = walkAt(map, path, 'big', 3 * 15 + 30);
    expect(arrived).toMatchObject({ from: 18, to: 12, k: 1, outcome: 'big', done: false });
    expect(arrived.e).toBeCloseTo(0.5);
    expect(walkAt(map, path, 'big', 2 * 15 + 75).done).toBe(true);
  });
  it('stands still on a bump and keeps the last facing', () => {
    const w = walkAt(map, [30, 24, 24, 18], 'cap', 15 + 5);
    expect(w).toMatchObject({ from: null, to: 24, action: 0 });
  });
});

describe('smooth', () => {
  it('is a trailing mean of the same length', () => {
    expect(smooth([1, 1, 1, 1], 2)).toEqual([1, 1, 1, 1]);
    expect(smooth([0, 2, 4], 2)).toEqual([0, 1, 3]);
    expect(smooth([], 5)).toEqual([]);
    expect(smooth([3, 5, 7, 9, 11], 20)).toHaveLength(5);
  });
});

describe('drawMaze', () => {
  const map = loadMap('near-or-far');
  const values = Array(map.nStates).fill(2);
  const policy = Array.from({ length: map.nStates }, (_, s) => (s % 3 === 0 ? null : s % 4));
  const texts = calls => calls.filter(c => c[0] === 'fillText').map(c => c[1]);
  it('draws no sprites before the art has loaded, but still the darkness, arrows and badges', () => {
    const lc = lightCanvas();
    const { ctx, calls } = recorder();
    drawMaze(ctx, theme, { map, values, policy, robot: map.start, light: lc, w: 600, h: 400 });
    expect(calls.filter(c => c[0] === 'drawImage' && c[1] !== lc)).toHaveLength(0);
    expect(calls.some(c => c[0] === 'drawImage' && c[1] === lc)).toBe(true);
    expect(calls.filter(c => c[0] === 'closePath').length).toBeGreaterThan(0);
    expect(texts(calls)).toEqual(expect.arrayContaining(['+10', 'Start']));
    expect(calls.filter(c => c[0] === 'fillRect')).toHaveLength(1);
    expect(calls.find(c => c[0] === 'fillRect').at(-3)).toBe(theme.tray); // the stage's own colour, so the canvas has no box edge
  });
  it('draws a mid-move explorer after the tile he is walking onto', () => {
    const { ctx, calls } = recorder();
    drawMaze(ctx, theme, { map, values, policy: null, robot: 8, explorer: { from: 14, action: 0, k: 0.5 }, art, w: 600, h: 400 });
    const depth = s => { const { r, c } = turnCell(map, s); return r + c; };
    const sprites = calls.filter(c => c[0] === 'drawImage'), at = sprites.findIndex(c => c[1] === art.explorer);
    const tilesBefore = sprites.slice(0, at).filter(c => c[1] === art.tiles).length;
    expect(tilesBefore).toBeGreaterThanOrEqual(Array.from({ length: map.nStates }, (_, s) => s).filter(s => depth(s) <= depth(8)).length);
  });
  it('draws a sprite for every tile and one for the explorer', () => {
    const { ctx, calls } = recorder();
    drawMaze(ctx, theme, { map, values, policy, robot: map.start, art, w: 600, h: 400 });
    const sprites = calls.filter(c => c[0] === 'drawImage');
    expect(sprites.filter(c => c[1] === art.tiles).length).toBeGreaterThanOrEqual(map.nStates);
    expect(sprites.filter(c => c[1] === art.explorer)).toHaveLength(1);
  });
  it('draws one arrow per non-null policy entry, and none without a policy', () => {
    const { ctx, calls } = recorder();
    drawMaze(ctx, theme, { map, values, policy, robot: map.start, art, w: 600, h: 400 });
    expect(calls.filter(c => c[0] === 'closePath')).toHaveLength(policy.filter(p => p !== null).length);
    const none = recorder();
    drawMaze(none.ctx, theme, { map, values, policy: null, robot: null, art, showFour: false, q: null, w: 600, h: 400 });
    expect(none.calls.filter(c => c[0] === 'closePath')).toHaveLength(0);
    expect(none.calls.filter(c => c[0] === 'drawImage' && c[1] === art.explorer)).toHaveLength(0);
  });
  it('labels the treasures, the pits and Start, after every sprite', () => {
    const { ctx, calls } = recorder();
    drawMaze(ctx, theme, { map, values, policy, robot: map.start, art, w: 600, h: 400 });
    expect(texts(calls)).toEqual(expect.arrayContaining(['+10', '+3', 'Start']));
    const lastSprite = calls.map(c => c[0]).lastIndexOf('drawImage');
    expect(calls.findIndex(c => c[0] === 'fillText')).toBeGreaterThan(lastSprite);
    const cliff = recorder();
    drawMaze(cliff.ctx, theme, { map: loadMap('cliff-edge'), values: Array(36).fill(0), policy: null, robot: 30, art, w: 600, h: 400 });
    expect(texts(cliff.calls).filter(t => t === '-10')).toHaveLength(4);
  });
  it('cuts the darkness layer into the offscreen canvas and draws it over the stage, only when one is passed', () => {
    const lc = lightCanvas();
    const { ctx, calls } = recorder();
    drawMaze(ctx, theme, { map, values, policy, robot: map.start, art, light: lc, w: 600, h: 400 });
    expect(calls.some(c => c[0] === 'drawImage' && c[1] === lc)).toBe(true);
    expect(lc.calls.some(c => c[0] === 'fillRect')).toBe(true);
    const plain = recorder();
    drawMaze(plain.ctx, theme, { map, values, policy, robot: map.start, art, w: 600, h: 400 });
    expect(plain.calls.some(c => c[0] === 'drawImage' && c[1] === lc)).toBe(false);
  });
  it('lights more of the stage as values rise', () => {
    const cuts = v => { const lc = lightCanvas(); drawMaze(recorder().ctx, theme, { map, values: v, policy: null, robot: null, art, light: lc, w: 600, h: 400 }); return lc.calls.filter(c => c[0] === 'arc').length; };
    expect(cuts(Array(map.nStates).fill(5))).toBeGreaterThan(cuts(Array(map.nStates).fill(0)));
  });
});

describe('drawMaze on the always-dark stage', () => {
  const map = loadMap('near-or-far');
  const values = Array(map.nStates).fill(0);
  values[map.start] = 9;
  const policy = Array(map.nStates).fill(null);
  policy[map.start] = 3; policy[map.start + 1] = 3; // one arrow on a bright tile, one on a dark tile
  it('never draws in the page ink or ground colours', () => {
    const { ctx, calls } = recorder();
    drawMaze(ctx, theme, { map, values, policy, robot: map.start, art, light: lightCanvas(), now: 1, w: 600, h: 400 });
    for (const c of calls) {
      if (['fillRect', 'fillText', 'stroke', 'fill'].includes(c[0])) {
        const style = c[0] === 'stroke' ? c[c.length - 2] : c[c.length - 3];
        expect([theme.ground, theme.ink], c.join()).not.toContain(style);
      }
    }
  });
  it('draws the arrow on a bright tile more opaque than on a dark tile', () => {
    const { ctx, calls } = recorder();
    drawMaze(ctx, theme, { map, values, policy, robot: null, art, w: 600, h: 400 });
    const alphas = calls.filter(c => c[0] === 'stroke').map(c => c[c.length - 1]);
    expect(alphas).toHaveLength(2);
    expect(Math.max(...alphas)).toBeGreaterThan(Math.min(...alphas));
  });
});

describe('curvePoints', () => {
  it('keeps only a bounded tail but smooths with the earlier episodes', () => {
    const h = Array.from({ length: 5000 }, (_, i) => (i < 4990 ? 0 : 10));
    const { values, start } = curvePoints(h, 500, 20);
    expect(values).toHaveLength(500);
    expect(start).toBe(4500);
    expect(values[499]).toBeCloseTo(smooth(h, 20)[4999]);
  });
  it('returns the whole history when it is short, and keeps negatives', () => {
    const { values, start } = curvePoints([-10, -10], 500, 20);
    expect(start).toBe(0);
    expect(values).toEqual([-10, -10]);
    expect(curvePoints([], 500, 20)).toEqual({ values: [], start: 0 });
  });
});
