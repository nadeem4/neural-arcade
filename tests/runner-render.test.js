import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { skyFor, TILE, VIEW_W, VIEW_H } from '../games/runner/render.js';

const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

describe('the sky', () => {
  it('keeps the day look in the light theme', () => {
    const d = skyFor(false);
    expect(d.night).toBe(false);
    expect(d.stars).toEqual([]);
  });
  it('is a navy night with a few fixed stars in the dark theme', () => {
    const n = skyFor(true);
    expect(n.night).toBe(true);
    expect(n.sky).toMatch(/^#/);
    expect(n.hillTint).toBeTruthy();
    expect(n.stars.length).toBeGreaterThan(0);
    expect(n.stars.length).toBeLessThan(40);
    expect(skyFor(true).stars).toEqual(n.stars);
    for (const s of n.stars) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThan(VIEW_W * TILE);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThan((VIEW_H - 3) * TILE);
    }
  });
});

describe('the dark flag', () => {
  it('theme.js exports isDark and readTheme carries it; main.js hands it to drawLevel', () => {
    const t = read('assets/theme.js');
    expect(t).toMatch(/export function isDark/);
    expect(t).toMatch(/dark:\s*isDark\(\)/);
    expect(read('games/runner/main.js')).toMatch(/dark:\s*theme\.dark/);
  });
});
