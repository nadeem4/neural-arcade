import { describe, it, expect } from 'vitest';
import { endCardModel } from '../games/city/endcard.js';
import { buildReceipt, nextStepOf } from '../games/city/receipt.js';
import { GOAL_SECONDS } from '../games/city/presets.js';

const rw = { fare: 100, time: 1, off: 0, red: 0, wrong: 0, perTile: 0 };
const legal = { arrived: true, seconds: 63, tiles: 40, offTiles: 0, parkTiles: 0, redRuns: 0, wrongWays: 0, reward: 37 };
const cheat = { ...legal, seconds: 50, offTiles: 4, parkTiles: 4, reward: 46 };

describe('endCardModel', () => {
  it('a legal trip under the goal is on time', () => {
    const m = endCardModel(rw, legal, GOAL_SECONDS);
    expect(m.timeLine).toBe(`63 s of ${GOAL_SECONDS} s goal`);
    expect(m.timeOk).toBe(true);
    expect(m.legal).toBe(true);
  });
  it('a loophole trip is not ok however fast, and uses the verdict text verbatim', () => {
    const m = endCardModel(rw, cheat, GOAL_SECONDS);
    expect(m.timeOk).toBe(false);
    expect(m.legal).toBe(false);
    expect(m.verdict).toBe(nextStepOf(rw, cheat));
  });
  it('a slow legal trip is not ok', () => {
    expect(endCardModel(rw, { ...legal, seconds: GOAL_SECONDS + 5 }, GOAL_SECONDS).timeOk).toBe(false);
  });
  it('lines and earned come from the receipt', () => {
    const m = endCardModel(rw, cheat, GOAL_SECONDS);
    const r = buildReceipt(rw, cheat);
    expect(m.lines).toEqual(r.lines);
    expect(m.earned).toBe(r.total);
  });
  it('offers the three buttons in order', () => {
    const a = endCardModel(rw, legal, GOAL_SECONDS).actions;
    expect(a.map(x => x.id)).toEqual(['edit', 'keep', 'again']);
    expect(a.map(x => x.label)).toEqual(['Change the rates', 'Keep in the garage', 'Watch again']);
  });
});
