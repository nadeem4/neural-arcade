import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '../games/treasure-room/level-learn.js';
import { learn } from '../games/treasure-room/learner.js';
import { fakeUi } from './treasure-room-fake-ui.js';

describe('learning by reward steps (mount)', () => {
  let ui, view, steps, score;
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

  it('step 1: the room is covered, and ten moves show a position but no reward and no score', () => {
    expect(ui.dark).toBe(true);
    press('#learnRight', 3);
    press('#learnDown', 7);
    expect(el('#learnSees').textContent).toBe('x 3, y 4, reward ?');
    expect([steps, score]).toEqual([10, '?']);
  });
  it('step 2: the lights come on and your moves show as rewards that add up to the score', () => {
    press('#learnRight', 2);
    press('#learnDown');
    press('#learnTab2');
    expect(ui.dark).toBe(false);
    expect(el('#rewardRow').innerHTML).toMatch(/-1<.*-1<.*-10</);
    expect(el('#rewardSum').textContent).toBe('Score -12');
    expect(score).toBe(-12);
  });
  it('step 3: try 1 replays what the learner did, with a score below zero', () => {
    press('#learnTab3');
    press('#watchFirst');
    const { first } = learn();
    expect(ui.last().agent).toEqual(first.path.at(-1));
    expect(score).toBe(first.score);
    expect(el('#tryNote').textContent).toBe(`Try 1 · Score ${first.score} · ${first.rewards.length} steps`);
  });
  it('Watch try 200 stays disabled, with a reason, until the learner has trained', () => {
    press('#learnTab3');
    expect(el('#watchLast').disabled).toBe(true);
    expect(el('#learnWhy').textContent).not.toBe('');
    press('#skipTrain');
    expect(el('#watchLast').disabled).toBe(false);
    expect(el('#learnWhy').textContent).toBe('');
  });
  it('Skip to try 200 draws the score of every try, and Watch try 200 reaches the treasure for +5 in 6 steps', () => {
    press('#learnTab3');
    press('#skipTrain');
    expect(ui.curves.at(-1)).toEqual(learn().scores);
    expect(el('#tryNote').textContent).toBe('Try 200');
    press('#watchLast');
    expect([steps, score]).toEqual([6, 5]);
    expect(ui.said.at(-1)).toContain('Found the treasure');
  });
  it('Restart clears your drive and goes back to step 1 keeping the lights off', () => {
    press('#learnRight', 2);
    press('#learnRestart');
    expect(steps).toBe(0);
    expect(ui.dark).toBe(true);
  });
});
