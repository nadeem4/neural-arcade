import { isLegal, goalReached } from './words.js';
import { FIELDS } from './reward.js';

// Names for kept taxis, from which fines are zero on the rate card. Pure.
const STRIPES = {
  'Anything goes': '#FF9A6B',
  'Red runner': '#FF6B6B',
  'Park cutter': '#FFB547',
  'Wrong-way driver': '#B79CFF',
  'By the book': '#8FE3A1',
};

// First match wins: all three fines zero, then red, then park/footpath, then wrong way.
export function nameFor(rewards) {
  const { off, red, wrong } = rewards;
  if (!off && !red && !wrong) return 'Anything goes';
  if (!red) return 'Red runner';
  if (!off) return 'Park cutter';
  if (!wrong) return 'Wrong-way driver';
  return 'By the book';
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
    a.offTiles && plural(a.offTiles, 'park tile'),
    a.redRuns && plural(a.redRuns, 'red run'),
    a.wrongWays && plural(a.wrongWays, 'wrong-way move'),
  ].filter(Boolean).join(', ');
}

const CHIPS = FIELDS.map(f => [f.key, f.chip, f.sign === '-' ? '−' : '+']);

// The rate chips on a card: only the rates that are not zero.
export const rateChips = rewards => CHIPS.filter(([k]) => rewards[k]).map(([k, label, sign]) => `${label} ${sign}${rewards[k]}`);
