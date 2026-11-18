import { describe, it, expect } from 'vitest';
import { endCardModel } from '../games/city/endcard.js';
import { buildReceipt, nextStepOf, hintOf, cheatsOf } from '../games/city/receipt.js';
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
  it('a loophole trip is not ok however fast, and uses the hint text verbatim', () => {
    const m = endCardModel(rw, cheat, GOAL_SECONDS);
    expect(m.timeOk).toBe(false);
    expect(m.legal).toBe(false);
    expect(m.verdict).toBe(hintOf(rw, cheat));
    expect(m.verdict).toBe(nextStepOf(rw, cheat)); // one cheat: the single-cheat advice
  });
  it('a trip with two cheats names both in its hint, beside the cheat list', () => {
    const two = { ...cheat, redRuns: 1 };
    const m = endCardModel(rw, two, GOAL_SECONDS, null);
    expect(m.verdict).toBe('It used 2 loopholes. Add or raise the park and footpath and red-light fines.');
    expect(m.cheats.map(c => c.kind)).toEqual(['park', 'red']);
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

const honest = { arrived: true, seconds: 64, tiles: 64, offTiles: 0, parkTiles: 0, redRuns: 0, wrongWays: 0, reward: 36 };

describe('cheatsOf', () => {
  const R = { fare: 100, time: 1, off: 20, red: 30, wrong: 30, perTile: 0 };
  it('is empty for a legal trip', () => {
    expect(cheatsOf(R, honest, honest)).toEqual([]);
  });
  it('explains a park shortcut with seconds saved, pay worth and the fine', () => {
    const a = { ...legal, seconds: 50, offTiles: 3, parkTiles: 3, reward: 46 };
    expect(cheatsOf(R, a, honest)).toEqual([
      { kind: 'park', reason: 'Cut through the park 3 tiles; the fine was 20 for 3 tiles (60).' },
      { kind: 'saved', reason: 'Together the cheats saved 14 s, worth 14 pay.' },
    ]);
  });
  it('says nothing fined it when the rate is zero', () => {
    const a = { ...legal, seconds: 50, offTiles: 3, parkTiles: 3 };
    expect(cheatsOf({ ...R, off: 0 }, a, honest)[0].reason).toBe('Cut through the park 3 tiles; nothing fined it.');
  });
  it('lists every cheat the trip used, not just one', () => {
    const a = { ...legal, seconds: 50, offTiles: 4, parkTiles: 3, redRuns: 2, wrongWays: 1 };
    expect(cheatsOf(R, a, honest).map(c => c.kind)).toEqual(['park', 'footpath', 'red', 'wrong', 'saved']);
  });
  it('counts footpath tiles apart from park tiles', () => {
    const a = { ...legal, seconds: 70, offTiles: 4, parkTiles: 1 };
    const [park, foot] = cheatsOf(R, a, honest);
    expect(park.reason).toContain('1 tile (20)');
    expect(foot.reason).toContain('3 tiles (60)');
    expect(foot.reason).not.toContain('saved');
    expect(foot.reason).toContain('Footpath');
  });
  it('red and wrong way use their own rates', () => {
    const red = cheatsOf(R, { ...legal, seconds: 55, redRuns: 2 }, honest)[0];
    expect(red.reason).toBe('Ran 2 red lights; the fine was 30 each (60).');
    const wrong = cheatsOf(R, { ...legal, seconds: 55, wrongWays: 1 }, honest)[0];
    expect(wrong.reason).toBe('Went the wrong way 1 time; the fine was 30 each (30).');
  });
  it('states the saving once when a park cheat and a wrong-way cheat appear together', () => {
    const a = { ...legal, seconds: 37, offTiles: 16, parkTiles: 16, wrongWays: 2 };
    const out = cheatsOf(R, a, honest);
    expect(out[0].reason).toBe('Cut through the park 16 tiles; the fine was 20 for 16 tiles (320).');
    expect(out[1].reason).toBe('Went the wrong way 2 times; the fine was 30 each (60).');
    expect(out.filter(c => /saved/.test(c.reason))).toEqual([{ kind: 'saved', reason: 'Together the cheats saved 27 s, worth 27 pay.' }]);
    expect(out.at(-1).kind).toBe('saved');
  });
  it('has no saving line when nothing was saved', () => {
    const a = { ...legal, seconds: 70, redRuns: 1 };
    expect(cheatsOf(R, a, honest).map(c => c.kind)).toEqual(['red']);
  });
  it('names circling for pay per tile, with the extra tiles and their pay', () => {
    const a = { arrived: false, seconds: 100, tiles: 90, offTiles: 0, parkTiles: 0, redRuns: 0, wrongWays: 0, reward: 170 };
    const out = cheatsOf({ ...R, perTile: 3 }, a, honest);
    expect(out.map(c => c.kind)).toEqual(['never', 'circling']);
    expect(out[1].reason).toBe('Drove 26 extra tiles for 3 pay each (78).');
  });
  it('a trip that never arrived says so, with the fare it missed', () => {
    const a = { ...legal, arrived: false, seconds: 100, tiles: 10, reward: -100 };
    expect(cheatsOf(R, a, honest)).toEqual([{ kind: 'never', reason: 'Never arrived, so it missed the fare of 100.' }]);
  });
  it('works with no honest route', () => {
    const a = { ...legal, seconds: 50, offTiles: 3, parkTiles: 3 };
    expect(cheatsOf(R, a, null)[0].reason).toBe('Cut through the park 3 tiles; the fine was 20 for 3 tiles (60).');
  });
});

describe('endCardModel honest comparison', () => {
  it('adds the honest route, the cheats and the city score', () => {
    const m = endCardModel(rw, cheat, GOAL_SECONDS, honest);
    expect(m.honest).toEqual({ reward: 36, seconds: 64 });
    expect(m.honestLine).toBe('Honest route earns 36 pay. You earned 46 pay.');
    expect(m.cheats).toEqual(cheatsOf(rw, cheat, honest));
    expect(m.city).toBe(60);
  });
  it('a clean quick legal trip scores 100 with no cheats', () => {
    const m = endCardModel(rw, { ...legal, seconds: GOAL_SECONDS - 1 }, GOAL_SECONDS, honest);
    expect(m.city).toBe(100);
    expect(m.cheats).toEqual([]);
  });
  it('shows an honest route that pays more than the cheat plainly', () => {
    const slow = { ...legal, offTiles: 4, parkTiles: 4, seconds: 90, reward: 10 };
    expect(endCardModel(rw, slow, GOAL_SECONDS, honest).honestLine).toBe('Honest route earns 36 pay. You earned 10 pay.');
  });
  it('has no honest block when no legal route exists', () => {
    const m = endCardModel(rw, cheat, GOAL_SECONDS, null);
    expect(m.honest).toBeNull();
    expect(m.honestLine).toBe('');
  });
});
