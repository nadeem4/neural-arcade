import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseRecord, tripMs, frameCount, frameMs, pruneTags, recordApi, cardRewards } from '../games/city/record.js';
import { SWOOP_MS, PULLBACK_MS } from '../games/city/director.js';

describe('parseRecord', () => {
  it('is null unless record=1', () => {
    expect(parseRecord('')).toBeNull();
    expect(parseRecord('?card=speed')).toBeNull();
  });
  it('reads card and fps, defaulting fps to 30', () => {
    expect(parseRecord('?record=1&card=walk')).toEqual({ card: 'walk', fps: 30 });
    expect(parseRecord('?record=1&card=walk&fps=60').fps).toBe(60);
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
    expect(pruneTags(tags, 1500)).toEqual([{ born: 900 }, { born: 1500 }]);
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
  it('reports WebGL and reduced motion as errors, and is not ready then', () => {
    const noGl = recordApi({ stage: { ready: false }, totalMs: 9000, fps: 30 });
    expect(noGl.error).toMatch(/WebGL/);
    expect(noGl.ready).toBe(false);
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const rm = recordApi({ stage: stage(), totalMs: 9000, fps: 30 });
    expect(rm.error).toMatch(/reduced motion/);
    expect(rm.ready).toBe(false);
  });
});
