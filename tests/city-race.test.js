import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadWorld, analyzeRoute } from '../games/city/sim.js';
import { raceTracks, raceStateAt, result, bannerLine, raceBarLine, togglePick, MAX_PICK } from '../games/city/race.js';

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

describe('result', () => {
  it('gives the race to the faster arrival, by the seconds between them', () => {
    expect(result(fake(T(true, 30, 50), T(true, 40, 90)))).toMatchObject({ winner: 0, by: 10, reason: 'time' });
    expect(result(fake(T(true, 50, 90), T(true, 40, 50)))).toMatchObject({ winner: 1, by: 10 });
  });
  it('breaks a tie on seconds by what each earned, and calls equal earnings a tie', () => {
    expect(result(fake(T(true, 40, 50), T(true, 40, 90)))).toMatchObject({ winner: 1, by: 0, reason: 'earned' });
    expect(result(fake(T(true, 40, 70), T(true, 40, 70)))).toMatchObject({ winner: 'tie' });
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
    expect(bannerLine({ winner: 1, by: 0, reason: 'earned' }, names)).toBe('Same time: Legal wins on earnings');
    expect(bannerLine({ winner: 0, by: null, reason: 'arrived' }, names)).toBe('Speedy wins: Legal never arrived');
    expect(bannerLine({ winner: 'tie', by: 0, reason: 'none' }, names)).toBe('Neither taxi arrived');
    expect(bannerLine({ winner: 'tie', by: 0, reason: 'earned' }, names)).toBe('A dead heat');
  });
});

describe('raceBarLine', () => {
  it('asks for the missing pick, then names the pair', () => {
    expect(raceBarLine([])).toBe('');
    expect(raceBarLine(['Speedy'])).toBe('Pick one more taxi to race Speedy');
    expect(raceBarLine(['Speedy', 'Legal'])).toBe('Race: Speedy vs Legal, same pickup, same lights');
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
