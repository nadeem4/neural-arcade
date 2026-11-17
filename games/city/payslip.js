// Pure reward state for Reward City: the six sliders, the defaults Reset restores, and the try count.
import { DEFAULT_REWARDS } from './presets.js';
import { isLegal } from './words.js';

export const FIELDS = [
  { key: 'fare', label: 'Fare for arriving', sign: '+' },
  { key: 'time', label: 'Cost per second', sign: '-' },
  { key: 'off', label: 'Fine per park or footpath tile', sign: '-' },
  { key: 'red', label: 'Fine per red light run', sign: '-' },
  { key: 'wrong', label: 'Fine per wrong-way move', sign: '-' },
  { key: 'perTile', label: 'Pay per tile driven', sign: '+' },
];

// A fresh copy of the starting reward: what Reset puts back.
export const defaultRewards = () => ({ ...DEFAULT_REWARDS });

export const createSession = () => ({ tries: 0, best: null });

// One more try; best is the fastest legal trip so far.
export function recordTry(session, analysis) {
  const better = isLegal(analysis) && (!session.best || analysis.seconds < session.best.seconds);
  return { tries: session.tries + 1, best: better ? analysis : session.best };
}
