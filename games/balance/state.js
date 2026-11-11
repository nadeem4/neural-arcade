// Small pure helpers for the Balance page: held keys, the training allowance, Wind and a PID dial's markup. No DOM.

// Keys: `held` are directions pressed now, `down` the key codes physically down, `guard` the codes that stay ignored until released.
export const createKeys = () => ({ held: new Set(), down: new Set(), guard: new Set() });

// Returns false (and does nothing) while the code is guarded, so a key held over a try's end cannot start the next one.
export function pressKey(k, dir, code) {
  if (k.guard.has(code)) return false;
  k.held.add(dir); k.down.add(code);
  return true;
}

export function releaseKey(k, dir, code) {
  k.down.delete(code); k.guard.delete(code); k.held.delete(dir);
}

export function clearKeys(k) {
  k.held.clear(); k.down.clear(); k.guard.clear();
}

// A key came up: always forget its code; release its direction when it has one.
export function keyUp(k, dir, code) {
  if (dir) releaseKey(k, dir, code); else { k.down.delete(code); k.guard.delete(code); }
}

export function endTryKeys(k) {
  k.guard = new Set(k.down); k.held.clear();
}

// Generations owed after `steps` more 60 Hz steps at `rate` a second; capped, and none at all when paused.
export const OWED_CAP = 10;
export const owedAfter = (owed, rate, steps, cap = OWED_CAP) => (rate > 0 ? Math.min(owed + (rate * steps) / 60, cap) : 0);

// Wind flips on its own: nothing else in the state changes.
export const toggleWind = s => ({ ...s, wind: !s.wind });

const ICON = '<svg aria-hidden="true"><use href="#i"/></svg>';

// One PID dial. A div, not a label, so the (i) button is not part of the slider's label; the range is named by aria-label.
export function dialHtml(key, r, info) {
  const K = key.toUpperCase();
  return `<div class="dial"><span class="dial-name">${K}<button class="info" type="button" aria-expanded="false" aria-controls="info-${key}" aria-label="Explain ${K}" title="What is this?">${ICON}</button></span>
    <span class="info-text" id="info-${key}" hidden>${info}</span>
    <output id="out-${key}" for="pid-${key}">${r.def}</output>
    <input id="pid-${key}" type="range" min="${r.min}" max="${r.max}" step="${r.step}" value="${r.def}" aria-label="${K} dial">
  </div>`;
}
