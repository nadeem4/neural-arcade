// What happens on each step of a trip, from the same stepWorld calls analyzeRoute makes. Pure, no DOM.
// Every drive screen (meter, tags, minimap, sound) reads this and never re-runs the sim.
import { stepWorld, tally, newTotals } from './sim.js';

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

// The floating tags for one step: fines in orange, the fare in green. Time and pay per tile are too frequent to tag.
export function tagsFor(step, rewards) {
  const tags = [];
  const fine = (rate, name) => tags.push({ text: rate > 0 ? `-${rate} ${name}` : name, kind: 'fine' });
  if (step.off) fine(rewards.off, step.park ? 'park tile' : 'footpath tile');
  if (step.red) fine(rewards.red, 'red light run');
  if (step.wrong) fine(rewards.wrong, 'wrong way');
  if (step.done) tags.push({ text: `+${rewards.fare} fare`, kind: 'pay' });
  return tags;
}

// Folds a tag into the run before it: the same text on the very next step adds to a count instead of stacking a second tag.
// prev is the last result (or null); i is the step index. Returns { text, kind, count, i, label }.
export function foldTag(prev, tag, i) {
  const count = prev && prev.text === tag.text && i - prev.i <= 1 ? prev.count + 1 : 1;
  return { text: tag.text, kind: tag.kind, count, i, label: count > 1 ? `${tag.text} ×${count}` : tag.text };
}
