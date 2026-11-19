// The offences of one trip as a timeline on the seek(ms) clock. Pure, no DOM.
// Tags, record-mode summary.events and later highlights and cuts all read this, so they cannot disagree.
import { SWOOP_MS } from './director.js';

const NAMES = { off: (park) => (park ? 'park tile' : 'footpath tile'), red: () => 'red light run', wrong: () => 'wrong way' };
const FREE = { red: 'red light' }; // the free label drops "run"

// The label of one offence: "-20 footpath tile" when the rate fines it, "footpath tile: free" when it does not.
export function offenceLabel(type, rate, park = false) {
  const name = NAMES[type](park);
  return rate > 0 ? `-${rate} ${name}` : `${FREE[type] ?? name}: free`;
}

// [{ i, ms, type: 'off'|'red'|'wrong', label, cell, x, z, fine, heading, park }] sorted by ms.
// Step i finishes when hudFrame sees stepIndex > i: SWOOP_MS + (i + 1) * tickMs on the seek clock.
// x, z are where the taxi is then; heading is the move heading plus pi. ax, az, acell are where a wrong-way arrow is drawn (needs opts.world).
export function buildOffences(events, rewards, track, { introMs = SWOOP_MS, world } = {}) {
  const out = [];
  events.steps.forEach((s, i) => {
    const f = track.frames[i + 1];
    for (const type of ['off', 'red', 'wrong']) {
      if (!s[type]) continue;
      // The wrong-way arrow is drawn one tile on when the taxi keeps its heading onto a road cell with the same one-way (never into a building or across a junction), else at the spot.
      const n = track.frames[i + 2], nc = events.steps[i + 1]?.cell;
      const ahead = type === 'wrong' && world && n && n.heading === f.heading && nc !== undefined && world.kind[nc] === 0 && world.oneway[nc] === world.oneway[s.cell];
      out.push({ i, ms: introMs + (i + 1) * track.tickMs, type, label: offenceLabel(type, rewards[type], s.park), cell: s.cell, x: f.x, z: f.z, ax: ahead ? n.x : f.x, az: ahead ? n.z : f.z, acell: ahead ? nc : s.cell, fine: rewards[type], heading: f.heading + Math.PI, park: !!s.park });
    }
  });
  return out;
}
