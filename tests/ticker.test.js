import { describe, it, expect } from 'vitest';
import { makeTicker } from '../engine/ticker.js';

const run = (fps, seconds) => {
  const tick = makeTicker();
  let steps = 0;
  for (let t = 0; t <= seconds * 1000; t += 1000 / fps) steps += tick(t);
  return steps;
};

describe('fixed 60 Hz simulation clock', () => {
  it('gives about 60 steps a second whatever the screen refresh rate', () => {
    for (const fps of [30, 60, 120, 200]) expect(Math.abs(run(fps, 2) - 120)).toBeLessThanOrEqual(2);
  });

  it('caps the catch-up after a long pause, so a hidden tab does not fast-forward', () => {
    const tick = makeTicker();
    tick(0);
    expect(tick(5000)).toBeLessThanOrEqual(4);
  });
});
