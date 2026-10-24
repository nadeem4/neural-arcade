import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { recordStory, historyOf, settledAt } from '../games/runner/story-data.js';

const saved = JSON.parse(readFileSync(new URL('../games/runner/story.json', import.meta.url), 'utf8'));
const S = recordStory();

describe('the recorded runs behind the write-up', () => {
  it('story.json matches a fresh recording (re-run node games/runner/story-data.js if the game changed)', () => {
    expect(saved).toEqual(S);
  }, 60000);

  const last = key => historyOf(S.runs[key]).slice(-100);
  const share = (h, f) => h.filter(f).length / h.length;

  it('Balanced learns to finish, and the write-up can say when', () => {
    expect(share(last('balanced'), t => t.outcome === 'finished')).toBeGreaterThan(0.8);
    expect(settledAt(historyOf(S.runs.balanced), t => t.outcome === 'finished')).toBeGreaterThan(100);
  });
  it('Coin hungry farms the block', () => {
    expect(share(last('coinHungry'), t => t.outcome === 'timeout' && t.coins >= 8)).toBeGreaterThan(0.8);
  });
  it('Afraid of dying stays put until time runs out', () => {
    expect(share(last('afraid'), t => t.outcome === 'timeout')).toBeGreaterThan(0.8);
  });
  it('a fresh brain is unsure at the start; a trained one is not', () => {
    expect(Math.max(...S.runs.balanced.before)).toBeLessThan(0.7);
    expect(Math.max(...S.runs.balanced.after)).toBeGreaterThan(0.8);
  });
});
