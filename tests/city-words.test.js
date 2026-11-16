import { describe, it, expect } from 'vitest';
import { buildReceipt, verdictOf } from '../games/city/receipt.js';
import { LESSON, INFO, isLegal, goalReached, shareLine } from '../games/city/words.js';
import { GOAL_SECONDS, DEFAULT_REWARDS } from '../games/city/presets.js';

const R = { ...DEFAULT_REWARDS, off: 20, red: 30, wrong: 30, perTile: 0 };
const A = (o) => ({ arrived: true, seconds: 50, tiles: 50, offTiles: 0, parkTiles: 0, redRuns: 0, wrongWays: 0, reward: 50, ...o });
const sum = (r) => r.lines.reduce((s, l) => s + l.amount, 0);

describe('buildReceipt', () => {
  const cases = [
    [R, A({})],
    [R, A({ offTiles: 4, parkTiles: 4, reward: -30 })],
    [R, A({ redRuns: 2, reward: -10 })],
    [{ ...R, perTile: 3 }, A({ wrongWays: 1, reward: 170 })],
    [{ ...R, fare: 0, time: 0.5 }, A({ arrived: false, seconds: 400, tiles: 400, reward: -200 })],
  ];
  it('lines add up to the total', () => {
    for (const [rw, an] of cases) {
      const r = buildReceipt(rw, an);
      expect(sum(r)).toBeCloseTo(r.total, 5);
      expect(r.total).toBe(Math.round(an.reward * 10) / 10);
    }
  });

  it('shows the fare only when it arrived', () => {
    expect(buildReceipt(R, A({})).lines[0]).toMatchObject({ label: 'Fare', amount: 100 });
    expect(buildReceipt(R, A({ arrived: false })).lines.some((l) => l.label === 'Fare')).toBe(false);
  });

  it('omits a zero-rate line with a zero count', () => {
    const labels = buildReceipt({ ...R, red: 0, wrong: 0 }, A({})).lines.map((l) => l.label);
    expect(labels).not.toContain('Red lights');
    expect(labels).not.toContain('Wrong way');
    expect(labels).not.toContain('Per tile');
  });

  it('keeps a zero-rate line when the count is not zero', () => {
    const l = buildReceipt({ ...R, off: 0 }, A({ offTiles: 5 })).lines.find((x) => x.label === 'Park and footpath');
    expect(l.amount).toBe(0);
  });
});

describe('verdictOf', () => {
  it('names park, then red, then wrong way, then loop, then legal', () => {
    expect(verdictOf(R, A({ offTiles: 3, redRuns: 1, wrongWays: 1 }))).toMatch(/park/i);
    expect(verdictOf(R, A({ redRuns: 1, wrongWays: 1 }))).toMatch(/red/i);
    expect(verdictOf(R, A({ wrongWays: 1 }))).toMatch(/wrong way/i);
    expect(verdictOf(R, A({ arrived: false, tiles: 400, seconds: 400 }))).toMatch(/earns more by driving/);
    expect(verdictOf(R, A({}))).toBe('Legal trip: no fines.');
  });

  it('a never-arriving fare-0 slip gives a sensible verdict and no NaN', () => {
    const rw = { ...R, fare: 0 };
    const an = A({ arrived: false, seconds: 0, tiles: 0, reward: 0 });
    const v = verdictOf(rw, an);
    expect(v).not.toMatch(/NaN|undefined/);
    expect(v).toMatch(/never/i);
    const r = buildReceipt(rw, an);
    expect(Number.isNaN(r.total)).toBe(false);
    expect(r.lines.every((l) => !Number.isNaN(l.amount))).toBe(true);
  });

  it('a capped looping route says it earns more by driving', () => {
    const v = verdictOf({ ...R, perTile: 3 }, A({ arrived: false, seconds: 400, tiles: 400, reward: 800 }));
    expect(v).toBe('It earns more by driving than by delivering, so it never drops the passenger off.');
  });

  it('a route that stays put gets a never-arrived line', () => {
    expect(verdictOf(R, A({ arrived: false, seconds: 400, tiles: 10 }))).toMatch(/never/i);
  });
});

describe('words', () => {
  it('has the lesson and the four info texts', () => {
    expect(LESSON).toBe('The reward is the only thing the taxi wants: it does what you pay it for, not what you meant.');
    for (const k of ['slip', 'cards', 'goal', 'map']) expect(INFO[k].length).toBeGreaterThan(10);
  });

  it('isLegal needs arrival and no fines', () => {
    expect(isLegal(A({}))).toBe(true);
    expect(isLegal(A({ arrived: false }))).toBe(false);
    expect(isLegal(A({ offTiles: 1 }))).toBe(false);
    expect(isLegal(A({ redRuns: 1 }))).toBe(false);
    expect(isLegal(A({ wrongWays: 1 }))).toBe(false);
  });

  it('goalReached is false when over GOAL_SECONDS or when any fine', () => {
    expect(goalReached(A({ seconds: GOAL_SECONDS - 1 }))).toBe(true);
    expect(goalReached(A({ seconds: GOAL_SECONDS }))).toBe(false);
    expect(goalReached(A({ seconds: 40, redRuns: 1 }))).toBe(false);
  });

  it('shareLine uses 1 try and N tries', () => {
    expect(shareLine(1, A({ seconds: 74 }))).toBe('I fixed the taxi in 1 try: 74 s, no fines.');
    expect(shareLine(3, A({ seconds: 74 }))).toBe('I fixed the taxi in 3 tries: 74 s, no fines.');
  });
});
