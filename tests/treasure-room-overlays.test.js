import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ROOM } from '../games/treasure-room/sim.js';
import { ACTIONS } from '../assets/grid.js';
import { OVERLAYS, OVERLAYS_FOR_LEVEL, overlayNames, valuesList, marksList, arrowsList, trailList } from '../games/treasure-room/room-overlays.js';
import { heatColor } from '../games/treasure-room/room-math.js';

const read = f => readFileSync(new URL('../games/treasure-room/' + f, import.meta.url), 'utf8');
const v = new Array(25).fill(0);
v[6] = 1.2; // the tile at x = 1, y = 1
const heat = v.map(x => x / 1.2);

describe('valuesList', () => {
  const L = valuesList(ROOM, v, heat);
  it('labels floor tiles only', () => {
    expect(L.labels).toHaveLength(ROOM.cells.flat().filter(c => !'TX#'.includes(c)).length);
    expect(L.tiles).toHaveLength(L.labels.length);
  });
  it('writes one decimal', () => {
    expect(L.labels.find(l => l.x === 1 && l.y === 1).text).toBe('1.2');
  });
  it('never writes a negative zero', () => {
    expect(valuesList(ROOM, [-0.04, ...new Array(24).fill(0)], new Array(25).fill(0)).labels[0].text).toBe('0.0');
  });
  it('is empty when there are no values', () => {
    expect(valuesList(ROOM, undefined, undefined)).toEqual({ labels: [], tiles: [] });
  });
  it('keeps heat inside 0..1', () => {
    expect(L.tiles.every(t => t.h >= 0 && t.h <= 1)).toBe(true);
    expect(valuesList(ROOM, v, v.map(() => 3)).tiles.every(t => t.h === 1)).toBe(true);
  });
});

describe('registry', () => {
  it('lists the outlined tiles', () => {
    expect(marksList([{ x: 1, y: 2 }])).toEqual([{ x: 1, y: 2 }]);
    expect(marksList(undefined)).toEqual([]);
  });
  it('rejects an unknown overlay name', () => {
    expect(() => overlayNames(['values', 'nope'])).toThrow(/nope/);
    expect(overlayNames(OVERLAYS_FOR_LEVEL[5])).toEqual(['values']);
    expect(overlayNames(undefined)).toEqual([]);
  });
  it('has a list for each overlay, and a row for each level', () => {
    expect(OVERLAYS.values.list(ROOM, { values: v, heat })).toEqual(valuesList(ROOM, v, heat));
    expect(Object.keys(OVERLAYS_FOR_LEVEL).map(Number)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('heatColor', () => {
  it('is fainter when cool, clamps, and treats NaN as 0', () => {
    expect(heatColor(0)[3]).toBeLessThan(heatColor(1)[3]);
    expect(heatColor(2)).toEqual(heatColor(1));
    expect(heatColor(-1)).toEqual(heatColor(0));
    expect(heatColor(NaN)).toEqual(heatColor(0));
    expect(heatColor(0.5)).toHaveLength(4);
  });
});

describe('source guards', () => {
  it('overlays stay pure', () => {
    expect(read('room-overlays.js')).not.toMatch(/from\s+['"]three|document\./);
  });
  it('labels are one merged mesh, not sprites', () => {
    expect(read('room-labels.js')).not.toMatch(/new\s+THREE\.Sprite/);
    expect(read('room-labels.js')).toMatch(/JetBrains Mono/);
  });
  it('the panel hands the level its overlays', () => {
    expect(read('level-panel.js')).toMatch(/setOverlays\(OVERLAYS_FOR_LEVEL\[n\]\)/);
  });
  it('the scene builds its layers from the mesh registry and draws marks as rings', () => {
    const s = read('room-scene.js');
    expect(s).toMatch(/MESH_LAYERS/);
    expect(s).toMatch(/marksList\(/);
  });
});

describe('arrowsList', () => {
  const pol = new Array(25).fill(3); // every tile says right (ACTIONS index 3)
  pol[5] = 0; // the tile at x = 0, y = 1 says up
  const A = arrowsList(ROOM, pol, ACTIONS);
  it('draws floor tiles only', () => {
    expect(A.every(a => !'TX#'.includes(ROOM.cells[a.y][a.x]))).toBe(true);
  });
  it('maps the policy action to a compass direction', () => {
    expect(A.find(a => a.x === 0 && a.y === 0).dir).toBe('E');
    expect(A.find(a => a.x === 0 && a.y === 1).dir).toBe('N');
  });
  it('uses one angle per direction', () => {
    expect(new Set(A.map(a => a.rotY)).size).toBe(new Set(A.map(a => a.dir)).size);
  });
  it('is empty with no policy, and skips tiles with no action', () => {
    expect(arrowsList(ROOM, undefined, ACTIONS)).toEqual([]);
    const p = pol.slice(); p[0] = -1;
    expect(arrowsList(ROOM, p, ACTIONS).some(a => a.x === 0 && a.y === 0)).toBe(false);
  });
});

describe('trailList', () => {
  const a = { x: 0, y: 0 }, b = { x: 1, y: 0 }, c = { x: 2, y: 0 }, d = { x: 3, y: 0 };
  it('shrinks with the discount down to a floor', () => {
    expect(trailList(ROOM, [[a, b, c]], 0.5).routes[0].map(t => t.scale)).toEqual([1, 0.5, 0.25]);
  });
  it('marks the second route faint', () => {
    expect(trailList(ROOM, [[a, b], [c, d]], 1).faint).toEqual([false, true]);
  });
  it('treats one cell as no route, and accepts a bare route', () => {
    expect(trailList(ROOM, [a], 1).routes).toEqual([]);
    expect(trailList(ROOM, [a, b], 1).routes).toHaveLength(1);
    expect(trailList(ROOM, undefined, 1).routes).toEqual([]);
  });
});

describe('arrows and trail registry', () => {
  it('level 4 draws arrows and the level passes gamma with its ghost', () => {
    expect(overlayNames(OVERLAYS_FOR_LEVEL[4])).toEqual(['arrows']);
    expect(Object.keys(OVERLAYS)).toEqual(expect.arrayContaining(['arrows', 'trail']));
    expect(read('level-return.js')).toMatch(/ghost: s\.cells, gamma/);
  });
});

describe('level 3 trail', () => {
  it('level 3 draws the trail', () => {
    expect(overlayNames(OVERLAYS_FOR_LEVEL[3])).toContain('trail');
  });
  it('the scene shows a focus ring on setFocus', () => {
    expect(read('room-scene.js')).toMatch(/setFocus\(cell\) \{ focusRing\.set\(/);
  });
});
