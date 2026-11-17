// What happens on each step of a trip, from the same stepWorld calls analyzeRoute makes. Pure, no DOM.
// Every drive screen (meter, tags, minimap, sound) reads this and never re-runs the sim.
import { stepWorld } from './sim.js';

const PARK = 2;

// steps[i]: { i, tick, from, cell, moved, off, park, red, wrong, done, delta, lines }.
// `lines` names the receipt lines that fired: time, off, red, wrong, perTile, fare.
// totals is the analyzeRoute result, so it equals the receipt's numbers.
export function tripEvents(world, rewards, route) {
  const totals = { arrived: false, seconds: 0, tiles: 0, offTiles: 0, parkTiles: 0, redRuns: 0, wrongWays: 0, reward: 0 };
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
    totals.seconds++;
    totals.reward += s.r;
    if (s.moved) totals.tiles++;
    if (s.off) totals.offTiles++;
    if (park) totals.parkTiles++;
    if (s.red) totals.redRuns++;
    if (s.wrong) totals.wrongWays++;
    if (s.done) { totals.arrived = true; break; }
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
