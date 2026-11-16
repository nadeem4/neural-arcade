// The write-up's figures come from a real, seeded run on the real map, recorded once into story.json:
//   node games/city/story-data.js
// A test re-records it and checks story.json still matches, so the pictures can't drift from the code.
import { readFileSync } from 'node:fs';
import { loadWorld, analyzeRoute } from './sim.js';
import { createAgent, trainEpisodes, greedyRoute } from './train.js';
import { PRESETS, EPISODES, HYPER } from './presets.js';
import { buildReceipt, verdictOf } from './receipt.js';

export const STORY_SEED = 1;
const SNAPSHOTS = [1, 10, 100, EPISODES];
const city = JSON.parse(readFileSync(new URL('./chicago.json', import.meta.url), 'utf8'));

// Visits become digits 0-9 on a log scale: 0 is never visited, 9 is the busiest cell.
function heatDigits(visits) {
  let max = 0;
  for (const v of visits) if (v > max) max = v;
  const top = Math.log(max + 1);
  let s = '';
  for (const v of visits) s += v === 0 ? '0' : String(Math.min(9, 1 + Math.floor(8 * Math.log(v + 1) / top)));
  return s;
}

export function recordStory(seed = STORY_SEED) {
  const world = loadWorld(city);
  const heat = [];
  const cards = PRESETS.map((p, i) => {
    const agent = createAgent(world, seed);
    for (const ep of i === 0 ? SNAPSHOTS : [EPISODES]) {
      trainEpisodes(agent, p.rewards, ep - agent.episodes, HYPER);
      if (i === 0) heat.push(heatDigits(agent.visits));
    }
    const route = greedyRoute(agent, p.rewards);
    const analysis = analyzeRoute(world, route, p.rewards);
    return { id: p.id, rewards: p.rewards, route, analysis, receipt: buildReceipt(p.rewards, analysis), verdict: verdictOf(p.rewards, analysis) };
  });
  const { cols, rows, kind, oneway, signals, pickup, dropoff } = city;
  return { seed, map: { cols, rows, kind, oneway, signals, pickup, dropoff }, cards, learning: { episodes: SNAPSHOTS, heat } };
}

if (typeof process !== 'undefined' && import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/').replace(/^(?!\/)/, '/')}`) {
  const fs = await import('node:fs');
  fs.writeFileSync(new URL('./story.json', import.meta.url), JSON.stringify(recordStory()));
  console.log('story.json written');
}
