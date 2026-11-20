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
    expect(parseProgress('["agent","agent",3,null]')).toEqual(['agent']);
  });
  it('gives [] for anything that is not an array of ids', () => {
    for (const bad of [null, undefined, '', 'x', '{}', '[1', '{"a":1}', '[1,null]', '"x"']) {
      expect(parseProgress(bad)).toEqual([]);
    }
  });
  it('round-trips', () => {
    expect(parseProgress(serializeProgress(['agent', 'pid']))).toEqual(['agent', 'pid']);
  });
});

describe('toggleDone', () => {
  it('adds and removes without mutating or duplicating', () => {
    const a = ['agent'];
    expect(toggleDone(a, 'policy', true)).toEqual(['agent', 'policy']);
    expect(toggleDone(a, 'agent', true)).toEqual(['agent']);
    expect(toggleDone(a, 'agent', false)).toEqual([]);
    expect(toggleDone(a, 'ghost', false)).toEqual(['agent']);
    expect(a).toEqual(['agent']);
  });
});

describe('trackProgress', () => {
  it('counts only live lessons that exist', () => {
    // 'ghost' was removed, 'sarsa' is soon: neither counts
    expect(trackProgress(['agent', 'ghost', 'sarsa'], rl)).toEqual({ done: 1, live: 7, soon: 12, total: 19, complete: false });
  });
  it('is complete when every live lesson is done', () => {
    expect(trackProgress(ALL_LIVE_IDS, rl).complete).toBe(true);
    expect(trackProgress([], rl).complete).toBe(false);
  });
});

describe('nextLesson and continueTarget', () => {
  it('nextLesson is the first live lesson not done, skipping soon ones', () => {
    expect(nextLesson([], rl).id).toBe('agent');
    expect(nextLesson(['agent', 'policy'], rl).id).toBe('state-action-reward');
    expect(nextLesson(['agent', 'state-action-reward', 'return', 'policy', 'value', 'mdp'], rl).id).toBe('reward-design');
    expect(nextLesson(ALL_LIVE_IDS, rl)).toBeNull();
  });
  it('a stale or soon id never moves Continue', () => {
    expect(nextLesson(['ghost', 'sarsa'], rl).id).toBe('agent');
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
    expect(c.lesson.id).toBe('agent');
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
    expect(saveProgress(['agent'], throwing)).toBe(false);
    expect(loadProgress(undefined)).toEqual([]);
    expect(saveProgress(['agent'], undefined)).toBe(false);
    expect(loadProgress(null)).toEqual([]);
  });
  it('treats garbage in storage as no progress', () => {
    for (const raw of ['x', '{}', '[1,null]', '["agent"']) {
      expect(loadProgress(memory({ [PROGRESS_KEY]: raw }))).toEqual([]);
    }
  });
  it('saves and loads under na-progress-v1', () => {
    const s = memory();
    expect(PROGRESS_KEY).toBe('na-progress-v1');
    expect(saveProgress(['agent', 'pid'], s)).toBe(true);
    expect(s.data['na-progress-v1']).toBe('["agent","pid"]');
    expect(loadProgress(s)).toEqual(['agent', 'pid']);
  });
});
