// What the page says about the cart, the PID dials and the AI, in plain words. No DOM.
import { F_MAX, LIMIT, seconds } from './sim.js';

const side = (v, l, r) => (v > 0 ? r : l);

// One line per brain input (0 cart position, 1 cart speed, 2 pole angle, 3 pole spin); v is -1..1, positive right.
export function describeInput(i, v) {
  const a = Math.abs(v);
  if (i === 0) return a < 0.1 ? 'centred' : side(v, 'left of centre', 'right of centre');
  if (i === 1) return a < 0.05 ? 'still' : side(v, 'moving left', 'moving right');
  if (i === 2) return a < 0.05 ? 'upright' : side(v, 'leaning left', 'leaning right');
  return a < 0.05 ? 'steady' : side(v, 'tipping left', 'tipping right');
}

export function describeOutput(k, v) {
  return Math.abs(v) < 0.05 ? 'not pushing' : `pushing ${side(v, 'left', 'right')} ${Math.round(Math.abs(v) * F_MAX)} N`;
}

// How a try ended, in words; empty while it is still running.
export function fallNote(run) {
  if (run.outcome === 'limit') return `Stayed up the full ${LIMIT / 60} s.`;
  if (run.reason === 'tilt') return `The pole fell after ${seconds(run).toFixed(1)} s.`;
  if (run.reason === 'rail') return `The cart hit the end of the rail after ${seconds(run).toFixed(1)} s.`;
  return '';
}

export const tryNote = (who, run) => `${who}: ${fallNote(run)}`;

// A hint under the PID dials; the first rule that matches wins.
export function pidHint({ p, i, d }, wind) {
  if (p === 0) return 'With no P the pole just falls. Raise P to push against the lean.';
  if (p < 15) return 'P is too weak to catch the pole in time.';
  if (d === 0) return 'Without D the cart will wobble. Raise D to calm the swing.';
  if (wind && i === 0) return 'The wind leaves the cart parked off-centre. Raise I to bring it back.';
  if (i > 0 && !wind) return 'I only matters when something keeps pushing: turn Wind on to see it.';
  return 'The pole settles: P, I and D are doing their jobs.';
}

export const DIAL_INFO = {
  p: 'P pushes against the lean, in proportion to how far the pole has tipped.',
  i: 'I adds up a lean that lasts, so it removes a steady error such as the cart drifting off-centre.',
  d: 'D reacts to how fast the pole is tipping, which calms the swing.',
};

// 1-based generation of the first best try that lasted the full time, or -1.
export function firstFullGeneration(history) {
  const k = history.findIndex(s => s >= LIMIT / 60);
  return k < 0 ? -1 : k + 1;
}

export function aiNote(history) {
  if (!history.length) return 'No generation yet: this brain is still random.';
  const g = firstFullGeneration(history);
  const base = `Generation ${history.length}: its best brain stayed up ${history[history.length - 1].toFixed(1)} s.`;
  return g === -1 ? base : `${base} It first held the full ${LIMIT / 60} s in generation ${g}.`;
}

const MODES = {
  you: 'You: arrow keys or A and D, or the buttons on a touch screen.',
  pid: 'PID: three dials drive the cart.',
  ai: 'AI: a tiny network that learns by evolution.',
};
export const modeLine = mode => MODES[mode];
