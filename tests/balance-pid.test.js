import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../engine/rng.js';
import {
  newGame, step, push, LIMIT, WIND_FORCE, START_TILT, I_MAX, PID_RANGES, createPid, pidAct,
} from '../games/balance/sim.js';

function runPid(gains, { wind = 0, pushAt = null, pushDir = 1, tilt = START_TILT } = {}) {
  const g = newGame(tilt), pid = createPid();
  const th = [], x = [];
  let outcome = null, steps = 0;
  while (steps < LIMIT) {
    if (pushAt !== null && steps === pushAt) push(g, pushDir);
    outcome = step(g, pidAct(pid, g, gains), wind);
    steps++;
    th.push(g.th); x.push(g.x);
    if (outcome) break;
  }
  return { outcome, th, x, steps };
}
const maxAbs = (a) => a.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
const crossings = (a) => a.slice(1).filter((v, i) => (v > 0) !== (a[i] > 0)).length;

describe('balance pid', () => {
  it('ranges', () => {
    expect(PID_RANGES).toEqual({
      p: { min: 0, max: 60, step: 1, def: 25 },
      i: { min: 0, max: 30, step: 1, def: 0 },
      d: { min: 0, max: 10, step: 0.5, def: 0 },
    });
  });

  it('P alone wobbles, falls', () => {
    const r = runPid({ p: 25, i: 0, d: 0 });
    expect(r.outcome).toBe('tilt');
    expect(crossings(r.th)).toBeGreaterThanOrEqual(6);
    expect(r.steps).toBeLessThanOrEqual(900);
  });

  it('P and D together settle', () => {
    const r = runPid({ p: 25, i: 0, d: 4 });
    expect(r.outcome).toBe(null);
    expect(maxAbs(r.th.slice(-300))).toBeLessThan(0.01);
    expect(maxAbs(r.x.slice(-300))).toBeLessThan(0.15);
  });

  it('D calms it: much less swing than P alone', () => {
    const a = runPid({ p: 25, i: 0, d: 0 }), b = runPid({ p: 25, i: 0, d: 4 });
    expect(maxAbs(b.th.slice(120, 480))).toBeLessThan(maxAbs(a.th.slice(120, 480)) / 5);
  });

  it('survives a push either way', () => {
    for (const pushDir of [1, -1]) {
      const r = runPid({ p: 25, i: 0, d: 4 }, { pushAt: 180, pushDir });
      expect(r.outcome).toBe(null);
      const peak = maxAbs(r.th.slice(180));
      expect(peak).toBeGreaterThan(0.03);
      expect(peak).toBeLessThan(0.2);
    }
  });

  it('wind with I off parks the cart off-centre; I brings it back', () => {
    for (const wind of [WIND_FORCE, -WIND_FORCE]) {
      const a = runPid({ p: 25, i: 0, d: 4 }, { wind });
      expect(a.outcome).toBe(null);
      expect(maxAbs(a.x.slice(-300))).toBeGreaterThan(0.5);
      expect(maxAbs(a.x.slice(-300))).toBeLessThan(1.5);
      const b = runPid({ p: 25, i: 12, d: 4 }, { wind });
      expect(b.outcome).toBe(null);
      expect(maxAbs(b.x.slice(-300))).toBeLessThan(0.15);
      expect(maxAbs(b.th.slice(-300))).toBeLessThan(0.01);
    }
  });

  it('P too weak cannot hold', () => {
    const r = runPid({ p: 15, i: 0, d: 4 });
    expect(r.outcome).not.toBe(null);
    expect(r.steps).toBeLessThan(LIMIT);
  });

  it('no dial means no help', () => {
    const none = runPid({ p: 0, i: 0, d: 0 });
    expect(none.outcome).toBe('tilt');
    const n = newGame();
    let r = null, k = 0;
    while (!r) { r = step(n, 0); k++; }
    expect(none.steps).toBe(k);
  });

  it('force always clamped and finite', () => {
    const { p, i, d } = PID_RANGES;
    const rnd = mulberry32(3);
    for (const gp of [p.min, p.max]) for (const gi of [i.min, i.max]) for (const gd of [d.min, d.max]) {
      for (const wind of [0, WIND_FORCE]) {
        const g = newGame((rnd() - 0.5) * 0.2), pid = createPid();
        for (let s = 0; s < 600; s++) {
          const u = pidAct(pid, g, { p: gp, i: gi, d: gd });
          expect(Math.abs(u)).toBeLessThanOrEqual(1);
          expect(Number.isFinite(u)).toBe(true);
          if (step(g, u, wind)) break;
        }
        for (const k of ['x', 'v', 'th', 'w']) expect(Number.isFinite(g[k])).toBe(true);
      }
    }
  });

  it('integral bounded', () => {
    const g = newGame(), pid = createPid();
    for (let s = 0; s < LIMIT; s++) {
      if (step(g, pidAct(pid, g, { p: 25, i: 30, d: 4 }), WIND_FORCE)) break;
    }
    expect(Math.abs(pid.sum)).toBeLessThanOrEqual(I_MAX);
    const h = newGame(0.3), q = createPid();
    for (let s = 0; s < 1000; s++) pidAct(q, h, { p: 1, i: 30, d: 0 });
    expect(Math.abs(q.sum)).toBeLessThanOrEqual(I_MAX);
  });

  it('first call has no derivative kick', () => {
    const g = newGame(0.2);
    expect(pidAct(createPid(), g, { p: 0, i: 0, d: 10 })).toBe(0);
  });
});
