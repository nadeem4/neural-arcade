import { describe, it, expect } from 'vitest';
import { GAMES } from '../assets/games.js';
import { LESSON, INFO, logLine, actionArrow, outcomeNote, gammaHint, slipHint } from '../games/treasure-room/words.js';

const KEYS = ['room', 'reward', 'log', 'gamma', 'route', 'arrows', 'sweep', 'values', 'ice', 'tags', 'restart', 'ai'];

describe('treasure room words', () => {
  it('writes a step as state, action and reward', () => {
    expect(logLine({ pos: { x: 3, y: 2 }, action: 3, reward: -1 })).toBe('state (3,2) · action → · reward −1');
    expect(logLine({ pos: { x: 0, y: 0 }, action: 0, reward: 10 })).toContain('reward +10');
    expect(logLine({ pos: { x: 0, y: 0 }, action: 1, reward: -10 })).toContain('reward −10');
    expect([0, 1, 2, 3].map(actionArrow).join('')).toBe('↑↓←→');
  });
  it('says how an episode ended', () => {
    expect(outcomeNote('treasure', 6)).toBe('Found the treasure. Score 6.');
    expect(outcomeNote('pit', -13)).toBe('Fell in the pit. Score -13.');
    expect(outcomeNote('timeout', 0)).toBe('Ran out of steps.');
  });
  it('hints change with the discount and the ice', () => {
    expect(new Set([0.2, 0.6, 0.9, 0.99].map(gammaHint)).size).toBe(4);
    expect(slipHint(0)).toMatch(/dry/i);
    expect(slipHint(0.1)).toContain('80%');
  });
  it('every (i) text is one short sentence', () => {
    for (const k of KEYS) {
      const t = INFO[k];
      expect(t, k).toBeTruthy();
      expect(t.length, k).toBeLessThan(160);
      expect(t.match(/[.!?](\s|$)/g)?.length, k).toBe(1);
    }
  });
  it('the page lesson matches the games config', () => {
    expect(LESSON).toBe('Seven small ideas, one room: the AI only ever knows what the room tells it.');
    const g = GAMES.find(x => x.id === 'treasure-room');
    expect(g.lesson).toContain('the AI only ever knows what the room tells it');
  });
});
