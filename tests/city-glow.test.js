import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { tierFor } from '../games/city/quality.js';
import { buildSignalHeads, paintLamps } from '../games/city/signal-heads.js';
import { lampCentres, signalGlow, brakeGlow, createGlow, SIGNAL_GLOW } from '../games/city/glow.js';

const CITY = JSON.parse(readFileSync(new URL('../games/city/chicago.json', import.meta.url), 'utf8'));
const src = (f) => readFileSync(new URL('../games/city/' + f, import.meta.url), 'utf8');
const sig = buildSignalHeads(CITY.signalHeads ?? [], CITY.roads ?? []);

describe('quality: bloom', () => {
  it('is on for the desktop tier and off for phones, in the one tier table', () => {
    expect(tierFor({ phone: false }).bloom).toBe(true);
    expect(tierFor({ phone: true }).bloom).toBe(false);
  });
  it('the scene only builds glow when the tier says bloom, and never reads a clock for it', () => {
    expect(src('scene.js')).toMatch(/tier\.bloom/);
    expect(src('glow.js')).not.toMatch(/Date\.now|performance\.now|Math\.random/);
  });
});

describe('glow', () => {
  it('has one centre per signal lamp, inside the lamp quad', () => {
    const c = lampCentres(sig.lamps);
    expect(c).toHaveLength(sig.lamps.list.length);
    expect(c.length).toBeGreaterThan(0);
    const p = sig.lamps.positions, f = sig.lamps.list[0].first;
    expect(Math.abs(c[0].x - p[f * 3])).toBeLessThan(1);
    expect(Math.abs(c[0].y - p[f * 3 + 1])).toBeLessThan(1);
  });
  it('lights only the lamps that are on: red on stop, green on go, amber and the rest dark', () => {
    paintLamps(sig.lamps, { 0: 'stop', 1: 'go' });
    const g = signalGlow(sig.lamps);
    const lit = sig.lamps.list.filter((_, i) => g[i * 3] + g[i * 3 + 1] + g[i * 3 + 2] > 0);
    expect(lit.length).toBeGreaterThan(0);
    expect(lit.length).toBeLessThan(sig.lamps.list.length / 2);
    expect(lit.every((l) => (l.axis === 0 && l.role === 'red') || (l.axis === 1 && l.role === 'green'))).toBe(true);
    for (let i = 0; i < sig.lamps.list.length; i++) expect(Math.max(g[i * 3], g[i * 3 + 1], g[i * 3 + 2])).toBeLessThanOrEqual(SIGNAL_GLOW + 1e-6);
  });
  it('the same lights give the same glow', () => {
    paintLamps(sig.lamps, { 0: 'go', 1: 'stop' });
    expect(Array.from(signalGlow(sig.lamps))).toEqual(Array.from(signalGlow(sig.lamps)));
  });
  it('a hidden signal head shows no glow', () => {
    paintLamps(sig.lamps, { 0: 'stop', 1: 'stop' });
    const g = signalGlow(sig.lamps, undefined, new Set(sig.lamps.list.keys()));
    expect(g.every((v) => v === 0)).toBe(true);
  });
  it('brake glow is on only while braking', () => {
    expect(brakeGlow(true)).toBeGreaterThan(0);
    expect(brakeGlow(false)).toBe(0);
  });
  it('createGlow keeps one point per item and lets a caller move and recolour it', () => {
    const gl = createGlow([{ x: 1, y: 2, z: 3, r: 1, g: 0, b: 0 }, { x: 4, y: 5, z: 6, r: 0, g: 1, b: 0 }]);
    expect(gl.points.geometry.attributes.position.count).toBe(2);
    gl.move(1, 7, 8, 9); gl.setColour(0, 0, 0, 0);
    expect(Array.from(gl.points.geometry.attributes.position.array.slice(3))).toEqual([7, 8, 9]);
    expect(Array.from(gl.colours.slice(0, 3))).toEqual([0, 0, 0]);
    gl.dispose();
  });
});
