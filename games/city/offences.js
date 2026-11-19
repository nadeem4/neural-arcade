// The offences of one trip as a timeline on the seek(ms) clock. Pure, no DOM.
// Tags, record-mode summary.events and later highlights and cuts all read this, so they cannot disagree.
import { SWOOP_MS } from './director.js';

const NAMES = { off: (park) => (park ? 'park tile' : 'footpath tile'), red: () => 'red light run', wrong: () => 'wrong way' };

// The label of one offence: "-20 footpath tile" when the rate fines it, the bare name when it does not.
export function offenceLabel(type, rate, park = false) {
  const name = NAMES[type](park);
  return rate > 0 ? `-${rate} ${name}` : name;
}

// [{ i, ms, type: 'off'|'red'|'wrong', label, cell, x, z, fine, heading, park }] sorted by ms.
// Step i finishes when hudFrame sees stepIndex > i: SWOOP_MS + (i + 1) * tickMs on the seek clock.
// x, z are where the taxi is then; heading is the move heading plus pi.
export function buildOffences(events, rewards, track, { introMs = SWOOP_MS } = {}) {
  const out = [];
  events.steps.forEach((s, i) => {
    const f = track.frames[i + 1];
    for (const type of ['off', 'red', 'wrong']) {
      if (!s[type]) continue;
      out.push({ i, ms: introMs + (i + 1) * track.tickMs, type, label: offenceLabel(type, rewards[type], s.park), cell: s.cell, x: f.x, z: f.z, fine: rewards[type], heading: f.heading + Math.PI, park: !!s.park });
    }
  });
  return out;
}
