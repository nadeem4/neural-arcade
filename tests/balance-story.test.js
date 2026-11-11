import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { recordStory } from '../games/balance/story-data.js';
import { aiAct, SIZES } from '../games/balance/ai.js';
import { newGame, step, LIMIT } from '../games/balance/sim.js';
import { createActs } from '../engine/tinynet.js';

const saved = JSON.parse(readFileSync(new URL('../games/balance/story.json', import.meta.url), 'utf8'));
const S = recordStory();

// Seconds a genome survives with no pushes, from the standard small tilt.
function survives(genome) {
  const g = newGame(), acts = createActs(SIZES), input = new Float32Array(4);
  while (g.t < LIMIT) if (step(g, aiAct(genome, g, acts, input))) break;
  return g.t / 60;
}

const signChanges = a => a.reduce((n, v, i) => n + (i > 0 && Math.sign(v) !== Math.sign(a[i - 1]) ? 1 : 0), 0);

describe('the recorded run behind the write-up', () => {
  it('story.json matches a fresh recording (re-run node games/balance/story-data.js if the game changed)', () => {
    expect(saved).toEqual(S);
  }, 60000);

  it('P alone wobbles then falls', () => {
    expect(S.pid.pOnly.fell).toBe('tilt');
    expect(signChanges(S.pid.pOnly.th)).toBeGreaterThanOrEqual(6);
  });
  it('P plus D settles', () => {
    expect(S.pid.pd.fell).toBe(null);
    expect(S.pid.pd.th.slice(-100).every(v => Math.abs(v) < 0.01)).toBe(true);
  });
  it('Wind with I at zero leaves a steady error, and I removes it', () => {
    expect(Math.abs(S.pid.windNoI.x.at(-1))).toBeGreaterThan(0.5);
    expect(Math.abs(S.pid.windI.x.at(-1))).toBeLessThan(0.15);
  });
  it('the AI starts by falling and learns to balance', () => {
    expect(S.ai.history[0]).toBeLessThan(3);
    expect(S.ai.firstFull).toBeGreaterThanOrEqual(10);
    expect(S.ai.firstFull).toBeLessThanOrEqual(30);
    expect(S.ai.late.seconds).toBe(LIMIT / 60);
    expect(S.ai.early.seconds).toBeLessThan(3);
  });
  it('the fresh brain falls', () => {
    expect(survives(S.ai.fresh)).toBeLessThan(3);
  });
});
