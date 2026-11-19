import { describe, it, expect } from 'vitest';
import { buildReceipt, verdictOf, nextStepOf, hintOf, signed } from '../games/city/receipt.js';
import { LESSON, INFO, isLegal, goalReached, shareLine, goalLine, SHARE_ADDRESS } from '../games/city/words.js';
import { ARRIVE_POINTS, ON_TIME_POINTS, CLEAN_POINTS } from '../games/city/goal.js';
import { readFileSync } from 'node:fs';
import { loadWorld, analyzeRoute } from '../games/city/sim.js';
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
    expect(labels).not.toContain('Red light');
    expect(labels).not.toContain('Wrong way');
    expect(labels).not.toContain('Per tile');
  });

  it('keeps a zero-rate line when the count is not zero', () => {
    const l = buildReceipt({ ...R, off: 0 }, A({ offTiles: 5 })).lines.find((x) => x.label === 'Footpath');
    expect(l.amount).toBe(0);
    expect(l.free).toBe(true);
    expect(buildReceipt(R, A({ offTiles: 5 })).lines.find((x) => x.label === 'Footpath').free).toBe(false);
  });
});

describe('verdictOf', () => {
  it('names park, then red, then wrong way, then loop, then legal', () => {
    expect(verdictOf(R, A({ offTiles: 3, parkTiles: 3, redRuns: 1, wrongWays: 1 }))).toMatch(/park/i);
    expect(verdictOf(R, A({ redRuns: 1, wrongWays: 1 }))).toMatch(/red/i);
    expect(verdictOf(R, A({ wrongWays: 1 }))).toMatch(/wrong way/i);
    expect(verdictOf({ ...R, perTile: 3 }, A({ arrived: false, tiles: 400, seconds: 400 }))).toMatch(/earns more by driving/);
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

describe('the share line', () => {
  it('names the game and carries the page canonical address', () => {
    const canonical = readFileSync(new URL('../games/city/index.html', import.meta.url), 'utf8').match(/rel="canonical" href="https:\/\/([^"]+)"/)[1];
    expect(SHARE_ADDRESS).toBe(canonical);
    expect(shareLine(5, A({ seconds: 77 }))).toBe('I fixed the taxi in Reward City: a legal trip in 77 s, after 5 tries. arcade.codewithnk.com/games/city/');
  });
});

describe('goalLine', () => {
  it('states the goal plainly before training', () => {
    expect(goalLine()).toBe('Get the passenger from pickup to drop-off, on time, by the rules.');
  });
});

describe('words', () => {
  it('has the lesson and the three info texts', () => {
    expect(LESSON).toBe('The taxi does what you paid for, not what you meant.');
    for (const k of ['reward', 'ladder', 'goal', 'map', 'meters']) expect(INFO[k].length).toBeGreaterThan(10);
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
    expect(shareLine(1, A({ seconds: 74 }))).toBe('I fixed the taxi in Reward City: a legal trip in 74 s, after 1 try. arcade.codewithnk.com/games/city/');
    expect(shareLine(3, A({ seconds: 74 }))).toBe('I fixed the taxi in Reward City: a legal trip in 74 s, after 3 tries. arcade.codewithnk.com/games/city/');
  });
});

describe('player copy matches the reward', () => {
  it('uses singular for one tile, one time', () => {
    const l = buildReceipt(R, A({ offTiles: 1, wrongWays: 1, redRuns: 1 })).lines;
    expect(l.find((x) => x.label === 'Footpath').detail).toBe('1 tile');
    expect(l.find((x) => x.label === 'Wrong way').detail).toBe('1 tile');
    expect(l.find((x) => x.label === 'Red light').detail).toBe('1 time');
    expect(buildReceipt(R, A({ offTiles: 2, wrongWays: 2 })).lines.find((x) => x.label === 'Wrong way').detail).toBe('2 tiles');
  });

  it('park line needs park tiles; footpath-only has its own line', () => {
    expect(verdictOf(R, A({ offTiles: 2, parkTiles: 0 }))).toMatch(/footpaths/);
    expect(verdictOf(R, A({ offTiles: 2, parkTiles: 0 }))).not.toMatch(/park/);
    expect(verdictOf(R, A({ offTiles: 2, parkTiles: 2 }))).toMatch(/park/);
  });

  it('off-road line depends on the fine', () => {
    expect(verdictOf({ ...R, off: 0 }, A({ offTiles: 2, parkTiles: 2 }))).toMatch(/nobody fined that/);
    const v = verdictOf({ ...R, off: 5 }, A({ offTiles: 2, parkTiles: 2 }));
    expect(v).not.toMatch(/nobody fined/);
    expect(v).toMatch(/costs less than the time it saves/);
    expect(verdictOf({ ...R, off: 5 }, A({ offTiles: 2, parkTiles: 0 }))).toMatch(/costs less than the time it saves/);
  });

  it('loop and fines claims only when true', () => {
    const idle = A({ arrived: false, seconds: 400, tiles: 400 });
    expect(verdictOf({ ...R, perTile: 0 }, idle)).not.toMatch(/earns more by driving/);
    expect(verdictOf({ ...R, perTile: 0 }, idle)).toMatch(/never arrived/i);
    const still = A({ arrived: false, seconds: 400, tiles: 10, offTiles: 0 });
    expect(verdictOf(R, still)).not.toMatch(/outweigh/);
    const fined = A({ arrived: false, seconds: 40, tiles: 5, offTiles: 10 });
    expect(verdictOf({ ...R, fare: 100, off: 20 }, fined)).toMatch(/outweigh/);
  });

  it('receipt from analyzeRoute adds up', () => {
    const w = loadWorld({ cols: 4, rows: 1, kind: ['rpfr'], oneway: ['.W..'], signals: [], pickup: [0, 0], dropoff: [3, 0] });
    const rw = { ...R, perTile: 1.5 };
    const an = analyzeRoute(w, { cells: [0], actions: [1, 1, 1] }, rw);
    expect(an.arrived).toBe(true);
    const r = buildReceipt(rw, an);
    expect(sum(r)).toBeCloseTo(r.total, 5);
  });
});

describe('nextStepOf: names the cheat and the slider to try next', () => {
  const free = { ...R, off: 0, red: 0, wrong: 0 };
  it('park, red light and wrong way', () => {
    expect(nextStepOf(free, A({ offTiles: 3, parkTiles: 3 }))).toBe('It cut across the park. Nothing fines that. Raise “Fine per footpath tile” on the rate card.');
    expect(nextStepOf(free, A({ redRuns: 1 }))).toBe('It ran red lights. Nothing fines that. Raise “Fine per red light” on the rate card.');
    expect(nextStepOf(free, A({ wrongWays: 1 }))).toBe('It went the wrong way down a one-way street. Nothing fines that. Raise “Fine per wrong-way tile” on the rate card.');
  });
  it('footpaths point at the same fine as the park', () => {
    expect(nextStepOf(free, A({ offTiles: 2, parkTiles: 0 }))).toBe('It drove along the footpaths. Nothing fines that. Raise “Fine per footpath tile” on the rate card.');
  });
  it('a fine that exists but is too small says to raise it', () => {
    expect(nextStepOf({ ...free, off: 5 }, A({ offTiles: 3, parkTiles: 3 }))).toBe('It cut across the park. The fine is too small. Raise “Fine per footpath tile” on the rate card.');
    expect(nextStepOf({ ...free, red: 5 }, A({ redRuns: 1 }))).toMatch(/Raise “Fine per red light” on the rate card.$/);
    expect(nextStepOf({ ...free, wrong: 5 }, A({ wrongWays: 1 }))).toMatch(/Raise “Fine per wrong-way tile” on the rate card.$/);
  });
  it('per-tile loops say it drove extra for per-tile pay and to lower it', () => {
    const v = nextStepOf({ ...free, perTile: 3 }, A({ arrived: false, seconds: 400, tiles: 400 }));
    expect(v).toBe('It drove extra to earn pay per tile and never dropped the passenger off. Lower “Pay per tile driven” on the rate card.');
  });
  it('fines that outweigh the fare say so and what to change', () => {
    const v = nextStepOf({ ...free, fare: 100, off: 20 }, A({ arrived: false, seconds: 40, tiles: 5, offTiles: 10 }));
    expect(v).toBe('It never arrived. The fines outweigh the fare. Lower a fine or raise “Fare for arriving” on the rate card.');
  });
  it('never arrived without a loop says what to change', () => {
    expect(nextStepOf({ ...free, fare: 0 }, A({ arrived: false, tiles: 5 }))).toMatch(/Raise “Fare for arriving” on the rate card.$/);
    expect(nextStepOf(free, A({ arrived: false, tiles: 5 }))).toMatch(/^It never arrived\./);
  });
  it('a clean fast legal trip is the success line, a clean slow one asks for speed', () => {
    expect(nextStepOf(free, A({ seconds: GOAL_SECONDS - 1 }))).toBe('Clean, fast and legal. That is a fixed taxi.');
    expect(nextStepOf(free, A({ seconds: GOAL_SECONDS + 10 }))).toBe('Legal, but not fast enough. Raise “Cost per second” on the rate card.');
  });
  it('never says pay slip', () => {
    for (const a of [A({ parkTiles: 1, offTiles: 1 }), A({ redRuns: 1 }), A({ arrived: false, tiles: 400 }), A({})]) {
      expect(nextStepOf({ ...free, perTile: 3 }, a)).not.toMatch(/pay slip/i);
    }
  });
});

describe('player wording is accurate', () => {
  const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
  const BANNED = /\bwants?\b|knows the rules|tries to cheat|\u2014/i;
  it('says the taxi maximises the pay, never that it wants, knows the rules or tries to cheat', () => {
    for (const text of [LESSON, ...Object.values(INFO), goalLine(), read('games/city/index.html'), read('games/city/how-it-works/index.html'), read('games/city/how-it-works/story.js')]) {
      expect(text).not.toMatch(BANNED);
    }
    expect(INFO.reward).toMatch(/only maximises the pay/);
  });
  it('takes the meter numbers from goal.js, not from typing', () => {
    expect(INFO.meters).toContain(`${ARRIVE_POINTS} for arriving`);
    expect(INFO.meters).toContain(`${ON_TIME_POINTS} for a legal, on-time trip`);
    expect(INFO.meters).toContain(`${CLEAN_POINTS} for no cheats`);
    expect(INFO.goal).toContain(`${GOAL_SECONDS} seconds`);
    expect(INFO.meters.split(" ").length).toBeLessThan(65);
    expect(INFO.meters).toContain('out of 100');
    expect(INFO.meters).toContain('It only falls during the drive.');
  });
  it('says the one line the same everywhere it appears', () => {
    expect(read('games/city/index.html')).toContain('<p>The taxi does what you paid for, not what you meant.</p>');
    expect(read('games/city/how-it-works/index.html')).toContain('The taxi does what you paid for, not what you meant.</p>');
  });
  it('has no receipt or hint wording that gives the taxi wants or reasons', () => {
    const v = verdictOf({ ...R, fare: 0 }, A({ arrived: false, seconds: 0, tiles: 0, reward: 0 }));
    expect(v).not.toMatch(/reason to/);
    expect(verdictOf(R, A({ arrived: false, seconds: 40, tiles: 5, offTiles: 10 }))).toMatch(/not driving pays best/);
  });
});

describe('signed', () => {
  it('uses a real minus and a plus, and nothing for zero', () => {
    expect([signed(5), signed(-5), signed(0), signed(-2.5)]).toEqual(['+5', '−5', '0', '−2.5']);
  });
});

describe('hintOf: all the loopholes, not only the first', () => {
  const free = { ...R, off: 0, red: 0, wrong: 0 };
  it('one cheat keeps the single-cheat advice', () => {
    expect(hintOf(free, A({ redRuns: 1 }))).toBe(nextStepOf(free, A({ redRuns: 1 })));
    expect(hintOf(free, A({}))).toBe(nextStepOf(free, A({})));
    expect(hintOf(free, A({ arrived: false, tiles: 5 }))).toBe(nextStepOf(free, A({ arrived: false, tiles: 5 })));
  });
  it('several cheats are all named', () => {
    expect(hintOf(free, A({ offTiles: 3, parkTiles: 3, redRuns: 1 }))).toBe('It used 2 loopholes. Add or raise the footpath and red light fines.');
    expect(hintOf(free, A({ offTiles: 3, parkTiles: 3, redRuns: 1, wrongWays: 2 }))).toBe('It used 3 loopholes. Add or raise the footpath, red light and wrong way fines.');
  });
});
