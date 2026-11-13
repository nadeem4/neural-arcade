// The write-up's figures come from real, seeded runs, recorded once into story.json:
//   node games/maze/story-data.js
// A test re-records them and checks story.json still matches, so the pictures can't drift from the code.
import { MAPS, createAgent, runEpisode, trainEpisodes, greedyWalk, policyGrid, valueGrid } from './sim.js';

export const STORY_SEED = 1;
const SNAPSHOTS = [1, 5, 20, 100, 3000];
const ALPHA = 0.5, GAMMA = 0.9, EPS = 0.5;
const CLIFF_EPISODES = 500;
const r4 = v => Math.round(v * 1e4) / 1e4 + 0;   // + 0 turns -0 into 0, which JSON would lose

function spread(seed) {
  const agent = createAgent('near-or-far', seed), params = { alpha: ALPHA, gamma: GAMMA, epsilon: EPS };
  const snapshots = [];
  for (const episode of SNAPSHOTS) {
    trainEpisodes(agent, episode - agent.episodes, params);
    snapshots.push({ episode, values: valueGrid(agent).map(r4) });
  }
  return { map: 'near-or-far', gamma: GAMMA, snapshots };
}

// Train with one discount, then walk greedily from the start.
function discounted(seed, gamma) {
  const agent = trainEpisodes(createAgent('near-or-far', seed), 3000, { alpha: ALPHA, gamma, epsilon: EPS });
  const { path, outcome } = greedyWalk(agent);
  return { gamma, policy: policyGrid(agent), path, outcome };
}

// Train on the cliff while exploring at one rate; count the falls and the average reward.
function cliffRun(seed, epsilon) {
  const agent = createAgent('cliff-edge', seed);
  let pits = 0;
  for (let i = 0; i < CLIFF_EPISODES; i++) if (runEpisode(agent, { alpha: ALPHA, gamma: GAMMA, epsilon }).outcome === 'pit') pits++;
  const meanReward = agent.history.reduce((a, b) => a + b, 0) / CLIFF_EPISODES;
  return { epsilon, pits, meanReward: r4(meanReward) };
}

export function recordStory(seed = STORY_SEED) {
  return {
    seed,
    maps: { 'near-or-far': MAPS['near-or-far'].rows, 'cliff-edge': MAPS['cliff-edge'].rows },
    spread: spread(seed),
    discount: { low: discounted(seed, 0.5), high: discounted(seed, 0.95) },
    cliff: { low: cliffRun(seed, 0.02), high: cliffRun(seed, 0.3), episodes: CLIFF_EPISODES },
  };
}

if (typeof process !== 'undefined' && import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/').replace(/^(?!\/)/, '/')}`) {
  const fs = await import('node:fs');
  fs.writeFileSync(new URL('./story.json', import.meta.url), JSON.stringify(recordStory()));
  console.log('story.json written');
}
