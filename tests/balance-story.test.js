import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { recordStory } from '../games/balance/story-data.js';
import { aiAct, SIZES } from '../games/balance/ai.js';
import { newGame, step, LIMIT } from '../games/balance/sim.js';
import { createActs } from '../engine/tinynet.js';
import { PID_RANGES } from '../games/balance/sim.js';
import { TUNER_STORY_SEED } from '../games/balance/tune.js';

const saved = JSON.parse(readFileSync(new URL('../games/balance/story.json', import.meta.url), 'utf8'));
const S = recordStory();

// Seconds a genome survives with no pushes, from the standard small tilt.
function survives(genome) {
  const g = newGame(), acts = createActs(SIZES), input = new Float32Array(4);
  while (g.t < LIMIT) if (step(g, aiAct(genome, g, acts, input))) break;
  return g.t / 60;
}

const signChanges = a => a.reduce((n, v, i) => n + (i > 0 && Math.sign(v) !== Math.sign(a[i - 1]) ? 1 : 0), 0);

describe('the recorded run behind the write-up', () => {
  it('story.json matches a fresh recording (re-run node games/balance/story-data.js if the game changed)', () => {
    expect(saved).toEqual(S);
  }, 60000);

  it('P alone wobbles then falls', () => {
    expect(S.pid.pOnly.fell).toBe('tilt');
    expect(signChanges(S.pid.pOnly.th)).toBeGreaterThanOrEqual(6);
  });
  it('P plus D settles', () => {
    expect(S.pid.pd.fell).toBe(null);
    expect(S.pid.pd.th.slice(-100).every(v => Math.abs(v) < 0.01)).toBe(true);
  });
  it('Wind with I at zero leaves a steady error, and I removes it', () => {
    expect(Math.abs(S.pid.windNoI.x.at(-1))).toBeGreaterThan(0.5);
    expect(Math.abs(S.pid.windI.x.at(-1))).toBeLessThan(0.15);
  });
  it('the AI starts by falling and learns to balance', () => {
    expect(S.ai.history[0]).toBeLessThan(3);
    expect(S.ai.firstFull).toBeGreaterThanOrEqual(10);
    expect(S.ai.firstFull).toBeLessThanOrEqual(30);
    expect(S.ai.late.seconds).toBe(LIMIT / 60);
    expect(S.ai.early.seconds).toBeLessThan(3);
  });
  it('the fresh brain falls', () => {
    expect(survives(S.ai.fresh)).toBeLessThan(3);
  });
});

describe('the recorded tuner run', () => {
  const T = S.tuner, mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  it('uses the tuner story seed and records 30 generations of in-range dials', () => {
    expect(T.seed).toBe(TUNER_STORY_SEED);
    expect(T.dials).toHaveLength(30);
    expect(T.seconds).toHaveLength(30);
    for (const d of T.dials) for (const [k, key] of [[0, 'p'], [1, 'i'], [2, 'd']]) {
      expect(d[k]).toBeGreaterThanOrEqual(PID_RANGES[key].min);
      expect(d[k]).toBeLessThanOrEqual(PID_RANGES[key].max);
    }
  });
  it('I rises as evolution finds it', () => {
    expect(mean(T.dials.slice(-5).map(d => d[1]))).toBeGreaterThanOrEqual(mean(T.dials.slice(0, 3).map(d => d[1])) + 3);
  });
  it('the last dials beat the first', () => {
    expect(T.seconds.at(-1)).toBeGreaterThan(T.seconds[0]);
  });
});

describe('trace sampling', () => {
  it('ends a fallen try on its real last step', () => {
    expect(S.pid.pOnly.th.length).toBe(Math.ceil(S.pid.pOnly.steps / S.every));
    expect(S.ai.early.th.length).toBe(Math.ceil(S.ai.early.seconds * 60 / S.every));
  });
});

describe('the write-up page', () => {
  const dir = new URL('../games/balance/how-it-works/', import.meta.url);
  const html = readFileSync(new URL('index.html', dir), 'utf8');
  const js = readFileSync(new URL('story.js', dir), 'utf8');
  it('has seven numbered sections', () => {
    expect(html.match(/class="num-tag"/g)).toHaveLength(7);
  });
  it('has every canvas the script looks up', () => {
    const ids = [...js.matchAll(/\$\('([\w-]+)'\)/g)].map(m => m[1]).filter(id => id !== 'lamp'); // the lamp button comes from the shared header
    ids.push('brainEarly', 'brainLate', 'traceEarly', 'traceLate'); // looked up through template literals
    expect(ids.length).toBeGreaterThan(5);
    for (const id of ids) expect(html, id).toContain(`id="${id}"`);
  });
  it('draws from the recording, not from chance', () => {
    expect(js).toContain("fetch('../story.json')");
    expect(js).not.toContain('Math.random');
  });
  it('gives every figure canvas a role and a label', () => {
    for (const c of html.match(/<canvas[^>]*>/g)) expect(c).toMatch(/role="img"[^>]*aria-label=/);
  });
  it('has the tuned PID figure and says what separates the three controllers', () => {
    expect(html).toMatch(/<canvas id="figTune"[^>]*role="img"[^>]*aria-label="[^"]+"/);
    expect(html).toContain('Tuned PID');
    expect(html).toContain('never trained in wind');
    expect(html).toContain('evolution sets 37 weights');
  });
  it('states the lesson', () => {
    expect(html).toContain('Staying upright is constant correction: measure the error, push back. A tiny brain can find that rule on its own.');
  });
});
