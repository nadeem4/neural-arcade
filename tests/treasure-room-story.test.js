import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { recordStory } from '../games/treasure-room/story-data.js';
import { ROOM, valueIteration, REWARD } from '../games/treasure-room/sim.js';

const saved = JSON.parse(readFileSync(new URL('../games/treasure-room/story.json', import.meta.url), 'utf8'));
const S = recordStory();
const decimals = v => (String(v).split('.')[1] || '').length;
const numbers = o => (typeof o === 'number' ? [o] : o && typeof o === 'object' ? Object.values(o).flatMap(numbers) : []);

describe('the recorded run behind the Treasure Room write-up', () => {
  it('story.json matches a fresh recording (re-run node games/treasure-room/story-data.js if the sim changed)', () => {
    expect(saved).toEqual(S);
  });

  it('records the room and its rewards', () => {
    expect(S.room).toEqual(ROOM.cells.map(r => r.join('')));
    expect(S.reward).toEqual({ treasure: 10, pit: -10, step: -1 });
  });

  it('the AI walk ends at the treasure and its total is the sum of the triple rewards', () => {
    const last = S.agent.trace.at(-1);
    expect(ROOM.cells[last.pos.y][last.pos.x]).toBe('T');
    expect(S.agent.total).toBe(S.agent.trace.reduce((s, t) => s + t.reward, 0));
    expect(S.triples.length).toBeLessThanOrEqual(8);
    S.triples.forEach((t, i) => expect(t.reward).toBe(S.agent.trace[i].reward));
  });

  it('the first triple starts on the start tile', () => {
    expect(ROOM.cells[S.triples[0].state.y][S.triples[0].state.x]).toBe('S');
  });

  it('a lower discount shrinks the treasure term until the walk is not worth it, and the short route never loses to the detour', () => {
    const { gammas, short, detour } = S.returns;
    expect(gammas).toEqual([1, 0.9, 0.5, 0.1]);
    const worth = short.map(r => r.terms.at(-1));
    for (let i = 1; i < gammas.length; i++) expect(worth[i]).toBeLessThan(worth[i - 1]);
    for (let i = 1; i < 3; i++) expect(short[i].total).toBeLessThan(short[i - 1].total);
    expect(short[0].total).toBeGreaterThan(0);
    expect(short.at(-1).total).toBeLessThan(0);
    gammas.forEach((_, i) => expect(short[i].total).toBeGreaterThanOrEqual(detour[i].total));
    expect(short[0].terms.length).toBeLessThan(detour[0].terms.length);
  });

  it('the bad rulebook never reaches the treasure and the fixed one does', () => {
    expect(S.policy.badRun.outcome).not.toBe('treasure');
    expect(S.policy.fixedRun.outcome).toBe('treasure');
    expect(S.policy.bad.length).toBe(25);
    expect(S.policy.fixed.length).toBe(25);
  });

  it('value snapshots spread outward and the last one matches value iteration', () => {
    const snaps = S.value.snapshots;
    expect(snaps.map(s => s.sweep)).toEqual([1, 2, 3, 5, S.value.settle]);
    const counts = snaps.map(s => s.values.filter(v => v > 0).length);
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]);
    expect(counts.at(-1)).toBeGreaterThan(counts[0]);
    const last = snaps.at(-1);
    const want = valueIteration(ROOM, { gamma: S.value.gamma });
    last.values.forEach((v, i) => expect(Math.abs(v - want[i])).toBeLessThan(0.01));
  });

  it('on a dry floor the plan hugs the pit, on ice it does not, and ice makes the dry plan fall in more', () => {
    expect(S.mdp.dry.pitAdjacent).toBe(true);
    expect(S.mdp.icy.pitAdjacent).toBe(false);
    expect(S.mdp.dry.startValue).toBeGreaterThan(S.mdp.icy.startValue);
    expect(S.mdp.trips.dry.pit).toBeGreaterThan(S.mdp.trips.icy.pit);
  });

  it('is rounded to 4 places', () => {
    for (const n of numbers(S)) expect(decimals(n)).toBeLessThanOrEqual(4);
  });
});
