import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../engine/rng.js';
import { createLearner } from '../engine/reinforce.js';
import {
  newGame, step, sense, isPit, N_IN, RUNNER_SIZES, LIMIT, DECIDE, PITS, BLOCK, ENEMY, FLAG_X, PRESETS,
  scoreFrame, playTry, createTrainer,
} from '../games/runner/sim.js';

// Plays a fixed strategy (a function of the game state) until the try ends.
function play(strategy) {
  const g = newGame();
  let ev = {}, a = 0, coins = 0;
  for (let t = 0; t < LIMIT; t++) {
    if (t % DECIDE === 0) a = strategy(g);
    ev = step(g, a); coins += ev.coins;
    if (ev.died || ev.finished) break;
  }
  return { g, ev, coins };
}
const WAIT = 0, RIGHT = 1, HOP = 2, JUMP = 3;

describe('the level', () => {
  it('waiting at the start is safe until time runs out', () => {
    const { g, ev } = play(() => WAIT);
    expect(ev.died || ev.finished).toBe(false);
    expect(g.t).toBe(LIMIT);
  });

  it('running without jumping falls into the first pit', () => {
    const { g, ev } = play(() => RIGHT);
    expect(ev.died).toBe(true);
    expect(g.x).toBeGreaterThan(PITS[0][0] - 1);
    expect(g.x).toBeLessThan(PITS[0][1] + 1);
  });

  it('can be finished by jumping at every pit edge, the step and the enemy', () => {
    const { ev } = play(g => {
      const f = Math.floor(g.x + 0.8), near = g.eAlive && g.ex - g.x > 0 && g.ex - g.x < 2.5;
      return isPit(f) || isPit(f + 1) || f + 1 === 38 || f === 38 || near ? HOP : RIGHT;
    });
    expect(ev.finished).toBe(true);
  });

  it('pays a coin every time the block is bumped from below', () => {
    const { coins } = play(g => (g.x + 0.4 < BLOCK.x + 0.3 ? RIGHT : JUMP));
    expect(coins).toBeGreaterThan(15);
  });

  it('squashes the enemy when the hero lands on it', () => {
    const g = newGame();
    Object.assign(g, { x: ENEMY.from + 0.1, y: 2.85, vy: -3, onGround: false });
    g.ex = ENEMY.from;
    const ev = step(g, WAIT);
    expect(ev.died).toBe(false);
    expect(ev.stomped).toBe(true);
    expect(g.eAlive).toBe(false);
  });

  it('touching the enemy from the side is deadly', () => {
    const g = newGame();
    Object.assign(g, { x: ENEMY.from - 0.7, y: 2 });
    g.ex = ENEMY.from;
    expect(step(g, RIGHT).died).toBe(true);
  });

  it('reaching the flag finishes the try', () => {
    const g = newGame();
    Object.assign(g, { x: FLAG_X - 0.05, y: 2 });
    expect(step(g, RIGHT).finished).toBe(true);
  });
});

describe('what the hero senses', () => {
  it('is twelve numbers between -1 and 1', () => {
    const v = sense(newGame(), new Float32Array(N_IN));
    expect(v.length).toBe(12);
    expect([...v].every(x => x >= -1 && x <= 1)).toBe(true);
    expect(RUNNER_SIZES).toEqual([12, 8, 4]);
  });

  it('sees the pit coming', () => {
    const g = newGame(); g.x = PITS[0][0] - 1.8;
    const v = sense(g, new Float32Array(N_IN));
    expect(v[0] === 1 || v[1] === 1 || v[2] === 1).toBe(true);
  });
});

describe('scoring', () => {
  const rules = { flag: 10, coin: 2, progress: 1, death: 5, second: -0.5 };
  it('pays progress only for new ground, so walking back and forth earns nothing', () => {
    const g = newGame();
    g.maxX = 5; g.x = 4;
    expect(scoreFrame(g, { coins: 0 }, rules)).toBeCloseTo(-0.5 / 60, 6);
    g.x = 6;
    expect(scoreFrame(g, { coins: 0 }, rules)).toBeCloseTo(1 - 0.5 / 60, 6);
    expect(g.maxX).toBe(6);
  });
  it('adds coins, the flag and the death penalty', () => {
    const g = newGame(); g.maxX = g.x;
    expect(scoreFrame(g, { coins: 2, finished: true }, rules)).toBeCloseTo(4 + 10 - 0.5 / 60, 6);
    expect(scoreFrame(g, { coins: 0, died: true }, rules)).toBeCloseTo(-5 - 0.5 / 60, 6);
  });
});

describe('a try', () => {
  it('ends as finished, died or timeout and records one step per decision', () => {
    const rng = mulberry32(2), L = createLearner(RUNNER_SIZES, rng);
    const t = playTry(L, PRESETS.balanced.rules, rng);
    expect(['finished', 'died', 'timeout']).toContain(t.outcome);
    expect(t.steps.length).toBeGreaterThan(0);
    expect(t.steps[0].input.length).toBe(12);
  });

  it('the trainer learns from batches and keeps a history of outcomes', () => {
    const tr = createTrainer(PRESETS.balanced.rules, 4);
    for (let i = 0; i < 30; i++) tr.runTry();
    expect(tr.tries).toBe(30);
    expect(tr.history.length).toBe(30);
    expect(tr.updates).toBe(2);
  });
});
