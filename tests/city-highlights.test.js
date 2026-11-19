import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { highlightsAt, highlightLook, OVERHEAD_BOOST, HOLD_MS } from '../games/city/highlights.js';

describe('highlightLook from overhead', () => {
  it('chase look is unchanged; overhead scales the arrow and ring up and makes the tile flash opaque', () => {
    expect(OVERHEAD_BOOST).toBeGreaterThan(1.4);
    expect(highlightLook('off', 0, false)).toEqual({ opacity: 0.3, boost: 1 });
    expect(highlightLook('wrong', 1, false)).toEqual({ opacity: 1, boost: 1 });
    expect(highlightLook('wrong', 0, true).boost).toBe(OVERHEAD_BOOST);
    expect(highlightLook('red', 0, true).boost).toBe(OVERHEAD_BOOST);
    expect(highlightLook('off', 0, true).boost).toBe(1);
    expect(highlightLook('off', 0, true).opacity).toBeGreaterThanOrEqual(0.7);
    expect(highlightLook('off', 1, true).opacity).toBeLessThanOrEqual(1);
  });
  it('the scene passes the overhead flag to the highlights', () => {
    expect(readFileSync(new URL('../games/city/scene.js', import.meta.url), 'utf8')).toMatch(/highlights\.update\([^\n]*overhead/);
    expect(readFileSync(new URL('../games/city/scene-highlights.js', import.meta.url), 'utf8')).toContain('highlightLook(');
  });
});

const o = (ms, type = 'off', extra = {}) => ({ ms, type, x: 10, z: 20, heading: 1.5, fine: 0, ...extra });

describe('highlightsAt', () => {
  it('is active from the offence to HOLD_MS later, and not before or after', () => {
    const list = [o(5000, 'red')];
    expect(highlightsAt(list, 4999)).toEqual([]);
    expect(highlightsAt(list, 5000)).toHaveLength(1);
    expect(highlightsAt(list, 5000 + 1500)).toHaveLength(1);
    expect(highlightsAt(list, 5000 + HOLD_MS)).toEqual([]);
  });
  it('holds at least 1.5 s', () => { expect(HOLD_MS).toBeGreaterThanOrEqual(1500); });
  it('carries type, position and heading', () => {
    expect(highlightsAt([o(0, 'wrong')], 10)[0]).toMatchObject({ type: 'wrong', x: 10, z: 20, heading: 1.5 });
  });
  it('k pulses with time, and is exactly 1 when reduced', () => {
    const list = [o(0)];
    const ks = [0, 60, 125, 190, 250, 400].map((t) => highlightsAt(list, t)[0].k);
    expect(new Set(ks).size).toBeGreaterThan(2);
    for (const k of ks) { expect(k).toBeGreaterThanOrEqual(0); expect(k).toBeLessThanOrEqual(1); }
    for (const t of [0, 60, 125, 700, 1600]) expect(highlightsAt(list, t, { reduced: true })[0].k).toBe(1);
  });
  it('two offences inside the window give two highlights', () => {
    expect(highlightsAt([o(1000), o(1800, 'red')], 2000).map((h) => h.type)).toEqual(['off', 'red']);
  });
  it('the same inputs give the same output', () => {
    const list = [o(100), o(900, 'wrong')];
    expect(highlightsAt(list, 1234)).toEqual(highlightsAt(list, 1234));
  });
});

describe('the pool', () => {
  it('when more highlights of one kind are live than the pool holds, the newest take the pool', async () => {
    const { createHighlights } = await import('../games/city/scene-highlights.js');
    const meshes = [];
    const hl = createHighlights({ add: (m) => meshes.push(m), remove() {} }, 10);
    const list = [1, 2, 3, 4, 5, 6].map((n) => ({ type: 'off', x: n, z: 0, heading: 0, k: 1 })); // oldest first
    hl.update(list);
    const shown = meshes.filter((m) => m.visible).map((m) => m.position.x).sort();
    expect(shown).toEqual([3, 4, 5, 6]);
  });
  it('a wrong-way arrow is drawn exactly where highlightsAt says, with no extra offset', () => {
    const src = readFileSync(new URL('../games/city/scene-highlights.js', import.meta.url), 'utf8');
    expect(src).not.toContain('AHEAD');
  });
  it('highlightsAt puts the wrong-way arrow at ax, az when the offence has them', () => {
    expect(highlightsAt([o(0, 'wrong', { ax: 7, az: 8 })], 10)[0]).toMatchObject({ x: 7, z: 8 });
    expect(highlightsAt([o(0, 'off', { ax: 7, az: 8 })], 10)[0]).toMatchObject({ x: 10, z: 20 });
  });
});

describe('the scene wiring', () => {
  const read = (f) => readFileSync(new URL('../games/city/' + f, import.meta.url), 'utf8');
  it('scene.js imports the pool and highlightsAt, makes the pool once, updates it each frame and clears it', () => {
    const scene = read('scene.js');
    expect(scene).toContain("from './scene-highlights.js'");
    expect(scene).toContain("from './highlights.js'");
    expect(scene.match(/createHighlights\(/g)).toHaveLength(1);
    expect(scene).toMatch(/highlights\.update\(highlightsAt\(play\.offences/);
    expect(scene).toMatch(/highlights\.clear\(\)/);
  });
  it('the pool is built from arrowPolys with transparent, no-depth-write, offset materials', () => {
    const src = read('scene-highlights.js');
    for (const s of ['arrowPolys', 'depthWrite: false', 'polygonOffset', 'transparent: true']) expect(src).toContain(s);
  });
  it('a folded tag restarts already opaque, and a refreshed fold moves to the back of the eviction order', () => {
    const main = read('main.js');
    expect(main).toMatch(/run\.count > 1[^;\n]*animationDelay\s*=\s*`?-\$\{TAG_LIFE_MS \* 0\.05\}ms/);
    expect(main).toMatch(/delete others\[tag\.text\]/);
  });
  it('main.js passes the offences into playTrip', () => {
    expect(read('main.js')).toMatch(/playTrip\(\{[^}]*offences: t\.offences/);
  });
});
