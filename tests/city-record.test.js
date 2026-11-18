import { describe, it, expect } from 'vitest';
import { parseRecord, tripMs, frameCount, frameMs, pruneTags } from '../games/city/record.js';
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

describe('timing', () => {
  it('tripMs adds the swoop and pullback', () => {
    expect(tripMs(16000)).toBe(16000 + SWOOP_MS + PULLBACK_MS);
  });
  it('frameCount and frameMs', () => {
    expect(frameCount(1000, 30)).toBe(31);
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
