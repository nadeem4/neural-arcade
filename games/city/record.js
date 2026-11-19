// Pure helpers for ?record=1 frame-stepped capture.
import { PRESETS } from './presets.js';
import { SWOOP_MS, PULLBACK_MS } from './director.js';
import { endCardModel } from './endcard.js';
import { TAG_LIFE_MS } from './events.js';

// Parse the query string. Returns null when not recording, else { card, fps, cam, endcard, maxms } (cam: default, map or auto; endcard: hold the end card; maxms: cut the drive to its first n ms, or null).
export function parseRecord(search) {
  const q = new URLSearchParams(search);
  if (q.get('record') !== '1') return null;
  const card = q.get('card');
  if (!card) throw new Error('record mode needs ?card=<id>');
  if (!PRESETS.some(p => p.id === card)) throw new Error(`unknown card: ${card}`);
  const fps = q.has('fps') ? Number(q.get('fps')) : 30;
  if (!(fps > 0)) throw new Error(`bad fps: ${q.get('fps')}`);
  const cam = q.get('cam') ?? 'default';
  if (!['default', 'map', 'auto'].includes(cam)) throw new Error(`bad cam: ${cam}`);
  const endcard = q.has('endcard') ? q.get('endcard') === '1' : false;
  if (q.has('endcard') && !endcard) throw new Error(`bad endcard: ${q.get('endcard')} (use endcard=1)`);
  const maxms = q.has('maxms') ? Number(q.get('maxms')) : null;
  if (q.has('maxms') && !(maxms > 0 && Number.isFinite(maxms))) throw new Error(`bad maxms: ${q.get('maxms')}`);
  return { card, fps, cam, endcard, maxms };
}

// The rewards of a preset card, as a fresh object.
export const cardRewards = (id) => ({ ...PRESETS.find(p => p.id === id).rewards });

// How long the end card is held after the pullback (endcard=1).
export const ENDCARD_MS = 4000;

// Whole trip: the (maybe cut, maxMs) drive plus the intro swoop and outro pullback, plus the end card hold if asked.
export const tripMs = (trackTotalMs, { maxMs = null, endcard = false } = {}) =>
  Math.min(trackTotalMs, maxMs ?? Infinity) + SWOOP_MS + PULLBACK_MS + (endcard ? ENDCARD_MS : 0);

// The offences that happen inside a drive cut to driveMs (offence times are on the seek clock, swoop first). The rest still count in the summary.
export const offencesWithin = (offences, driveMs) => offences.filter(o => o.ms <= SWOOP_MS + driveMs);

export const frameCount = (totalMs, fps) => Math.floor((totalMs * fps) / 1000) + 1;

export const frameMs = (i, fps) => (i * 1000) / fps;

// Keep tags younger than lifeMs (the game's tag lifetime, events.js TAG_LIFE_MS).
export const pruneTags = (tags, nowMs, lifeMs = TAG_LIFE_MS) => tags.filter(t => nowMs - t.born < lifeMs);

// What the run was, for window.__rc.summary: the end card's figures plus the offence timeline (seek clock). Full-trip numbers.
export function runSummary({ card, rewards, analysis, scared, offences, goalSeconds }) {
  const m = endCardModel(rewards, analysis, goalSeconds, null, scared);
  return {
    card, seconds: analysis.seconds, pay: m.earned, cityScore: m.city, legal: m.legal, onTime: m.timeOk,
    offences: { offTiles: analysis.offTiles, red: analysis.redRuns, wrong: analysis.wrongWays, scared },
    events: offences.map(({ ms, type, label }) => ({ ms, type, label })),
  };
}

// The window.__rc object the capture script drives. totalMs is set once the trip is built.
export function recordApi({ stage, totalMs = 0, fps = 30 }) {
  return {
    totalMs, fps, failure: null, summary: null,
    get error() {
      if (this.failure) return this.failure;
      if (!stage.ready) return 'record mode needs WebGL';
      return null;
    },
    get ready() { return this.error === null && this.totalMs > 0; },
    seek(ms) { stage.renderAt(ms); },
  };
}
