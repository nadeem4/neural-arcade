// The game's promise, checked on 20 random brains per rule set: Balanced learns to finish, and each broken rule set
// learns its loophole. Slow (about a minute), because it really trains 60 brains.
import { describe, it, expect } from 'vitest';
import { PRESETS, createTrainer, TRY_BUDGET } from '../games/runner/sim.js';

const SEEDS = 20;
function trainAll(rules) {
  return Array.from({ length: SEEDS }, (_, i) => {
    const tr = createTrainer(rules, 1000 + i * 7919);
    while (tr.tries < TRY_BUDGET) tr.runTry();
    return tr.history.slice(-100);
  });
}
const share = (last, test) => last.filter(test).length / last.length;

describe('the three rule sets, on 20 random brains each', () => {
  it('Balanced: at least 18 of 20 brains learn to finish the level', () => {
    const ok = trainAll(PRESETS.balanced.rules).filter(last => share(last, t => t.outcome === 'finished') >= 0.7);
    expect(ok.length).toBeGreaterThanOrEqual(18);
  }, 300000);

  it('Coin hungry: every brain learns to farm the coin block instead of finishing', () => {
    const shares = trainAll(PRESETS.coinHungry.rules).map(last => share(last, t => t.outcome === 'timeout' && t.coins >= 8));
    expect(Math.min(...shares)).toBeGreaterThanOrEqual(0.7);
  }, 300000);

  it('Afraid of dying: every brain learns to hold still until time runs out', () => {
    const shares = trainAll(PRESETS.afraid.rules).map(last => share(last, t => t.outcome === 'timeout'));
    expect(Math.min(...shares)).toBeGreaterThanOrEqual(0.7);
  }, 300000);
});
