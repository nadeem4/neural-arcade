// What the page says about tries, sliders and loopholes.
import { PRESETS, RULES } from './sim.js';

const farmed = t => t.outcome === 'timeout' && t.coins >= 8;
const stayed = t => t.outcome === 'timeout' && !farmed(t) && (t.maxX ?? t.g?.maxX) < 3;

// One line about how a try ended, for the caption on the level.
export function tryNote(run, n) {
  const t = { outcome: run.outcome, coins: run.coins, maxX: run.g.maxX };
  const what = t.outcome === 'finished' ? 'reached the flag'
    : t.outcome === 'died' ? 'died'
    : farmed(t) ? `farmed the coin block until time ran out (${t.coins} coins)`
    : stayed(t) ? 'stayed put until time ran out' : 'ran out of time';
  return `Try ${n}: ${what}. Score ${run.score.toFixed(1)}`;
}

export function ruleValue(key, v) {
  if (key === 'second') return v < 0 ? `costs ${-v}` : v > 0 ? `earns ${v}` : 'nothing';
  return v === 0 ? 'nothing' : `${v} point${v === 1 ? '' : 's'}`;
}

export function matchPreset(rules) {
  for (const [key, p] of Object.entries(PRESETS)) if (Object.keys(RULES).every(k => p.rules[k] === rules[k])) return key;
  return null;
}

// Once most of the last 50 tries exploit a loophole, say so in plain words, then name it.
export function loopholeNote(history) {
  if (history.length < 50) return '';
  const last = history.slice(-50), share = f => last.filter(f).length / last.length;
  if (share(farmed) >= 0.6) return 'It is farming the coin block instead of finishing. Your rules pay more for coins than for the flag, so this is the best plan they allow. It found a loophole in your rules: that is called reward hacking.';
  if (share(stayed) >= 0.6) return 'It is standing still until time runs out. Your rules punish dying and pay for staying alive, so never moving is the safest plan. It found a loophole in your rules: that is called reward hacking.';
  return '';
}
