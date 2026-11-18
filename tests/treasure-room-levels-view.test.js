import { describe, it, expect } from 'vitest';
import { ROOM, START, REWARD } from '../games/treasure-room/sim.js';
import { initial, reduce } from '../games/treasure-room/level-agent.js';
import { appendLog, tagsFor } from '../games/treasure-room/level-triples.js';
import { logLine } from '../games/treasure-room/words.js';

const UP = 0, DOWN = 1, LEFT = 2, RIGHT = 3;
const play = (s, ...actions) => actions.reduce((st, action) => reduce(st, { type: 'move', action }), s);

describe('level 1 reduce', () => {
  it('starts on the start tile with nothing seen', () => {
    expect(initial()).toMatchObject({ pos: START, steps: 0, total: 0, done: false, mode: 'you', lastObs: null });
  });
  it('a move updates position, steps, total and what the AI is shown', () => {
    const s = play(initial(), RIGHT);
    expect(s.pos).toEqual({ x: START.x + 1, y: START.y });
    expect(s).toMatchObject({ steps: 1, total: REWARD.step, lastAction: RIGHT });
    expect(s.lastObs).toEqual({ x: s.pos.x, y: s.pos.y, reward: REWARD.step });
  });
  it('bumping the edge stays put and still costs a step', () => {
    const s = play(initial(), LEFT);
    expect(s.pos).toEqual(START);
    expect(s.total).toBe(REWARD.step);
  });
  it('ignores every move after the pit, so nothing is scored twice', () => {
    const done = play(initial(), RIGHT, RIGHT, DOWN);
    expect(done).toMatchObject({ done: true, total: 2 * REWARD.step + REWARD.pit });
    const after = play(done, UP, DOWN, LEFT, RIGHT);
    expect(after).toEqual(done);
    expect(reduce(done, { type: 'aiStep' })).toEqual(done);
  });
  it('handover switches to the AI, whose steps follow the greedy policy to the treasure', () => {
    let s = reduce(initial(), { type: 'handover' });
    expect(s.mode).toBe('ai');
    for (let i = 0; i < 30 && !s.done; i++) s = reduce(s, { type: 'aiStep' });
    expect(s.done).toBe(true);
    expect(ROOM.cells[s.pos.y][s.pos.x]).toBe('T');
    expect(s.total).toBe((s.steps - 1) * REWARD.step + REWARD.treasure);
    const again = reduce(initial(), { type: 'handover' });
    expect(reduce(again, { type: 'aiStep' })).toEqual(reduce(again, { type: 'aiStep' }));
  });
  it('restart goes back to the start with everything zeroed', () => {
    const s = reduce(play(initial(), RIGHT, RIGHT, DOWN), { type: 'restart' });
    expect(s).toEqual(initial());
  });
});

describe('level 2 log', () => {
  const entry = r => ({ pos: START, action: RIGHT, reward: r });
  it('keeps the last 8 lines, each from logLine', () => {
    let log = [];
    for (let i = 0; i < 12; i++) log = appendLog(log, { pos: { x: i % 5, y: 0 }, action: RIGHT, reward: -1 });
    expect(log).toHaveLength(8);
    expect(log[7]).toBe(logLine({ pos: { x: 1, y: 0 }, action: RIGHT, reward: -1 }));
    expect(log[0]).toBe(logLine({ pos: { x: 4, y: 0 }, action: RIGHT, reward: -1 }));
  });
  it('floats a tag per reward', () => {
    expect(tagsFor({ pos: { x: 2, y: 1 }, reward: -1 })).toEqual([{ x: 2, y: 1, text: '−1', tone: 'step' }]);
    expect(tagsFor({ pos: { x: 4, y: 3 }, reward: 10 })[0]).toMatchObject({ text: '+10', tone: 'good' });
    expect(tagsFor({ pos: { x: 2, y: 2 }, reward: -10 })[0]).toMatchObject({ text: '−10', tone: 'bad' });
    expect(tagsFor(null)).toEqual([]);
    expect(entry(0)).toBeTruthy();
  });
});
