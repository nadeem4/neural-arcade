import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseRecord, tripMs, frameCount, frameMs, pruneTags, recordApi, cardRewards } from '../games/city/record.js';
import { SWOOP_MS, PULLBACK_MS } from '../games/city/director.js';
import { readFileSync } from 'node:fs';
import { runSummary } from '../games/city/record.js';
import { endCardModel } from '../games/city/endcard.js';
import { GOAL_SECONDS } from '../games/city/presets.js';

describe('parseRecord', () => {
  it('is null unless record=1', () => {
    expect(parseRecord('')).toBeNull();
    expect(parseRecord('?card=speed')).toBeNull();
  });
  it('reads card and fps, defaulting fps to 30', () => {
    expect(parseRecord('?record=1&card=walk')).toEqual({ card: 'walk', fps: 30, cam: 'default' });
    expect(parseRecord('?record=1&card=walk&fps=60').fps).toBe(60);
  });
  it('reads cam: default, map or auto', () => {
    expect(parseRecord('?record=1&card=walk').cam).toBe('default');
    expect(parseRecord('?record=1&card=walk&cam=map').cam).toBe('map');
    expect(parseRecord('?record=1&card=walk&cam=auto').cam).toBe('auto');
    expect(() => parseRecord('?record=1&card=walk&cam=sky')).toThrow(/bad cam: sky/);
  });
  it('rejects bad input', () => {
    expect(() => parseRecord('?record=1&card=nope')).toThrow(/unknown card/);
    expect(() => parseRecord('?record=1')).toThrow(/card/);
    expect(() => parseRecord('?record=1&card=speed&fps=0')).toThrow(/fps/);
  });
});

describe('cardRewards', () => {
  it('copies the preset rewards', () => {
    expect(cardRewards('walk')).toMatchObject({ fare: 100, off: 20 });
    expect(cardRewards('walk')).not.toBe(cardRewards('walk'));
  });
});

describe('timing', () => {
  it('tripMs adds the swoop and pullback', () => {
    expect(tripMs(16000)).toBe(16000 + SWOOP_MS + PULLBACK_MS);
  });
  it('frameCount and frameMs', () => {
    expect(frameCount(1000, 30)).toBe(31);
    expect(frameCount(290, 100)).toBe(30);
    expect(frameMs(30, 30)).toBe(1000);
    expect(frameMs(1, 30)).toBeCloseTo(1000 / 30);
  });
});

describe('pruneTags', () => {
  it('drops tags that are lifeMs old or older', () => {
    const tags = [{ born: 0 }, { born: 900 }, { born: 1500 }];
    expect(pruneTags(tags, 1700)).toEqual([{ born: 900 }, { born: 1500 }]);
  });
});

describe('recordApi', () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  const stage = () => ({ ready: true, renderAt: vi.fn(() => ({ phase: 'drive', done: false })) });
  it('seek renders the stage at that time', () => {
    const st = stage();
    recordApi({ stage: st, totalMs: 9000, fps: 30 }).seek(500);
    expect(st.renderAt).toHaveBeenCalledWith(500);
  });
  it('is ready only once totalMs is above 0', () => {
    expect(recordApi({ stage: stage(), totalMs: 0, fps: 30 }).ready).toBe(false);
    const rc = recordApi({ stage: stage(), totalMs: 0, fps: 30 });
    rc.totalMs = 9000;
    expect(rc.ready).toBe(true);
    expect(rc.error).toBeNull();
  });
  it('reports a training failure as its own message', () => {
    const rc = recordApi({ stage: stage(), totalMs: 0, fps: 30 });
    rc.failure = 'training failed';
    expect(rc.error).toBe('training failed');
    expect(rc.ready).toBe(false);
  });
  it('reports missing WebGL as an error, and is not ready then', () => {
    const noGl = recordApi({ stage: { ready: false }, totalMs: 9000, fps: 30 });
    expect(noGl.error).toMatch(/WebGL/);
    expect(noGl.ready).toBe(false);
  });
  it('works under reduced motion: no error, ready once totalMs > 0', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const rc = recordApi({ stage: stage(), totalMs: 0, fps: 30 });
    expect(rc.error).toBeNull();
    expect(rc.ready).toBe(false);
    rc.totalMs = 9000;
    expect(rc.ready).toBe(true);
  });
  it('starts with no summary', () => {
    expect(recordApi({ stage: stage(), fps: 30 }).summary).toBeNull();
  });
});

describe('runSummary', () => {
  const story = JSON.parse(readFileSync(new URL('../games/city/story.json', import.meta.url), 'utf8'));
  const walk = story.cards.find((c) => c.id === 'walk');
  const offences = [
    { ms: 2000, type: 'off', label: '-20 footpath tile', x: 1 },
    { ms: 3000, type: 'red', label: '-5 red light run', x: 2 },
  ];
  const input = { card: 'walk', rewards: walk.rewards, analysis: walk.analysis, scared: 3, offences, goalSeconds: GOAL_SECONDS };
  it('has exactly the documented keys and the end card figures', () => {
    const s = runSummary(input);
    expect(Object.keys(s)).toEqual(['card', 'seconds', 'pay', 'cityScore', 'legal', 'onTime', 'offences', 'events']);
    const m = endCardModel(walk.rewards, walk.analysis, GOAL_SECONDS, null, 3);
    expect(s).toMatchObject({ card: 'walk', seconds: walk.analysis.seconds, pay: m.earned, cityScore: m.city, legal: m.legal, onTime: m.timeOk });
    expect(s.offences).toEqual({ offTiles: walk.analysis.offTiles, red: walk.analysis.redRuns, wrong: walk.analysis.wrongWays, scared: 3 });
  });
  it('events are the offences as { ms, type, label }', () => {
    expect(runSummary(input).events).toEqual([{ ms: 2000, type: 'off', label: '-20 footpath tile' }, { ms: 3000, type: 'red', label: '-5 red light run' }]);
  });
});

describe('the scene under reduced motion', () => {
  const scene = readFileSync(new URL('../games/city/scene.js', import.meta.url), 'utf8');
  it('only ends a trip at once when the clock is not manual', () => {
    expect(scene).toContain('!motionAllowed() && !manualClock');
    expect(scene).toContain('{ reduced: !motionAllowed() }');
  });
  it('the page wires the summary', () => {
    const main = readFileSync(new URL('../games/city/main.js', import.meta.url), 'utf8');
    expect(main).toContain('offences: buildOffences(events, ');
    expect(main).toContain('rc.summary = runSummary(');
  });
});
