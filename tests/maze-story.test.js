import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { recordStory } from '../games/maze/story-data.js';

const saved = JSON.parse(readFileSync(new URL('../games/maze/story.json', import.meta.url), 'utf8'));
const S = recordStory();
const snaps = S.spread.snapshots;
const decimals = v => (String(v).split('.')[1] || '').length;

describe('the recorded run behind the maze write-up', () => {
  it('story.json matches a fresh recording (re-run node games/maze/story-data.js if the sim changed)', () => {
    expect(saved).toEqual(S);
  }, 60000);

  it('records five spread snapshots at the chosen episodes', () => {
    expect(snaps.map(s => s.episode)).toEqual([1, 5, 20, 100, 3000]);
    for (const s of snaps) expect(s.values.length).toBe(36);
  });

  it('value spreads outward from the reward and falls steadily up the left column', () => {
    const count = s => s.values.filter(v => v > 0.5).length;
    const counts = snaps.map(count);
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]);
    expect(counts.at(-1)).toBeGreaterThan(counts[0]);
    const v = snaps.at(-1).values;
    // tiles 6, 12, 18, 24, 30: beside the big treasure down to the start
    for (const s of [12, 18, 24, 30]) expect(v[s - 6]).toBeGreaterThan(v[s]);
  });

  it('a low discount takes the small treasure, a high one the big treasure', () => {
    expect(S.discount.low.gamma).toBe(0.5);
    expect(S.discount.high.gamma).toBe(0.95);
    expect(S.discount.low.outcome).toBe('small');
    expect(S.discount.high.outcome).toBe('big');
    expect(S.discount.high.path[0]).toBe(30);
    expect(S.discount.high.policy.length).toBe(36);
  });

  it('exploring more costs more pits near the cliff', () => {
    expect(S.cliff.episodes).toBe(500);
    expect(S.cliff.high.pits).toBeGreaterThan(3 * S.cliff.low.pits);
    expect(S.cliff.high.meanReward).toBeLessThan(S.cliff.low.meanReward);
  });

  it('is rounded to 4 places', () => {
    const nums = [...snaps.flatMap(s => s.values), S.cliff.low.meanReward, S.cliff.high.meanReward];
    for (const n of nums) expect(decimals(n)).toBeLessThanOrEqual(4);
  });
});
