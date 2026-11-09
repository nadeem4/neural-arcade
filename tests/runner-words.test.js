import { describe, it, expect } from 'vitest';
import { tryNote, endWords, bestOf, compareNote, whyNote, rulesItems, rulesNote, pausedNote, ruleValue, matchPreset, loopholeNote } from '../games/runner/words.js';
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

describe('comparing your try with the AI', () => {
  it('endWords names how a try ended', () => {
    expect(endWords({ outcome: 'finished' })).toBe('reached the flag');
    expect(endWords({ outcome: 'died' })).toBe('died');
    expect(endWords({ outcome: 'timeout', coins: 12, maxX: 3 })).toBe('farmed the coin block until time ran out (12 coins)');
    expect(endWords({ outcome: 'timeout', coins: 0, maxX: 1 })).toBe('stayed put until time ran out');
    expect(endWords({ outcome: 'timeout', coins: 0, maxX: 10 })).toBe('ran out of time');
  });
  it('bestOf picks the highest score, or null', () => {
    expect(bestOf([])).toBe(null);
    expect(bestOf([{ score: 1 }, { score: 9 }, { score: 4 }])).toEqual({ score: 9 });
  });
  it('compareNote sets your try beside the AI best', () => {
    const mine = run('finished', { score: 4 });
    const best = { outcome: 'timeout', coins: 30, maxX: 2, score: 9 };
    expect(compareNote(mine, best)).toBe("Your run: reached the flag, score 4.0. The AI's best: farmed the coin block until time ran out (30 coins), 9.0.");
    expect(compareNote(run('died', { score: -3 }), null)).toBe('Your run: died, score -3.0. The AI has not finished a try yet.');
  });
});

describe('why the two runs differ', () => {
  it('says what to look at, or nothing without an AI best', () => {
    const best = { outcome: 'finished', coins: 0, maxX: 45, score: 9 };
    expect(whyNote(run('died', { score: 1 }), best)).toMatch(/rules pay more for what the AI did/);
    expect(whyNote(run('finished', { score: 20 }), best)).toMatch(/You beat it/);
    expect(whyNote(run('died'), null)).toBe('');
  });
});

describe('what the player is told about the rules and the paused AI', () => {
  it('lists the current rules with signs and skips zeros', () => {
    expect(rulesNote(PRESETS.balanced.rules)).toBe('Flag +30 \u00b7 Coin +0.5 \u00b7 Each tile forward +1 \u00b7 Dying \u22125 \u00b7 Each second \u22120.5');
    expect(rulesNote(PRESETS.afraid.rules)).toBe('Dying \u221250 \u00b7 Each second +1');
  });
  it('gives the rules as separate items so the page can wrap between them', () => {
    expect(rulesItems(PRESETS.afraid.rules)).toEqual(['Dying \u221250', 'Each second +1']);
  });
  it('says the AI is paused and how many tries it has had', () => {
    expect(pausedNote(42)).toBe('The AI is paused while you play. It has had 42 tries so far.');
    expect(pausedNote(1)).toBe('The AI is paused while you play. It has had 1 try so far.');
  });
});
