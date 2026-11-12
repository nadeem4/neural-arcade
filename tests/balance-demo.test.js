import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { newRun, tickRun, forceView } from '../games/balance/demo.js';
import { LIMIT } from '../games/balance/sim.js';

const story = JSON.parse(readFileSync(new URL('../games/balance/story.json', import.meta.url), 'utf8'));

describe('Balance home demo', () => {
  it('keeps the pole up for a full 20 s through the shoves, and the shoves really land', () => {
    const run = newRun(story.ai.late.genome);
    let shoves = 0, maxForce = 0;
    for (let i = 0; i < LIMIT && !run.outcome; i++) {
      const r = tickRun(run);
      if (r.shoved) shoves++;
      maxForce = Math.max(maxForce, Math.abs(r.force));
    }
    expect(run.outcome).toBe('limit');
    expect(shoves).toBeGreaterThanOrEqual(3);
    expect(maxForce).toBeGreaterThan(0.1);
  });
  it('forceView names the push direction and strength', () => {
    expect(forceView(0.5)).toEqual({ label: 'Right', pct: 50 });
    expect(forceView(-0.25)).toEqual({ label: 'Left', pct: 25 });
    expect(forceView(0.01)).toEqual({ label: 'None', pct: 0 });
  });
});
