import { describe, it, expect } from 'vitest';
import { TRACKS, trackById } from '../assets/tracks/index.js';
import { flatLessons } from '../assets/tracks/model.js';
import {
  PROGRESS_KEY, parseProgress, serializeProgress, toggleDone, trackProgress, nextLesson,
  continueTarget, loadProgress, saveProgress,
} from '../assets/tracks/progress.js';

const rl = trackById('reinforcement-learning');
const ALL_LIVE_IDS = flatLessons().filter(l => l.status === 'live').map(l => l.id);
const throwing = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
const memory = (start = {}) => {
  const data = { ...start };
  return { data, getItem: k => data[k] ?? null, setItem: (k, v) => { data[k] = v; } };
};

describe('parse and serialize', () => {
  it('keeps unique strings only', () => {
    expect(parseProgress('["loop","loop",3,null]')).toEqual(['loop']);
  });
  it('gives [] for anything that is not an array of ids', () => {
    for (const bad of [null, undefined, '', 'x', '{}', '[1', '{"a":1}', '[1,null]', '"x"']) {
      expect(parseProgress(bad)).toEqual([]);
    }
  });
  it('round-trips', () => {
    expect(parseProgress(serializeProgress(['loop', 'pid']))).toEqual(['loop', 'pid']);
  });
});

describe('toggleDone', () => {
  it('adds and removes without mutating or duplicating', () => {
    const a = ['loop'];
    expect(toggleDone(a, 'policy', true)).toEqual(['loop', 'policy']);
    expect(toggleDone(a, 'loop', true)).toEqual(['loop']);
    expect(toggleDone(a, 'loop', false)).toEqual([]);
    expect(toggleDone(a, 'ghost', false)).toEqual(['loop']);
    expect(a).toEqual(['loop']);
  });
});

describe('trackProgress', () => {
  it('counts only live lessons that exist', () => {
    // 'ghost' was removed, 'sarsa' is soon: neither counts
    expect(trackProgress(['loop', 'ghost', 'sarsa'], rl)).toEqual({ done: 1, live: 7, soon: 19, total: 26, complete: false });
  });
  it('is complete when every live lesson is done', () => {
    expect(trackProgress(ALL_LIVE_IDS, rl).complete).toBe(true);
    expect(trackProgress([], rl).complete).toBe(false);
  });
});

describe('nextLesson and continueTarget', () => {
  it('nextLesson is the first live lesson not done, skipping soon ones', () => {
    expect(nextLesson([], rl).id).toBe('loop');
    expect(nextLesson(['loop', 'policy'], rl).id).toBe('state');
    expect(nextLesson(['loop', 'state', 'return', 'policy', 'value', 'mdp'], rl).id).toBe('reward-design');
    expect(nextLesson(ALL_LIVE_IDS, rl)).toBeNull();
  });
  it('a stale or soon id never moves Continue', () => {
    expect(nextLesson(['ghost', 'sarsa'], rl).id).toBe('loop');
    expect(continueTarget(['ghost', 'sarsa']).lesson.id).toBe('learning-from-examples');
  });
  it('continues at the first lesson of the first track when nothing is done', () => {
    const c = continueTarget([]);
    expect(c.lesson.id).toBe('learning-from-examples');
    expect(c.track.id).toBe('neural-networks');
    expect(c.first).toBe(true);
  });
  it('moves on to the next track, and first is false once anything is done', () => {
    const c = continueTarget(['learning-from-examples', 'learning-by-selection']);
    expect(c.lesson.id).toBe('loop');
    expect(c.track.id).toBe('reinforcement-learning');
    expect(c.first).toBe(false);
  });
  it('is null when every live lesson is done', () => {
    expect(continueTarget(ALL_LIVE_IDS)).toBeNull();
    expect(continueTarget(ALL_LIVE_IDS, TRACKS)).toBeNull();
  });
});

describe('guarded storage', () => {
  it('never throws when storage throws or is missing', () => {
    expect(loadProgress(throwing)).toEqual([]);
    expect(saveProgress(['loop'], throwing)).toBe(false);
    expect(loadProgress(undefined)).toEqual([]);
    expect(saveProgress(['loop'], undefined)).toBe(false);
    expect(loadProgress(null)).toEqual([]);
  });
  it('treats garbage in storage as no progress', () => {
    for (const raw of ['x', '{}', '[1,null]', '["loop"']) {
      expect(loadProgress(memory({ [PROGRESS_KEY]: raw }))).toEqual([]);
    }
  });
  it('saves and loads under na-progress-v1', () => {
    const s = memory();
    expect(PROGRESS_KEY).toBe('na-progress-v1');
    expect(saveProgress(['loop', 'pid'], s)).toBe(true);
    expect(s.data['na-progress-v1']).toBe('["loop","pid"]');
    expect(loadProgress(s)).toEqual(['loop', 'pid']);
  });
});
