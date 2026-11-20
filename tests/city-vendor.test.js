import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { clampPitch, clampDistance, readColors } from '../games/city/scene-math.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const VENDOR = '../assets/vendor/three/three.module.min.js';

describe('vendored three.js', () => {
  it('is present, pinned to r160 and under 1.5 MB', () => {
    expect(existsSync(new URL(VENDOR, import.meta.url))).toBe(true);
    const src = read(VENDOR);
    expect(src.startsWith('/**\n * @license') || src.includes('REVISION="160"')).toBe(true);
    expect(statSync(new URL(VENDOR, import.meta.url)).size).toBeLessThan(1.5 * 1024 * 1024);
  });
  it('ships its MIT licence', () => {
    expect(read('../assets/vendor/three/LICENSE-three.txt')).toMatch(/MIT/);
  });
  it('no http imports in the page code', () => {
    for (const f of ['scene.js', 'main.js']) expect(read('../games/city/' + f)).not.toMatch(/from\s+['"]https?:|import\(\s*['"]https?:/);
    expect(read('../games/city/index.html')).not.toMatch(/<script[^>]+src="http/);
  });
});

describe('camera clamps', () => {
  it('keeps pitch between a low look and straight down', () => {
    expect(clampPitch(-1)).toBeGreaterThan(0.1);
    expect(clampPitch(5)).toBeLessThan(Math.PI / 2);
    expect(clampPitch(0.8)).toBe(0.8);
  });
  it('keeps distance within the city radius multiples', () => {
    expect(clampDistance(1, 100)).toBe(40);
    expect(clampDistance(1000, 100)).toBe(300);
    expect(clampDistance(150, 100)).toBe(150);
  });
});

describe('readColors', () => {
  it('reads tokens with fallbacks', () => {
    const style = { getPropertyValue: (k) => ({ '--stage': ' #101010 ' })[k] ?? '' };
    const c = readColors(style);
    expect(c.sky).toBe('#101010');
    expect(c.road).toMatch(/^#[0-9a-f]{6}$/i);
    expect(c.road.toLowerCase()).toBe('#3a3d42'); // neutral dark asphalt
    expect(c.walk.toLowerCase()).toBe('#a9a9a4'); // lighter grey sidewalks
    const grey = (h) => { const v = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); return Math.max(...v) - Math.min(...v); };
    const lum = (h) => [1, 3, 5].reduce((s, i) => s + parseInt(h.slice(i, i + 2), 16), 0) / 3;
    // the land beyond the city is clearly darker than the pale city footing, so the city has an edge
    expect(lum(c.farGround)).toBeLessThan(lum(c.ground) - 25);
    for (const k of ['road', 'walk', 'ground']) expect(grey(c[k])).toBeLessThanOrEqual(10); // no pink or brown cast
  });
});

describe('the windows hook', () => {
  it('vendored three.js still has the emissivemap_fragment include scene-look.js patches', () => {
    expect(readFileSync(new URL('../assets/vendor/three/three.module.min.js', import.meta.url), 'utf8')).toContain('#include <emissivemap_fragment>');
  });
});
