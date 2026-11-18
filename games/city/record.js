// Pure helpers for ?record=1 frame-stepped capture.
import { PRESETS } from './presets.js';
import { motionAllowed } from './playback.js';
import { SWOOP_MS, PULLBACK_MS } from './director.js';

// Parse the query string. Returns null when not recording, else { card, fps }.
export function parseRecord(search) {
  const q = new URLSearchParams(search);
  if (q.get('record') !== '1') return null;
  const card = q.get('card');
  if (!card) throw new Error('record mode needs ?card=<id>');
  if (!PRESETS.some(p => p.id === card)) throw new Error(`unknown card: ${card}`);
  const fps = q.has('fps') ? Number(q.get('fps')) : 30;
  if (!(fps > 0)) throw new Error(`bad fps: ${q.get('fps')}`);
  return { card, fps };
}

// The rewards of a preset card, as a fresh object.
export const cardRewards = (id) => ({ ...PRESETS.find(p => p.id === id).rewards });

// Whole trip: the track plus the intro swoop and outro pullback.
export const tripMs = (trackTotalMs) => trackTotalMs + SWOOP_MS + PULLBACK_MS;

export const frameCount = (totalMs, fps) => Math.floor((totalMs * fps) / 1000) + 1;

export const frameMs = (i, fps) => (i * 1000) / fps;

// Keep tags younger than lifeMs (the game's tag lifetime in main.js popTag).
export const pruneTags = (tags, nowMs, lifeMs = 1400) => tags.filter(t => nowMs - t.born < lifeMs);

// The window.__rc object the capture script drives. totalMs is set once the trip is built.
export function recordApi({ stage, totalMs = 0, fps = 30 }) {
  return {
    totalMs, fps, failure: null,
    get error() {
      if (this.failure) return this.failure;
      if (!stage.ready) return 'record mode needs WebGL';
      if (!motionAllowed()) return 'record mode does not work under reduced motion';
      return null;
    },
    get ready() { return this.error === null && this.totalMs > 0; },
    seek(ms) { stage.renderAt(ms); },
  };
}
