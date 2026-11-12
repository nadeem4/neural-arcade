import { describe, it, expect } from 'vitest';
import {
  describeInput, describeOutput, fallNote, tryNote, pidHint, DIAL_INFO, firstFullGeneration, aiNote, modeLine, modeSay, freshSay, formulaLine, formulaLive, tunedHint, tunedNote,
} from '../games/balance/words.js';

const run = (outcome, reason = null, t = 150) => ({ outcome, reason, g: { t } });

describe('brain panel words', () => {
  it('describes each input with its boundaries', () => {
    expect(describeInput(0, 0.09)).toBe('centred');
    expect(describeInput(0, 0.1)).toBe('right of centre');
    expect(describeInput(0, -0.1)).toBe('left of centre');
    expect(describeInput(1, 0.04)).toBe('still');
    expect(describeInput(1, 0.05)).toBe('moving right');
    expect(describeInput(1, -0.5)).toBe('moving left');
    expect(describeInput(2, -0.04)).toBe('upright');
    expect(describeInput(2, 0.05)).toBe('leaning right');
    expect(describeInput(2, -0.05)).toBe('leaning left');
    expect(describeInput(3, 0.04)).toBe('steady');
    expect(describeInput(3, 0.3)).toBe('tipping right');
    expect(describeInput(3, -0.3)).toBe('tipping left');
  });
  it('describes the output', () => {
    expect(describeOutput(0, 0.04)).toBe('not pushing');
    expect(describeOutput(0, 0.5)).toBe('pushing right 5 N');
    expect(describeOutput(0, -1)).toBe('pushing left 10 N');
  });
});

describe('how a try ended', () => {
  it('fallNote and tryNote', () => {
    expect(fallNote(run('limit', null, 1200))).toBe('Stayed up the full 20 s.');
    expect(fallNote(run('fell', 'tilt', 150))).toBe('The pole fell after 2.5 s.');
    expect(fallNote(run('fell', 'rail', 90))).toBe('The cart hit the end of the rail after 1.5 s.');
    expect(fallNote(run(null))).toBe('');
    expect(tryNote('You', run('fell', 'tilt', 150))).toBe('You: The pole fell after 2.5 s.');
  });
});

describe('PID hints', () => {
  it('first match wins', () => {
    const h = (p, i, d, wind) => pidHint({ p, i, d }, wind);
    expect(h(0, 0, 0, false)).toMatch(/falls/);
    expect(h(0, 0, 0, false)).toMatch(/Raise P/);
    expect(h(10, 0, 0, false)).toMatch(/too weak/);
    expect(h(25, 0, 0, false)).toMatch(/wobble/);
    expect(h(25, 0, 0, false)).toMatch(/Raise D/);
    expect(h(25, 0, 4, true)).toMatch(/off-centre/);
    expect(h(25, 0, 4, true)).toMatch(/Raise I/);
    expect(h(25, 12, 4, false)).toMatch(/turn Wind on/);
    expect(h(25, 0, 4, false)).toMatch(/settles/);
    expect(h(25, 12, 4, true)).toMatch(/settles/);
  });
  it('has an (i) sentence for each dial', () => {
    for (const k of ['p', 'i', 'd']) expect(DIAL_INFO[k].length).toBeGreaterThan(10);
  });
});

describe('the AI in words', () => {
  it('firstFullGeneration is 1-based, or -1', () => {
    expect(firstFullGeneration([2, 9.5, 20, 20])).toBe(3);
    expect(firstFullGeneration([1, 2])).toBe(-1);
    expect(firstFullGeneration([])).toBe(-1);
  });
  it('aiNote', () => {
    expect(aiNote([])).toBe('No generation yet: this brain is still random.');
    expect(aiNote([1, 2.25])).toBe('Generation 2: its best brain stayed up 2.3 s.');
    expect(aiNote([2, 20, 20])).toBe('Generation 3: its best brain stayed up 20.0 s. It first held the full 20 s in generation 2.');
  });
  it('modeLine says what each mode is', () => {
    expect(modeLine('you')).toMatch(/arrow keys/);
    expect(modeLine('pid')).toMatch(/three dials/);
    expect(modeLine('ai')).toMatch(/evolution/);
  });
});

describe('tuned PID words', () => {
  it('writes the dials as a formula', () => {
    expect(formulaLine({ p: 21, i: 9, d: 4 })).toBe('push = 21 × lean + 9 × lean over time + 4 × spin');
    expect(formulaLine({ p: 21, i: 0, d: 4 })).toBe('push = 21 × lean + 4 × spin');
    expect(formulaLine({ p: 0, i: 0, d: 0 })).toBe('push = nothing');
    expect(formulaLine({ p: 7, i: 1, d: 0.5 })).toBe('push = 7 × lean + 1 × lean over time + 0.5 × spin');
  });
  it('shows what each term pushes right now, signed with one decimal', () => {
    expect(formulaLive({ p: 3.14, i: 0.42, d: -1.24 })).toBe('now: +3.1 N from lean, +0.4 N from lean over time, -1.2 N from spin');
  });
  it('hints at what evolution has found, first matching rule wins', () => {
    expect(tunedHint({ p: 20, i: 1, d: 2 }, true)).toMatch(/not found I yet/);
    expect(tunedHint({ p: 20, i: 9, d: 2 }, true)).toMatch(/tested in wind/);
    expect(tunedHint({ p: 20, i: 9, d: 2 }, false)).toMatch(/Turn Wind on/);
  });
  it('says a first guess before any generation, then the best of the latest', () => {
    expect(tunedNote([])).toBe('No generation yet: these dials are a first guess, untuned.');
    expect(tunedNote([3.2, 18])).toBe('Generation 2: its best dials stayed up 18.0 s across shoves and wind.');
  });
  it('says something for every mode, and the wind-off hint does not claim it is still adjusting', () => {
    for (const m of ['you', 'pid', 'tuned', 'ai']) expect(modeSay(m)).toBeTruthy();
    expect(new Set(['you', 'pid', 'tuned', 'ai'].map(modeSay)).size).toBe(4);
    expect(freshSay('tuned')).toMatch(/dials/);
    expect(freshSay('ai')).toMatch(/random brain/);
    expect(tunedHint({ p: 50, i: 20, d: 2 }, false)).not.toMatch(/still adjusting/);
  });
  it('has a line for the tuned and AI modes', () => {
    expect(modeLine('tuned')).toMatch(/set by evolution/);
    expect(modeLine('ai')).toBe('AI: no formula, a tiny network whose 37 weights evolution sets.');
  });
});
