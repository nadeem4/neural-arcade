// Lesson progress: pure functions over a list of done lesson ids, plus guarded storage. No DOM.
import { TRACKS } from './index.js';

export const PROGRESS_KEY = 'na-progress-v1';

// Unique string ids from saved text; anything else is no progress.
export function parseProgress(raw) {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? [...new Set(v.filter(x => typeof x === 'string'))] : [];
  } catch {
    return [];
  }
}

export const serializeProgress = done => JSON.stringify(done);

export const toggleDone = (done, id, on) =>
  on ? (done.includes(id) ? [...done] : [...done, id]) : done.filter(x => x !== id);

const liveLessons = track => track.parts.flatMap(p => p.lessons).filter(l => l.status === 'live');

// Only live lessons that exist count; a stale or soon id in `done` is ignored.
export function trackProgress(done, track) {
  const all = track.parts.flatMap(p => p.lessons);
  const live = liveLessons(track);
  const count = live.filter(l => done.includes(l.id)).length;
  return { done: count, live: live.length, soon: all.length - live.length, total: all.length, complete: live.length > 0 && count === live.length };
}

export const nextLesson = (done, track) => liveLessons(track).find(l => !done.includes(l.id)) ?? null;

export function continueTarget(done, tracks = TRACKS) {
  const first = !tracks.some(t => liveLessons(t).some(l => done.includes(l.id)));
  for (const track of tracks) {
    const lesson = nextLesson(done, track);
    if (lesson) return { track, lesson, first };
  }
  return null;
}

const storageOrNull = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };

export function loadProgress(storage = storageOrNull()) {
  try {
    return parseProgress(storage.getItem(PROGRESS_KEY));
  } catch {
    return [];
  }
}

export function saveProgress(done, storage = storageOrNull()) {
  try {
    storage.setItem(PROGRESS_KEY, serializeProgress(done));
    return true;
  } catch {
    return false;
  }
}
