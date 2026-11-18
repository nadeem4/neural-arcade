import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildingSpec, drawnBuildings, osmColour, roofBoxes, FLOOR_H, KINDS } from '../games/city/buildings-model.js';

const sq = (x, y, s, extra = {}) => ({ ring: [[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]], h: 20, minH: null, levels: null, part: false, hasParts: false, roof: 'flat', colour: null, material: null, ...extra });
const hex = /^#[0-9a-f]{6}$/;

describe('buildingSpec', () => {
  it('same building, same spec', () => {
    expect(buildingSpec(sq(10, 20, 30), 7)).toEqual(buildingSpec(sq(10, 20, 30), 7));
  });
  it('gives a known kind, a hex colour and sane numbers', () => {
    const s = buildingSpec(sq(0, 0, 30), 1);
    expect(KINDS).toContain(s.kind);
    expect(s.colour).toMatch(hex);
    expect(s.floorH).toBeGreaterThanOrEqual(3);
    expect(s.floorH).toBeLessThanOrEqual(4.5);
    expect(s.bay).toBeGreaterThan(1);
    expect(s.fill).toBeGreaterThan(0);
    expect(s.fill).toBeLessThan(1);
  });
  it('building:material and building:colour win over the pick', () => {
    expect(buildingSpec(sq(0, 0, 30, { material: 'brick' }), 3).kind).toBe('brick');
    expect(buildingSpec(sq(0, 0, 30, { material: 'glass', h: 8 }), 3).kind).toBe('glass');
    expect(buildingSpec(sq(0, 0, 30, { material: 'metal' }), 3).kind).toBe('steel');
    expect(buildingSpec(sq(0, 0, 30, { material: 'stone' }), 3).kind).toBe('stone');
    const red = buildingSpec(sq(0, 0, 30, { material: 'brick', colour: '#a95151' }), 3).colour;
    const plain = buildingSpec(sq(0, 0, 30, { material: 'brick' }), 3).colour;
    expect(red).not.toBe(plain);
  });
  it('tall towers lean glass and steel, low buildings lean brick and stone', () => {
    const share = (h, kinds) => {
      let n = 0;
      for (let i = 0; i < 400; i++) if (kinds.includes(buildingSpec(sq(i * 7, i * 3, 20 + (i % 9), { h }), i).kind)) n++;
      return n / 400;
    };
    expect(share(150, ['glass', 'steel'])).toBeGreaterThan(0.6);
    expect(share(10, ['brick', 'stone'])).toBeGreaterThan(0.5);
    expect(share(10, ['glass', 'steel'])).toBeLessThan(0.3);
  });
  it('floors follow the real floor height: levels when tagged, else about 3.5 m each', () => {
    expect(buildingSpec(sq(0, 0, 20, { h: 35 }), 1).floors).toBe(Math.round(35 / FLOOR_H));
    const t = buildingSpec(sq(0, 0, 20, { h: 40, levels: 10 }), 1);
    expect(t.floors).toBe(10);
    expect(t.floorH).toBeCloseTo(4, 5);
    const part = buildingSpec(sq(0, 0, 20, { h: 50, minH: 30 }), 1);
    expect(part.floors).toBe(Math.round(20 / FLOOR_H));
  });
  it('shopfront band only on the ground floor of buildings with two or more floors, never on lifted parts', () => {
    expect(buildingSpec(sq(0, 0, 20, { h: 20 }), 1).shopH).toBeGreaterThan(0);
    expect(buildingSpec(sq(0, 0, 20, { h: 3 }), 1).shopH).toBe(0);
    expect(buildingSpec(sq(0, 0, 20, { h: 40, minH: 12 }), 1).shopH).toBe(0);
  });
});

describe('osmColour', () => {
  it('reads hex and a few named colours, and null for rubbish', () => {
    expect(osmColour('#536992')).toMatch(hex);
    expect(osmColour('tan')).toMatch(hex);
    expect(osmColour('lightgrey')).toMatch(hex);
    expect(osmColour('nonsense')).toBeNull();
    expect(osmColour(null)).toBeNull();
  });
  it('mutes loud colours so the city stays restrained', () => {
    const sat = (h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); return Math.max(r, g, b) - Math.min(r, g, b); };
    expect(sat(osmColour('#E3674D'))).toBeLessThan(sat('#E3674D'));
  });
});

describe('drawnBuildings', () => {
  it('part replaces the parent mass in its footprint: an outline with parts is not drawn, its parts are', () => {
    const outline = sq(0, 0, 50, { hasParts: true, h: 80 });
    const a = sq(0, 0, 25, { part: true, h: 80 });
    const b = sq(25, 0, 25, { part: true, h: 30, minH: 0 });
    const lone = sq(100, 0, 10);
    const out = drawnBuildings([outline, a, b, lone]);
    expect(out.map((o) => o.id)).toEqual([1, 2, 3]);
    expect(out.map((o) => o.b)).toEqual([a, b, lone]);
  });
});

describe('roofBoxes', () => {
  const inside = (x, y, ring) => {
    let c = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  it('big flat roofs get a few boxes, deterministic, every corner inside the footprint', () => {
    const b = sq(0, 0, 40);
    const a = roofBoxes(b, 5);
    expect(a.length).toBeGreaterThan(0);
    expect(roofBoxes(b, 5)).toEqual(a);
    for (const box of a) {
      expect(box.h).toBeGreaterThan(0);
      for (const [x, y] of box.corners) expect(inside(x, y, b.ring)).toBe(true);
    }
  });
  it('on an L-shaped roof no box straddles the notch: centre and edge midpoints are inside too', () => {
    const L = { ...sq(0, 0, 10), ring: [[0, 0], [60, 0], [60, 20], [20, 20], [20, 60], [0, 60], [0, 0]] };
    let seen = 0;
    for (let id = 0; id < 300; id++) {
      for (const box of roofBoxes(L, id)) {
        seen++;
        const c = box.corners;
        const pts = [[(c[0][0] + c[2][0]) / 2, (c[0][1] + c[2][1]) / 2], ...c.map((p, i) => [(p[0] + c[(i + 1) % 4][0]) / 2, (p[1] + c[(i + 1) % 4][1]) / 2])];
        for (const [x, y] of [...c, ...pts]) expect(inside(x, y, L.ring)).toBe(true);
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
  it('small or pitched roofs get none', () => {
    expect(roofBoxes(sq(0, 0, 10), 5)).toEqual([]);
    expect(roofBoxes(sq(0, 0, 40, { roof: 'gabled' }), 5)).toEqual([]);
  });
});

describe('record mode stays deterministic', () => {
  it('the building modules never read a clock or Math.random', () => {
    for (const f of ['buildings-model.js', 'facade.js', 'geometry.js']) {
      const src = readFileSync(new URL('../games/city/' + f, import.meta.url), 'utf8');
      expect(src, f).not.toMatch(/Math\.random|Date\.now|performance\.now/);
    }
  });
});

describe('real map', () => {
  it('every building gets a valid spec', () => {
    const city = JSON.parse(readFileSync(new URL('../games/city/chicago.json', import.meta.url)));
    const kinds = new Set();
    city.buildings.forEach((b, i) => {
      const s = buildingSpec(b, i);
      kinds.add(s.kind);
      expect(s.colour).toMatch(hex);
      expect(Number.isFinite(s.floors)).toBe(true);
    });
    expect(kinds.size).toBeGreaterThanOrEqual(4);
  });
});
