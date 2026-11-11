import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../engine/rng.js';
import {
  startTry, advance, pushTry, seconds, keyDir, KEY_MAP, pidAct,
  newGame, step, push, LIMIT, DT, FAIL_ANGLE, X_LIMIT, F_MAX, WIND_FORCE, PUSH_DV, HUMAN_POWER,
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

  it('a key-masher with the human power still falls within 3 s', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const rnd = mulberry32(seed);
      const g = newGame();
      let u = 0, hold = 0, r = null, n = 0;
      while (!r && n < 600) {
        if (hold === 0) { u = rnd() < 0.5 ? -1 : 1; hold = 5 + Math.floor(rnd() * 20); }
        hold--;
        r = step(g, u * HUMAN_POWER);
        n++;
      }
      expect(r === 'tilt' || r === 'rail').toBe(true);
      expect(n).toBeLessThan(180);
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

describe('balance tries and keys', () => {
  const dials = { p: 25, i: 0, d: 4 };

  it('startTry gives a fresh PID memory every time', () => {
    const run = startTry();
    for (let k = 0; k < 300; k++) advance(run, pidAct(run.pid, run.g, { p: 25, i: 12, d: 4 }));
    expect(run.pid.sum).not.toBe(0);
    const next = startTry();
    expect(next.pid.sum).toBe(0);
    expect(next.pid.prev).toBe(null);
    expect(next.g.t).toBe(0);
    expect(next.outcome).toBe(null);
    expect(next.reason).toBe(null);
  });

  it("advance ends with 'fell' and the reason", () => {
    const tilt = startTry();
    let r = null;
    while (!r) r = advance(tilt, 0);
    expect(r).toBe('fell');
    expect(tilt.outcome).toBe('fell');
    expect(tilt.reason).toBe('tilt');
    const rail = startTry(0);
    rail.g.x = 2.39; rail.g.v = 2;
    r = advance(rail, 0);
    expect(r).toBe('fell');
    expect(rail.outcome).toBe('fell');
    expect(rail.reason).toBe('rail');
  });

  it("a pole that is held up reaches 'limit' at exactly 1200 steps", () => {
    const run = startTry();
    let r = null;
    while (!r) r = advance(run, pidAct(run.pid, run.g, dials));
    expect(r).toBe('limit');
    expect(run.outcome).toBe('limit');
    expect(run.g.t).toBe(1200);
  });

  it('advance and pushTry do nothing after the end', () => {
    const run = startTry();
    while (!advance(run, 0));
    const before = structuredClone(run.g);
    expect(advance(run, 1)).toBe('fell');
    pushTry(run, 1);
    expect(run.g).toEqual(before);
  });

  it('pushTry spam keeps state finite', () => {
    const run = startTry();
    for (let k = 0; k < 1000; k++) pushTry(run, k % 2 ? 1 : -1);
    for (const v of Object.values(run.g)) expect(Number.isFinite(v)).toBe(true);
  });

  it('seconds is steps over 60', () => {
    const run = startTry();
    for (let k = 0; k < 90; k++) advance(run, pidAct(run.pid, run.g, dials));
    expect(seconds(run)).toBe(1.5);
  });

  it('keyDir reads held keys; both cancel', () => {
    expect(keyDir({ left: true })).toBe(-1);
    expect(keyDir({ right: true })).toBe(1);
    expect(keyDir({ left: true, right: true })).toBe(0);
    expect(keyDir({})).toBe(0);
    expect(Object.keys(KEY_MAP).sort()).toEqual(['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD']);
    expect(KEY_MAP.KeyA).toBe('left');
    expect(KEY_MAP.ArrowRight).toBe('right');
  });
});
