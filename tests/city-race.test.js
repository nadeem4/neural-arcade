import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadWorld, analyzeRoute } from '../games/city/sim.js';
import { raceTracks, raceStateAt, result, bannerLine, raceBarLine, leaderBlips, togglePick, MAX_PICK } from '../games/city/race.js';
import { raceDetailOf } from '../games/city/race-view.js';

const read = f => JSON.parse(readFileSync(new URL('../games/city/' + f, import.meta.url), 'utf8'));
const city = read('chicago.json');
const world = loadWorld(city);
const cards = read('story.json').cards;
const entry = id => {
  const { rewards, route } = cards.find(c => c.id === id);
  const analysis = analyzeRoute(world, route, rewards);
  return { id, name: id, rewards, route, analysis };
};
const fast = entry('speed'), legal = entry('legal');
const race = raceTracks(world, city.cellM, [fast, legal]);

// A crafted race: totals stand in for events, so the winner rules are tested without a route.
const fake = (a, b) => ({ cars: [a, b].map(t => ({ events: { totals: t } })) });
const T = (arrived, seconds, reward) => ({ arrived, seconds, reward });

describe('raceTracks', () => {
  it('makes two cars on one clock, both starting at the same pickup and tick 0', () => {
    expect(race.cars).toHaveLength(2);
    expect(race.cars[0].track.tickMs).toBe(race.cars[1].track.tickMs);
    expect(race.tickMs).toBe(race.cars[0].track.tickMs);
    for (const c of race.cars) expect(c.track.frames[0].tick).toBe(0);
    expect(race.cars[0].track.frames[0]).toEqual(race.cars[1].track.frames[0]);
    expect(race.total).toBe(Math.max(...race.cars.map(c => c.track.total)));
  });
  it('refuses two entries that do not start at the same cell', () => {
    const odd = { ...legal, route: { ...legal.route, cells: [legal.route.cells[0] + 1, ...legal.route.cells.slice(1)] } };
    expect(() => raceTracks(world, city.cellM, [fast, odd])).toThrow(/pickup/);
  });
});

describe('raceStateAt', () => {
  it('is deterministic', () => {
    expect(raceStateAt(race, 3000)).toEqual(raceStateAt(race, 3000));
  });
  it('starts with both cars at rest on the same tick and zero meters', () => {
    const s = raceStateAt(race, 0);
    expect(s.cars.map(c => c.finished)).toEqual([false, false]);
    expect(s.cars[0].state.tick).toBe(s.cars[1].state.tick);
    expect(s.cars.map(c => Math.round(c.meter.total))).toEqual([0, 0]);
    expect(s.done).toBe(false);
  });
  it('ends with every meter equal to its entry total, and stops the clock once both are done', () => {
    const s = raceStateAt(race, race.total + 5000);
    expect(s.done).toBe(true);
    expect(s.cars.map(c => c.finished)).toEqual([true, true]);
    race.cars.forEach((c, i) => expect(s.cars[i].meter.total).toBeCloseTo(c.events.totals.reward, 6));
    expect(raceStateAt(race, race.total + 99999)).toEqual(s);
  });
  it('marks the shorter drive finished while the longer one still runs', () => {
    const [a, b] = race.cars.map(c => c.track.total);
    expect(a).toBeLessThan(b);
    const s = raceStateAt(race, (a + b) / 2);
    expect(s.cars.map(c => c.finished)).toEqual([true, false]);
    expect(s.done).toBe(false);
  });
  it('names the leader by distance left to the drop-off, and nobody at the start or when both are home', () => {
    expect(raceStateAt(race, 0).leader).toBe(null);
    const [a, b] = race.cars.map(c => c.track.total);
    expect(raceStateAt(race, (a + b) / 2).leader).toBe(0); // the quick taxi is home, the other is not
  });
});

describe('shared light clock', () => {
  it('is floor(ms / tickMs) all race long, so it keeps running after one car finishes', () => {
    const [a] = race.cars.map(c => c.track.total);
    for (const ms of [0, 1234, a - 1, a + race.tickMs * 2, race.total - 1, race.total + 500]) {
      expect(raceStateAt(race, ms).tick).toBe(Math.floor(Math.min(ms, race.total) / race.tickMs));
    }
    const after = raceStateAt(race, a + race.tickMs * 3);
    expect(after.cars[0].finished).toBe(true);
    expect(after.tick).toBeGreaterThan(raceStateAt(race, a).tick);
  });
  it('plays the still-driving car (not the finished leader) once the other has finished once the other has finished', () => {
    const [a] = race.cars.map(c => c.track.total);
    const s = raceStateAt(race, a + race.tickMs * 3);
    expect(s.cars.map(c => c.finished)).toEqual([true, false]);
    const r = leaderBlips(race, s, [0, 0]);
    expect(r.steps).toEqual(race.cars[1].events.steps.slice(0, Math.min(s.cars[1].state.stepIndex, race.cars[1].events.steps.length)));
  });
});

