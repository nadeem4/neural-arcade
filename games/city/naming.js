import { isLegal, goalReached } from './words.js';
import { FIELDS } from './reward.js';

// Names for kept taxis, from what the trip did (its analysis), not from the rates. Pure.
const STRIPES = {
  'No-show': '#9AA7B8',
  'Circler': '#FF9A6B',
  'Park cutter': '#FFB547',
  'Footpath rider': '#E6D24A',
  'Red runner': '#FF6B6B',
  'Wrong-way driver': '#B79CFF',
  'By the book': '#8FE3A1',
};

// First match wins: never arrived (a circler if most seconds were moves), park, footpath, red, wrong way, else legal.
export function nameFor(a) {
  if (!a.arrived) return a.seconds > 0 && a.tiles >= a.seconds / 2 ? 'Circler' : 'No-show';
  if (a.parkTiles > 0) return 'Park cutter';
  if (a.offTiles > 0) return 'Footpath rider';
  if (a.redRuns > 0) return 'Red runner';
  if (a.wrongWays > 0) return 'Wrong-way driver';
  return 'By the book';
}

// Names a garage's taxis from their stored analysis (garages saved before this carry the old rate-card names).
// Taxis are newest first; the oldest of a repeated name keeps it plain, the later ones get 2, 3.
export function behaviourNames(taxis) {
  const names = [];
  for (const t of [...taxis].reverse()) names.unshift(uniqueName(nameFor(t.analysis), names));
  return taxis.map((t, i) => ({ ...t, name: names[i] }));
}

// A name already in the garage gets " 2", " 3" and so on.
export function uniqueName(name, taken) {
  if (!taken.includes(name)) return name;
  let n = 2;
  while (taken.includes(`${name} ${n}`)) n++;
  return `${name} ${n}`;
}

// The card's colour stripe: by the name without its number.
export const stripeFor = name => STRIPES[name.replace(/ \d+$/, '')] ?? '#5BC0EB';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// The one-line note on a card: what the trip did.
export function noteFor(a) {
  if (!a.arrived) return 'Never arrived';
  if (goalReached(a)) return 'Legal trip: goal met';
  if (isLegal(a)) return 'Legal, but over the goal';
  return [
    a.offTiles && plural(a.offTiles, 'footpath tile'),
    a.redRuns && plural(a.redRuns, 'red light'),
    a.wrongWays && plural(a.wrongWays, 'wrong-way tile'),
  ].filter(Boolean).join(', ');
}

const CHIPS = FIELDS.map(f => [f.key, f.chip, f.sign === '-' ? '−' : '+']);

// The rate chips on a card: only the rates that are not zero.
export const rateChips = rewards => CHIPS.filter(([k]) => rewards[k]).map(([k, label, sign]) => `${label} ${sign}${rewards[k]}`);
