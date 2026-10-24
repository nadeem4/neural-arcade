import { describe, it, expect } from 'vitest';
import { tryNote, ruleValue, matchPreset, loopholeNote } from '../games/runner/words.js';
import { PRESETS } from '../games/runner/sim.js';

const run = (outcome, extra = {}) => ({ outcome, coins: 0, score: 12.4, g: { maxX: 20 }, ...extra });

describe('how a try ended, in words', () => {
  it('names the flag, a death, farming and standing still', () => {
    expect(tryNote(run('finished'), 412)).toBe('Try 412: reached the flag. Score 12.4');
    expect(tryNote(run('died'), 3)).toBe('Try 3: died. Score 12.4');
    expect(tryNote(run('timeout', { coins: 48 }), 900)).toBe('Try 900: farmed the coin block until time ran out (48 coins). Score 12.4');
    expect(tryNote(run('timeout', { g: { maxX: 1.2 } }), 7)).toBe('Try 7: stayed put until time ran out. Score 12.4');
    expect(tryNote(run('timeout'), 8)).toBe('Try 8: ran out of time. Score 12.4');
  });
});

describe('slider values', () => {
  it('says what each second does: costs, earns or nothing', () => {
    expect(ruleValue('second', -0.5)).toBe('costs 0.5');
    expect(ruleValue('second', 1)).toBe('earns 1');
    expect(ruleValue('second', 0)).toBe('nothing');
  });
  it('shows points for the others', () => {
    expect(ruleValue('flag', 30)).toBe('30 points');
    expect(ruleValue('coin', 0.5)).toBe('0.5 points');
    expect(ruleValue('progress', 1)).toBe('1 point');
    expect(ruleValue('death', 0)).toBe('nothing');
  });
});

describe('presets', () => {
  it('recognises a preset from its rules, and anything else as your own rules', () => {
    expect(matchPreset({ ...PRESETS.afraid.rules })).toBe('afraid');
    expect(matchPreset({ ...PRESETS.balanced.rules, coin: 4 })).toBe(null);
  });
  it('names the loophole once most recent tries use it', () => {
    const farm = Array(50).fill({ outcome: 'timeout', coins: 40, maxX: 2 });
    const still = Array(50).fill({ outcome: 'timeout', coins: 0, maxX: 1.1 });
    const flag = Array(50).fill({ outcome: 'finished', coins: 3, maxX: 45 });
    expect(loopholeNote(farm)).toMatch(/farming the coin block/);
    expect(loopholeNote(still)).toMatch(/standing still/);
    expect(loopholeNote(flag)).toBe('');
    expect(loopholeNote(farm.slice(0, 10))).toBe('');
  });
});
