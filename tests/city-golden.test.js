import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadWorld, rewardsOf } from '../games/city/sim.js';
import { HYPER } from '../games/city/presets.js';
import { createAgent, trainEpisodes, greedyRoute } from '../games/city/train.js';

// FNV-1a over the Q-table bytes: any change to learning behaviour changes it.
function hash(f64) {
  const b = new Uint8Array(f64.buffer, f64.byteOffset, f64.byteLength);
  let h = 0x811c9dc5;
  for (let i = 0; i < b.length; i++) { h ^= b[i]; h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16);
}

const CITY = JSON.parse(readFileSync(new URL('../games/city/chicago.json', import.meta.url), 'utf8'));
// Re-captured on purpose for RV1b (solid trees, the bridge, footbridge and rail rules, the Columbus cut, the slip-road and footbridge fixes, the Michigan Avenue to State and Van Buren trip and its tuned EPISODES, HYPER and STEP_CAP).
const GOLDEN = { q: "bc6e1368", visits: "ea984ef7", len: 250, route: "72dbf91a" };

describe('golden training run', () => {
  it('seed 1, 1500 episodes: same Q-table and same greedy route as before the efficiency change', () => {
    const rewards = rewardsOf({ off: 20, red: 20 });
    const agent = trainEpisodes(createAgent(loadWorld(CITY), 1), rewards, 1500, HYPER);
    const route = greedyRoute(agent, rewards);
    expect({
      q: hash(agent.q.v),
      visits: hash(Float64Array.from(agent.visits)),
      len: route.actions.length,
      route: hash(Float64Array.from(route.cells)),
    }).toEqual(GOLDEN);
  });
});
