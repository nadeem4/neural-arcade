// Headless clip recorder for the concept videos: trains the Treasure Maze agent with a seed
// and returns the grid, value/policy snapshots at chosen episodes, and a greedy walk at each.
//   node games/maze/record.js --seed 1 --gamma 0.95 --episodes 1,20,3000 [--map near-or-far] [--out clip.json]
import { MAPS, loadMap, createAgent, trainEpisodes, greedyWalk, policyGrid, valueGrid } from './sim.js';

const r4 = v => Math.round(v * 1e4) / 1e4 + 0;   // + 0 turns -0 into 0

export function recordClip({ seed = 1, map = 'near-or-far', episodes = [1, 5, 20, 100, 3000], gamma = 0.9, alpha = 0.5, epsilon = 0.5 } = {}) {
  if (!MAPS[map]) throw new Error(`unknown map: ${map}`);
  if (episodes.some((e, i) => !(e >= 1) || (i && e <= episodes[i - 1]))) throw new Error('episodes must be increasing and at least 1');
  const m = loadMap(map), agent = createAgent(map, seed), params = { alpha, gamma, epsilon };
  const snapshots = [], walks = [];
  for (const episode of episodes) {
    trainEpisodes(agent, episode - agent.episodes, params);
    snapshots.push({ episode, values: valueGrid(agent).map(r4), policy: policyGrid(agent) });
    walks.push({ episode, ...greedyWalk(agent) });
  }
  return { seed, gamma, alpha, epsilon, map: { id: m.id, rows: m.rows, nRows: m.nRows, nCols: m.nCols, start: m.start }, snapshots, walks };
}

if (typeof process !== 'undefined' && import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/').replace(/^(?!\/)/, '/')}`) {
  const a = {};
  process.argv.slice(2).forEach((x, i, all) => { if (x.startsWith('--')) a[x.slice(2)] = all[i + 1]; });
  const spec = { seed: +(a.seed ?? 1), gamma: +(a.gamma ?? 0.9) };
  if (a.map) spec.map = a.map;
  if (a.episodes) spec.episodes = a.episodes.split(',').map(Number);
  const json = JSON.stringify(recordClip(spec));
  if (a.out) (await import('node:fs')).writeFileSync(a.out, json);
  else process.stdout.write(json);
}
