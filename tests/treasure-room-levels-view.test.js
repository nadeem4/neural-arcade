import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ROOM, START, REWARD } from '../games/treasure-room/sim.js';
import { initial, reduce, mount } from '../games/treasure-room/level-agent.js';
import { fakeUi } from './treasure-room-fake-ui.js';
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
  });
});

describe('level 1 steps (mount)', () => {
  let ui, view, score, steps;
  const el = id => ui.panel.querySelector(id);
  const press = (id, n = 1) => { for (let i = 0; i < n; i++) ui.click(id); };
  beforeEach(() => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    vi.stubGlobal('document', { addEventListener() {}, removeEventListener() {} });
    ui = fakeUi();
    ui.readout = (st, sc) => { steps = st; score = sc; };
    view = mount(ui);
  });
  afterEach(() => { view.destroy(); vi.unstubAllGlobals(); });

  it('answer off: ten presses send Right into the wall, score -10, and the robot hears nothing', () => {
    press('#tab2');
    press('#stepBtn', 10);
    expect(ui.last().agent).toEqual({ x: 4, y: 1 });
    expect([steps, score]).toEqual([10, -10]);
    expect(el('#turn').hidden).toBe(true);
  });
  it('answer on: six presses reach the treasure for +5, and the turn card shows the last turn', () => {
    press('#tab3');
    press('#stepBtn');
    expect(el('#turnSends').textContent).toBe('Agent sends: action Right');
    expect(el('#turnAnswers').textContent).toBe('Room answers: reward -1, now at x 1, y 1');
    expect(el('#turn').hidden).toBe(false);
    press('#stepBtn', 5);
    expect([steps, score]).toEqual([6, 5]);
    expect(ui.said.at(-1)).toContain('Found the treasure');
    expect(el('#stepBtn').disabled).toBe(true);
  });
  it('a tab starts from the start tile with zero score, and Restart does too', () => {
    press('#tab3');
    press('#stepBtn', 3);
    press('#tab2');
    expect([steps, score]).toEqual([0, 0]);
    expect(ui.last().agent).toEqual({ x: 0, y: 1 });
    press('#stepBtn', 2);
    press('#restart');
    expect([steps, score]).toEqual([0, 0]);
  });
  it('step 1 shows the arrow pad and no Step button, steps 2 and 3 the reverse', () => {
    expect([el('#pad').hidden, el('#stepBtn').hidden]).toEqual([false, true]);
    press('#tab2');
    expect([el('#pad').hidden, el('#stepBtn').hidden]).toEqual([true, false]);
  });
});
