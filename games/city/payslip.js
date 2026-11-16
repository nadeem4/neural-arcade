// Pure pay-slip state for Reward City: the six lines, which try card a slip matches, and the try count.
import { PRESETS } from './presets.js';
import { isLegal } from './words.js';

export const FIELDS = [
  { key: 'fare', label: 'Fare for arriving', sign: '+' },
  { key: 'time', label: 'Cost per second', sign: '-' },
  { key: 'off', label: 'Fine per park or footpath tile', sign: '-' },
  { key: 'red', label: 'Fine per red light run', sign: '-' },
  { key: 'wrong', label: 'Fine per wrong-way move', sign: '-' },
  { key: 'perTile', label: 'Pay per tile driven', sign: '+' },
];

// The id of the try card whose pay slip equals these rewards exactly, or null.
export function cardMatching(rewards) {
  const p = PRESETS.find(p => FIELDS.every(f => p.rewards[f.key] === rewards[f.key]));
  return p ? p.id : null;
}

export const createSession = () => ({ tries: 0, best: null });

// One more try; best is the fastest legal trip so far.
export function recordTry(session, analysis) {
  const better = isLegal(analysis) && (!session.best || analysis.seconds < session.best.seconds);
  return { tries: session.tries + 1, best: better ? analysis : session.best };
}
