import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../engine/rng.js';
import {
  newGame, step, push, LIMIT, DT, FAIL_ANGLE, X_LIMIT, F_MAX, WIND_FORCE, PUSH_DV,
} from '../games/balance/sim.js';

describe('balance sim', () => {
  it('constants', () => {
    expect(LIMIT).toBe(1200);
    expect(DT).toBe(1 / 60);
    expect(FAIL_ANGLE).toBe(0.4);
    expect(X_LIMIT).toBe(2.4);
    expect(F_MAX).toBe(10);
  });

  it('upright and still stays put', () => {
    const g = newGame(0);
    for (let i = 0; i < 600; i++) expect(step(g, 0)).toBe(null);
    expect(g.th).toBe(0);
    expect(g.x).toBe(0);
    expect(g.v).toBe(0);
  });

  it('a rightward force pushes the cart right and the top left', () => {
    const g = newGame(0);
    for (let i = 0; i < 5; i++) step(g, 1);
    expect(g.v).toBeGreaterThan(0);
    expect(g.w).toBeLessThan(0);
  });

  it('mirror symmetry', () => {
    const a = newGame(0.05), b = newGame(-0.05);
    for (let i = 0; i < 120; i++) { step(a, 0.3); step(b, -0.3); }
    expect(a.x).toBeCloseTo(-b.x, 10);
    expect(a.th).toBeCloseTo(-b.th, 10);
  });

  it('doing nothing falls from the start tilt within 2 s, and not instantly', () => {
    const g = newGame();
    let r = null, n = 0;
    while (!r && n < 600) { r = step(g, 0); n++; }
    expect(r).toBe('tilt');
    expect(n).toBeGreaterThanOrEqual(18);
    expect(n).toBeLessThanOrEqual(120);
  });

  it('random key-masher input falls within 3 s', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const rnd = mulberry32(seed);
      const g = newGame();
      let u = 0, hold = 0, r = null, n = 0;
      while (!r && n < 600) {
        if (hold === 0) { u = rnd() < 0.5 ? -1 : 1; hold = 5 + Math.floor(rnd() * 20); }
        hold--;
        r = step(g, u);
        n++;
      }
      expect(r === 'tilt' || r === 'rail').toBe(true);
      expect(n).toBeLessThan(180);
      expect(n).toBeGreaterThanOrEqual(6);
    }
  });

  it('reports the rail', () => {
    const g = newGame(0);
    g.x = 2.39; g.v = 3;
    expect(step(g, 0)).toBe('rail');
  });

  it('wind pushes with no controller', () => {
    const a = newGame(0);
    step(a, 0, WIND_FORCE);
    expect(a.v).toBeGreaterThan(0);
    const b = newGame(0);
    step(b, 0, -WIND_FORCE);
    expect(b.v).toBeLessThan(0);
  });

  it('push kicks the cart velocity by PUSH_DV in either direction', () => {
    const g = newGame(0);
    push(g, 1);
    expect(g.v).toBeCloseTo(PUSH_DV, 12);
    push(g, -1);
    push(g, -1);
    expect(g.v).toBeCloseTo(-PUSH_DV, 12);
  });

  it('state stays finite under 1000 random steps with random pushes and wind', () => {
    const rnd = mulberry32(7);
    const g = newGame();
    for (let i = 0; i < 1000; i++) {
      if (rnd() < 0.05) push(g, rnd() < 0.5 ? -1 : 1);
      step(g, rnd() * 2 - 1, rnd() < 0.5 ? WIND_FORCE : -WIND_FORCE);
    }
    for (const k of ['x', 'v', 'th', 'w', 't']) expect(Number.isFinite(g[k])).toBe(true);
  });

  it('step clamps u to [-1, 1]', () => {
    const a = newGame(), b = newGame();
    step(a, 5);
    step(b, 1);
    expect(a).toEqual(b);
    const c = newGame(), d = newGame();
    step(c, -5);
    step(d, -1);
    expect(c).toEqual(d);
  });

  it('tilt wins when tilt and rail fail on the same step', () => {
    const g = newGame(0.5);
    g.x = 3;
    expect(step(g, 0)).toBe('tilt');
  });
});
