// The rate card's pure logic: stepping a rate with the - and + buttons, and the six display rows.
import { RANGES } from './presets.js';
import { FIELDS } from './reward.js';

const clean = n => Math.round(n * 100) / 100;

// The next value for `field` one step in `dir` (+1 or -1), kept inside its range.
export function stepRate(field, value, dir) {
  const { min, max, step } = RANGES[field];
  return Math.min(max, Math.max(min, clean(value + (dir < 0 ? -step : step))));
}

// One row per field, in FIELDS order. text carries the sign; tone picks the colour (zero grey, fine orange, pay green).
export function rateRows(rewards) {
  return FIELDS.map(f => {
    const value = rewards[f.key];
    const { min, max } = RANGES[f.key];
    const text = value === 0 ? '0' : (f.sign === '-' ? '−' : '+') + value;
    return { key: f.key, label: f.label, value, text, tone: value === 0 ? 'zero' : f.sign === '-' ? 'fine' : 'pay', canDec: value > min, canInc: value < max };
  });
}
