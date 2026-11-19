// What happens on each step of a trip, from the same stepWorld calls analyzeRoute makes. Pure, no DOM.
// Every drive screen (meter, tags, minimap, sound) reads this and never re-runs the sim.
import { stepWorld, tally, newTotals } from './sim.js';
import { offenceLabel } from './offences.js';

const PARK = 2;

// steps[i]: { i, tick, from, cell, moved, off, park, red, wrong, done, delta, lines }.
// `lines` names the receipt lines that fired: time, off, red, wrong, perTile, fare.
// totals is the analyzeRoute result, so it equals the receipt's numbers.
export function tripEvents(world, rewards, route) {
  const totals = newTotals();
  const steps = [];
  let cell = route.cells[0];
  for (let t = 0; t < route.actions.length; t++) {
    const s = stepWorld(world, rewards, cell, t, route.actions[t]);
    const park = s.moved && world.kind[s.cell2] === PARK;
    const lines = [];
    if (rewards.time) lines.push('time');
    if (s.off && rewards.off) lines.push('off');
    if (s.red && rewards.red) lines.push('red');
    if (s.wrong && rewards.wrong) lines.push('wrong');
    if (s.moved && rewards.perTile) lines.push('perTile');
    if (s.done) lines.push('fare');
    steps.push({ i: t, tick: t, from: cell, cell: s.cell2, moved: s.moved, off: s.off, park, red: s.red, wrong: s.wrong, done: s.done, delta: s.r, lines });
    cell = s.cell2;
    tally(world, totals, s);
    if (s.done) break;
  }
  return { steps, totals };
}

// The floating tags for one step: fines in orange, the fare in green, and "scared N" when the taxi frightened N people (people.js).
// Time and pay per tile are too frequent to tag.
export function tagsFor(step, rewards, scared = 0) {
  const tags = [];
  for (const type of ['off', 'red', 'wrong']) if (step[type]) tags.push({ text: offenceLabel(type, rewards[type], step.park), kind: 'fine' });
  if (scared) tags.push({ text: `scared ${scared}`, kind: 'fine' });
  if (step.done) tags.push({ text: `+${rewards.fare} fare`, kind: 'pay' });
  return tags;
}

// Folds a tag into the bubble of the same words that is still on screen (live): it adds to a count instead of stacking a second tag.
// prev is the last result for this text (or null); live says its bubble is still up; i is the step index. Returns { text, kind, count, i, label }.
export function foldTag(prev, tag, i, live = false) {
  const count = prev && live && prev.text === tag.text ? prev.count + 1 : 1;
  return { text: tag.text, kind: tag.kind, count, i, label: count > 1 ? `${tag.text} ×${count}` : tag.text };
}

// Floating tags sit in fixed vertical slots above the taxi, one tag height apart, so two live tags never overlap each other
// (or the taxi: slot 0 is already above it). `tags` is the live tags: each { slot } keeps its slot, one without a slot takes
// the lowest free one. There are at most MAX_TAG_SLOTS: when all are taken, a newcomer reuses the slot of the oldest live
// tag (the first in the list; that one is dropped by the caller). Returns new objects. Pure.
export const TAG_SLOT_PX = 46;
export const TAG_LIFE_MS = 1700; // how long a tag stays up (real time in the game, seek time in record mode)
export const MAX_TAG_SLOTS = 3;
export function layoutTags(tags) {
  const used = new Set(tags.filter((t) => t.slot !== undefined).map((t) => t.slot));
  const oldest = tags.filter((t) => t.slot !== undefined).map((t) => t.slot); // oldest first
  return tags.map((t) => {
    if (t.slot !== undefined) return { ...t };
    let slot = 0;
    while (used.has(slot) && slot < MAX_TAG_SLOTS) slot++;
    if (slot >= MAX_TAG_SLOTS) { slot = oldest.shift() ?? 0; oldest.push(slot); } // full: the oldest gives way
    used.add(slot);
    return { ...t, slot };
  });
}

// Where a tag's anchor goes, in the label layer's pixels. The tag is drawn about 1.5 tag heights above its anchor.
// Desktop: above the taxi, one slot higher per tag. Phone (phone: true): the taxi's anchor is under the meters, so the tags
// sit just below them and grow downward; when `at` carries the taxi's screen box (at.top, at.bottom) a tag that would come within 8 px of the taxi's roof goes below the taxi instead. Either way the tag stays inside the screen sideways. Pure.
// With `height` (the label layer's height) the tag also stays inside the screen vertically, for the overhead shots where the taxi can be
// anywhere: a tag that would rise off the top goes below the taxi instead; clear (px, the drawn taxi's half length) keeps it off the taxi either way (one slot lower per tag), and none is lower than the bottom edge.
export function tagPlace(at, slot, { width, tagW, tagH, phone = false, meterBottom = 0, height = null, clear = 0 }) {
  const half = tagW / 2 + 4;
  const left = Math.min(Math.max(at.x, half), Math.max(half, width - half));
  let top = phone ? meterBottom + 8 + 1.5 * tagH + slot * TAG_SLOT_PX : at.y - clear - slot * TAG_SLOT_PX;
  if (phone && at.top !== undefined) { // the drawn tag runs from top - 1.5 tagH to top - 0.5 tagH: keep it 8 px off the taxi's screen box (at.top to at.bottom), else put it below the taxi
    const band = (s) => meterBottom + 8 + 1.5 * tagH + s * TAG_SLOT_PX; // the stack under the meters
    const hits = (s) => band(s) - 0.5 * tagH > at.top - 8; // that slot of the band would come within 8 px of the roof
    // Below the taxi, one slot lower per tag; near the bottom edge the whole stack moves up together, so its slots never squash onto each other.
    const lift = height === null ? 0 : Math.max(0, at.bottom + 8 + 1.5 * tagH + (MAX_TAG_SLOTS - 1) * TAG_SLOT_PX - (height - 4));
    const below = (s) => at.bottom + 8 + 1.5 * tagH + s * TAG_SLOT_PX - lift;
    // A slot that cannot sit below clear of the taxi falls back to the band, covering the roof rather than the meters. If any slot that has to
    // move falls back, they all do, so the tags are one stack (the band) or two stacks on either side of the taxi, never one tag over another.
    const fallback = Array.from({ length: MAX_TAG_SLOTS }, (_, s) => s).some((s) => hits(s) && below(s) - 1.5 * tagH < at.bottom + 8);
    if (hits(slot)) top = fallback ? Math.min(band(slot), height === null ? Infinity : height - 4) : below(slot);
  }
  if (height !== null && !phone) {
    if (top - 1.5 * tagH < 0) top = at.y + clear + 1.5 * tagH + 4 + slot * TAG_SLOT_PX; // below the taxi, clear of it
    top = Math.min(Math.max(top, 1.5 * tagH + 4), height - 4);
  }
  return { left, top };
}
