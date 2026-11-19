import { describe, it, expect } from 'vitest';
import { nameFor, behaviourNames, uniqueName, stripeFor, noteFor, rateChips } from '../games/city/naming.js';
import { GOAL_SECONDS } from '../games/city/presets.js';

const T = (o = {}) => ({ arrived: true, seconds: 60, tiles: 40, offTiles: 0, parkTiles: 0, redRuns: 0, wrongWays: 0, ...o });

describe('nameFor', () => {
  it('names a taxi by what it did, first match wins', () => {
    expect(nameFor(T())).toBe('By the book');
    expect(nameFor(T({ offTiles: 3, parkTiles: 3 }))).toBe('Park cutter');
    expect(nameFor(T({ offTiles: 3 }))).toBe('Footpath rider');
    expect(nameFor(T({ redRuns: 1 }))).toBe('Red runner');
    expect(nameFor(T({ wrongWays: 1 }))).toBe('Wrong-way driver');
    expect(nameFor(T({ arrived: false, seconds: 100, tiles: 20 }))).toBe('Never arrives');
    expect(nameFor(T({ arrived: false, seconds: 100, tiles: 90 }))).toBe('Circler');
  });
  it('picks the first by order when a trip did several things', () => {
    expect(nameFor(T({ offTiles: 4, parkTiles: 1, redRuns: 2, wrongWays: 1 }))).toBe('Park cutter');
    expect(nameFor(T({ offTiles: 4, redRuns: 2 }))).toBe('Footpath rider');
    expect(nameFor(T({ redRuns: 2, wrongWays: 1 }))).toBe('Red runner');
  });
  it('a trip that never arrived is named for that, whatever else it did', () => {
    expect(nameFor(T({ arrived: false, offTiles: 3, parkTiles: 3, tiles: 10 }))).toBe('Never arrives');
  });
});

describe('behaviourNames', () => {
  const kept = (id, analysis, name = 'old') => ({ id, name, analysis });
  it('renames stored taxis from their analysis, numbering repeats from the oldest', () => {
    const taxis = [kept('c', T({ redRuns: 1 })), kept('b', T()), kept('a', T())]; // newest first
    expect(behaviourNames(taxis).map(t => t.name)).toEqual(['Red runner', 'By the book 2', 'By the book']);
  });
  it('keeps everything else on the taxi', () => {
    expect(behaviourNames([kept('a', T())])[0]).toMatchObject({ id: 'a' });
  });
});

describe('uniqueName', () => {
  it('numbers duplicates 2, 3', () => {
    expect(uniqueName('By the book', [])).toBe('By the book');
    expect(uniqueName('By the book', ['By the book'])).toBe('By the book 2');
    expect(uniqueName('By the book', ['By the book', 'By the book 2'])).toBe('By the book 3');
    expect(uniqueName('By the book', ['Red runner'])).toBe('By the book');
  });
});

describe('stripeFor', () => {
  it('gives each name a colour and ignores the number suffix', () => {
    expect(stripeFor('Red runner')).toMatch(/^#[0-9A-F]{6}$/i);
    expect(stripeFor('Red runner 2')).toBe(stripeFor('Red runner'));
    expect(stripeFor('Red runner')).not.toBe(stripeFor('By the book'));
    for (const n of ['Park cutter', 'Footpath rider', 'Red runner', 'Wrong-way driver', 'Never arrives', 'Circler', 'By the book']) {
      expect(stripeFor(n), n).not.toBe('#5BC0EB'); // none falls back to the default
    }
    expect(stripeFor('Mystery')).toMatch(/^#/);
  });
});

const A = (o = {}) => ({ arrived: true, seconds: 60, offTiles: 0, redRuns: 0, wrongWays: 0, ...o });

describe('noteFor', () => {
  it('says what the trip did in one line', () => {
    expect(noteFor(A())).toBe('Legal trip: goal met');
    expect(noteFor(A({ seconds: GOAL_SECONDS + 15 }))).toBe('Legal, but over the goal');
    expect(noteFor(A({ offTiles: 9, redRuns: 1 }))).toBe('9 park tiles, 1 red run');
    expect(noteFor(A({ wrongWays: 2 }))).toBe('2 wrong-way moves');
    expect(noteFor(A({ arrived: false }))).toBe('Never arrived');
  });
});

describe('rateChips', () => {
  it('lists only the rates that are not zero, with signs', () => {
    expect(rateChips({ fare: 100, time: 1, off: 0, red: 30, wrong: 0, perTile: 2 }))
      .toEqual(['Fare +100', 'Second −1', 'Red −30', 'Per tile +2']);
  });
});
