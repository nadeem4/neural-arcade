// Pure reward state for Reward City: the six rate card rows, the card Back to step 1 restores, and the try count.
import { DEFAULT_REWARDS } from './presets.js';
import { isLegal } from './words.js';

export const FIELDS = [
  { key: 'fare', label: 'Fare for arriving', sign: '+', chip: 'Fare' },
  { key: 'time', label: 'Cost per second', sign: '-', chip: 'Clock' },
  { key: 'off', label: 'Fine per footpath tile', sign: '-', chip: 'Footpath' },
  { key: 'red', label: 'Fine per red light', sign: '-', chip: 'Red light' },
  { key: 'wrong', label: 'Fine per wrong-way tile', sign: '-', chip: 'Wrong way' },
  { key: 'perTile', label: 'Pay per tile driven', sign: '+', chip: 'Per tile' },
];

export const RATE_KEYS = FIELDS.map(f => f.key);

// A fresh copy of the starting reward: what Reset puts back.
export const defaultRewards = () => ({ ...DEFAULT_REWARDS });

export const createSession = () => ({ tries: 0, best: null });

// One more try; best is the fastest legal trip so far.
export function recordTry(session, analysis) {
  const better = isLegal(analysis) && (!session.best || analysis.seconds < session.best.seconds);
  return { tries: session.tries + 1, best: better ? analysis : session.best };
}
