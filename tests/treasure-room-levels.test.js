import { describe, it, expect } from 'vitest';
import { CONCEPTS } from '../assets/games.js';
import { LEVELS, levelFromUrl, levelByN } from '../games/treasure-room/levels.js';

const LESSONS = [
  'The AI only knows what the room tells it.',
  'The game is a list of these: state, action, reward.',
  'Shorter paths win, and a low discount makes the AI greedy for now.',
  'A policy is: on this tile, do this.',
  'Value is how good it is to stand here.',
  'The best plan changes once moves are uncertain.',
];

describe('treasure room levels', () => {
  it('has six levels in order, mapped to concept pages', () => {
    expect(LEVELS.map(l => l.n)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(LEVELS.map(l => l.concept)).toEqual(['agent', 'state-action-reward', 'return', 'policy', 'value', 'mdp']);
    for (const l of LEVELS) expect(CONCEPTS.some(c => c.id === l.concept), l.concept).toBe(true);
  });
  it('slugs are unique and every level is filled in', () => {
    expect(LEVELS.map(l => l.slug)).toEqual(['agent', 'triples', 'return', 'policy', 'value', 'mdp']);
    LEVELS.forEach((l, i) => {
      for (const k of ['title', 'brief', 'info']) expect(l[k].length, `${l.n}.${k}`).toBeGreaterThan(0);
      expect(l.lesson).toBe(LESSONS[i]);
      expect(levelByN(l.n)).toBe(l);
    });
  });
});

describe('levelFromUrl', () => {
  it('reads a number or a slug from the query or the hash', () => {
    expect(levelFromUrl('?level=3', '')).toBe(3);
    expect(levelFromUrl('?level=value', '')).toBe(5);
    expect(levelFromUrl('', '#policy')).toBe(4);
    expect(levelFromUrl('', '#state-action-reward')).toBe(2);
    expect(levelFromUrl('?level=triples', '')).toBe(2);
  });
  it('the query beats the hash', () => {
    expect(levelFromUrl('?level=2', '#mdp')).toBe(2);
  });
  it('anything invalid lands on level 1', () => {
    for (const [s, h] of [['?level=0', ''], ['?level=7', ''], ['?level=abc', ''], ['', '#nonsense'], ['', ''], ['?level=', ''], ['?level=2.5', '']]) {
      expect(levelFromUrl(s, h), `${s}${h}`).toBe(1);
    }
  });
  it('an invalid query falls back to a valid hash', () => {
    expect(levelFromUrl('?level=abc', '#mdp')).toBe(6);
  });
});
