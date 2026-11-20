import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ROOM } from '../games/treasure-room/sim.js';
import { OVERLAYS, OVERLAYS_FOR_LEVEL, overlayNames, valuesList, marksList } from '../games/treasure-room/room-overlays.js';
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
