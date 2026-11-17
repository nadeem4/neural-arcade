import { describe, it, expect } from 'vitest';
import { nameFor, uniqueName, stripeFor, noteFor, rateChips } from '../games/city/naming.js';

const R = (o = {}) => ({ fare: 100, time: 1, off: 20, red: 30, wrong: 30, perTile: 0, ...o });

describe('nameFor', () => {
  it('names a taxi by which fines are zero, first match wins', () => {
    expect(nameFor(R({ off: 0, red: 0, wrong: 0 }))).toBe('Anything goes');
    expect(nameFor(R({ red: 0 }))).toBe('Red runner');
    expect(nameFor(R({ off: 0 }))).toBe('Park cutter');
    expect(nameFor(R({ wrong: 0 }))).toBe('Wrong-way driver');
    expect(nameFor(R())).toBe('By the book');
  });
  it('picks the first by order when two fines are zero', () => {
    expect(nameFor(R({ off: 0, red: 0 }))).toBe('Red runner');
    expect(nameFor(R({ off: 0, wrong: 0 }))).toBe('Park cutter');
  });
  it('names the default rate card Anything goes', () => {
    expect(nameFor({ fare: 100, time: 1, off: 0, red: 0, wrong: 0, perTile: 0 })).toBe('Anything goes');
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
    expect(stripeFor('Mystery')).toMatch(/^#/);
  });
});

const A = (o = {}) => ({ arrived: true, seconds: 60, offTiles: 0, redRuns: 0, wrongWays: 0, ...o });

describe('noteFor', () => {
  it('says what the trip did in one line', () => {
    expect(noteFor(A())).toBe('Legal trip: goal met');
    expect(noteFor(A({ seconds: 90 }))).toBe('Legal, but over the goal');
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