describe('result', () => {
  it('gives the race to the faster arrival, by the seconds between them', () => {
    expect(result(fake(T(true, 30, 50), T(true, 40, 90)))).toMatchObject({ winner: 0, by: 10, reason: 'time' });
    expect(result(fake(T(true, 50, 90), T(true, 40, 50)))).toMatchObject({ winner: 1, by: 10 });
  });
  it('equal seconds is a dead heat even if rewards differ', () => {
    expect(result(fake(T(true, 40, 50), T(true, 40, 90)))).toEqual({ winner: 'tie', by: 0, reason: 'time' });
    expect(result(fake(T(true, 40, 70), T(true, 40, 70)))).toEqual({ winner: 'tie', by: 0, reason: 'time' });
  });
  it('a taxi that never arrives loses, and two that never arrive tie', () => {
    expect(result(fake(T(false, 90, 500), T(true, 80, -10)))).toMatchObject({ winner: 1, reason: 'arrived' });
    expect(result(fake(T(true, 80, -10), T(false, 90, 500)))).toMatchObject({ winner: 0 });
    expect(result(fake(T(false, 90, 1), T(false, 90, 2)))).toMatchObject({ winner: 'tie', reason: 'none' });
  });
  it('decides the real crafted pair: the speedy taxi beats the law-abiding one on time', () => {
    const r = result(race);
    expect(r.winner).toBe(0);
    expect(r.by).toBe(legal.analysis.seconds - fast.analysis.seconds);
  });
});

describe('bannerLine', () => {
  const names = ['Speedy', 'Legal'];
  it('says who won and by how much', () => {
    expect(bannerLine({ winner: 0, by: 12, reason: 'time' }, names)).toBe('Speedy wins by 12 s');
    expect(bannerLine({ winner: 1, by: 1, reason: 'time' }, names)).toBe('Legal wins by 1 s');
    expect(bannerLine({ winner: 0, by: null, reason: 'arrived' }, names)).toBe('Speedy wins: Legal never arrived');
    expect(bannerLine({ winner: 'tie', by: 0, reason: 'none' }, names)).toBe('Neither taxi arrived');
    expect(bannerLine({ winner: 'tie', by: 0, reason: 'time' }, names)).toBe('A dead heat');
  });
});

describe('raceBarLine', () => {
  it('asks for the missing pick, then names the pair', () => {
    expect(raceBarLine([])).toBe('');
    expect(raceBarLine(['Speedy'])).toBe('Pick one more taxi to race Speedy');
    expect(raceBarLine(['Speedy', 'Legal'])).toBe('Race: Speedy vs Legal, same pickup, same lights');
  });
});

describe('leaderBlips', () => {
  const lenOf = i => race.cars[i].events.steps.length;
  it('plays only the steps the leader finished since the last frame, and moves both counts on', () => {
    const s = raceStateAt(race, 6000), lead = s.leader;
    const upTo = i => Math.min(s.cars[i].state.stepIndex, lenOf(i));
    const r = leaderBlips(race, s, [0, 0]);
    expect(r.steps).toEqual(race.cars[lead].events.steps.slice(0, upTo(lead)));
    expect(r.done).toEqual([upTo(0), upTo(1)]);
    expect(leaderBlips(race, s, r.done).steps).toEqual([]);
  });
  it('is silent when nobody leads, and never plays the trailing car', () => {
    expect(leaderBlips(race, raceStateAt(race, 0), [0, 0]).steps).toEqual([]);
    const t = raceStateAt(race, 6000), trail = 1 - t.leader;
    const r = leaderBlips(race, t, [0, 0]);
    expect(r.steps.every(x => race.cars[t.leader].events.steps.includes(x))).toBe(true);
    expect(r.done[trail]).toBeGreaterThan(0); // its count still advances, so it never replays later
  });
});

describe('togglePick', () => {
  it('adds, removes, and when a third is picked drops the oldest pick', () => {
    expect(MAX_PICK).toBe(2);
    let p = togglePick([], 'a');
    p = togglePick(p, 'b'); expect(p).toEqual(['a', 'b']);
    expect(togglePick(p, 'c')).toEqual(['b', 'c']);
    expect(togglePick(p, 'a')).toEqual(['b']);
  });
});

describe('raceDetailOf', () => {
  const names = ['Speedy', 'Legal'];
  it('explains a dead heat on time with different rewards', () => {
    const t = [T(true, 40, 50), T(true, 40, 90)];
    const text = raceDetailOf(result(fake(...t)), t, names);
    expect(text).toBe('Speedy: 40 s, earned +50. Legal: 40 s, earned +90. Same time, so nobody wins, even though one earned more.');
  });
  it('adds nothing when the rewards match or someone won', () => {
    const same = [T(true, 40, 70), T(true, 40, 70)];
    expect(raceDetailOf(result(fake(...same)), same, names)).not.toContain('Same time');
    const won = [T(true, 30, 50), T(true, 40, 90)];
    expect(raceDetailOf(result(fake(...won)), won, names)).not.toContain('Same time');
  });
});
