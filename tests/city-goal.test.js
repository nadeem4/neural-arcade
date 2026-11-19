import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadWorld } from '../games/city/sim.js';
import { tripEvents } from '../games/city/events.js';
import { trueGoal, goalAt, ARRIVE_POINTS, ON_TIME_POINTS, CLEAN_POINTS, SCARE_COST, SCARE_MAX } from '../games/city/goal.js';
import { GOAL_SECONDS } from '../games/city/presets.js';

const read = (f) => JSON.parse(readFileSync(new URL('../games/city/' + f, import.meta.url), 'utf8'));
const world = loadWorld(read('chicago.json'));
const story = read('story.json');
const eventsOf = (id) => { const c = story.cards.find((x) => x.id === id); return tripEvents(world, c.rewards, c.route); };
const A = (o) => ({ arrived: true, seconds: 50, offTiles: 0, redRuns: 0, wrongWays: 0, ...o });

describe('trueGoal', () => {
  it('names its constants: 60 + 20 + 20, 5 per scared person', () => {
    expect([ARRIVE_POINTS, ON_TIME_POINTS, CLEAN_POINTS, SCARE_COST]).toEqual([60, 20, 20, 5]);
  });
  it('a legal fast trip scores 100', () => {
    const g = trueGoal({ analysis: A({}), goalSeconds: GOAL_SECONDS });
    expect(g).toMatchObject({ arrived: true, onTime: true, scared: 0, score: 100, violations: { off: 0, red: 0, wrong: 0 } });
    expect(g.parts).toEqual({ arrive: 60, onTime: 20, clean: 20, scared: 0 });
  });
  it('a legal slow trip loses the on-time points', () => {
    expect(trueGoal({ analysis: A({ seconds: GOAL_SECONDS }), goalSeconds: GOAL_SECONDS }).score).toBe(80);
  });
  it('a park cut loses the clean and on-time points, and says why', () => {
    const g = trueGoal({ analysis: A({ seconds: 40, offTiles: 30 }), goalSeconds: GOAL_SECONDS });
    expect(g.score).toBe(60);
    expect(g.violations.off).toBe(30);
    expect(g.parts.clean).toBe(0);
    expect(g.onTime).toBe(false);
  });
  it('never arriving earns nothing for arrival or being on time', () => {
    const g = trueGoal({ analysis: A({ arrived: false, seconds: 400 }), goalSeconds: GOAL_SECONDS });
    expect(g.parts.arrive).toBe(0);
    expect(g.parts.onTime).toBe(0);
    expect(g.parts.clean).toBe(0);
    expect(g.score).toBe(0);
  });
  it('each scared person costs 5, up to SCARE_MAX in all', () => {
    expect(trueGoal({ analysis: A({}), scares: [1, 2], goalSeconds: GOAL_SECONDS }).score).toBe(90);
    expect(trueGoal({ analysis: A({}), scares: new Array(40).fill(0), goalSeconds: GOAL_SECONDS }).score).toBe(100 - SCARE_MAX);
  });
  it('scares default to none', () => {
    expect(trueGoal({ analysis: A({}), goalSeconds: GOAL_SECONDS }).scared).toBe(0);
  });
  it('the five story cards', () => {
    const score = (id) => trueGoal({ analysis: eventsOf(id).totals, goalSeconds: GOAL_SECONDS }).score;
    expect({ speed: score('speed'), walk: score('walk'), lights: score('lights'), legal: score('legal'), mile: score('mile') })
      .toEqual({ speed: 60, walk: 60, lights: 60, legal: 100, mile: 0 });
  });
});

describe('goalAt', () => {
  it('live final value equals the end value on every card', () => {
    for (const c of story.cards) {
      const ev = eventsOf(c.id);
      const end = trueGoal({ analysis: ev.totals, goalSeconds: GOAL_SECONDS }).score;
      expect(goalAt(ev, 0, ev.steps.length, GOAL_SECONDS), c.id).toBe(end);
      expect(goalAt(ev, 0, ev.steps.length + 30, GOAL_SECONDS), c.id).toBe(end);
    }
  });
  it('with scares the live final value equals the end value too', () => {
    const ev = eventsOf('legal');
    expect(goalAt(ev, 3, ev.steps.length, GOAL_SECONDS)).toBe(trueGoal({ analysis: ev.totals, scares: [1, 2, 3], goalSeconds: GOAL_SECONDS }).score);
  });
  it('starts at 100 and never rises, on every card, with no NaN', () => {
    for (const c of story.cards) {
      const ev = eventsOf(c.id);
      expect(goalAt(ev, 0, 0, GOAL_SECONDS), c.id).toBe(100);
      let prev = 100;
      for (let f = 0; f <= ev.steps.length + 1; f += 0.5) {
        const g = goalAt(ev, 0, f, GOAL_SECONDS);
        expect(Number.isNaN(g)).toBe(false);
        expect(g, `${c.id} at ${f}`).toBeLessThanOrEqual(prev);
        prev = g;
      }
    }
  });
  it('falls by 20 at the first violation', () => {
    const ev = eventsOf('speed');
    const first = ev.steps.findIndex((s) => s.off || s.red || s.wrong);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(goalAt(ev, 0, first, GOAL_SECONDS)).toBe(100);
    expect(goalAt(ev, 0, first + 1, GOAL_SECONDS)).toBe(60);
  });
  it('loses the on-time points when the goal time passes, and 5 per scared person', () => {
    const ev = { steps: new Array(100).fill({}), totals: { arrived: true, seconds: 100, offTiles: 0, redRuns: 0, wrongWays: 0 } };
    expect(goalAt(ev, 0, GOAL_SECONDS - 1, GOAL_SECONDS)).toBe(100);
    expect(goalAt(ev, 0, GOAL_SECONDS, GOAL_SECONDS)).toBe(80);
    expect(goalAt(ev, 2, 10, GOAL_SECONDS)).toBe(90);
  });
});
