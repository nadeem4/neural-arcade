import { describe, it, expect } from 'vitest';
import { LESSON, describeTile, gammaHint, epsilonHint, episodeNote, learnedNote, INFO } from '../games/maze/words.js';
import { loadMap, createAgent, trainEpisodes } from '../games/maze/sim.js';

const map = loadMap('near-or-far');

describe('maze words', () => {
  it('states the lesson verbatim', () => {
    expect(LESSON).toBe('Value spreads backward from the reward, one step at a time.');
  });

  it('gammaHint has four rules and never goes empty', () => {
    const hints = [0.1, 0.5, 0.8, 0.95].map(gammaHint);
    expect(hints).toEqual([
      'Almost only the next step counts: the robot grabs whatever is closest.',
      'Near rewards count much more than far ones.',
      'Far rewards still count, a little less for each step.',
      'Far rewards count almost as much as near ones: worth the walk.',
    ]);
    expect(gammaHint(0)).not.toBe('');
    expect(gammaHint(1)).toBe(hints[3]);
  });

  it('epsilonHint has special ends and three bands', () => {
    expect(epsilonHint(0)).toBe('No exploring: it only repeats what it knows.');
    expect(epsilonHint(1)).toBe('Pure exploring: every move is random.');
    const mid = [0.05, 0.2, 0.7].map(epsilonHint);
    expect(new Set(mid).size).toBe(3);
    for (const h of mid) expect(h).toMatch(/\.$/);
  });

  it('episodeNote names the outcome and the reward to one decimal', () => {
    expect(episodeNote({ outcome: 'big', steps: 12, reward: 8.84 })).toBe('Found the big treasure. 12 steps, reward 8.8.');
    expect(episodeNote({ outcome: 'small', steps: 4, reward: 2.6 })).toContain('Took the small treasure.');
    expect(episodeNote({ outcome: 'pit', steps: 7, reward: -10.7 })).toContain('Fell in the pit.');
    expect(episodeNote({ outcome: 'pit', steps: 7, reward: -10.7 })).toContain('-10.7');
    expect(episodeNote({ outcome: 'cap', steps: 100, reward: -10 })).toContain('Ran out of steps.');
  });

  it('describeTile covers walls, treasure, start, pit and plain tiles', () => {
    expect(describeTile(map, 7, 0, null)).toMatch(/wall/i);
    expect(describeTile(map, 0, 0, null)).toMatch(/big treasure/i);
    expect(describeTile(map, 32, 0, null)).toMatch(/small treasure/i);
    expect(describeTile(loadMap('cliff-edge'), 31, 0, null)).toMatch(/pit/i);
    expect(describeTile(map, 30, 0.4, 0)).toBe('Row 6, column 1. Start. Value 0.4. Best move: up.');
    expect(describeTile(map, 31, 1.25, null)).toBe('Row 6, column 2. Value 1.3. No best move yet.');
  });

  it('learnedNote reports episodes and where the greedy walk ends', () => {
    const agent = createAgent('near-or-far', 1);
    expect(learnedNote(agent)).toMatch(/^0 episodes/);
    trainEpisodes(agent, 3000, { alpha: 0.5, gamma: 0.95, epsilon: 0.5 });
    expect(learnedNote(agent)).toBe('3000 episodes so far. Without exploring it now walks to the big treasure.');
  });

  it('INFO has the eight keys, each one sentence ending in a period', () => {
    expect(Object.keys(INFO).sort()).toEqual(['curve', 'discount', 'exploration', 'fourValues', 'map', 'reset', 'speed', 'values']);
    for (const v of Object.values(INFO)) { expect(typeof v).toBe('string'); expect(v.length).toBeGreaterThan(0); expect(v).toMatch(/\.$/); }
  });
});
