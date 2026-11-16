// Real training on the real Chicago Loop: each try card must show the behaviour it promises.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadWorld, analyzeRoute } from '../games/city/sim.js';
import { createAgent, trainEpisodes, greedyRoute } from '../games/city/train.js';
import { EPISODES, HYPER, PRESETS, RANGES, GOAL_SECONDS, SEED, checkPromise } from '../games/city/presets.js';

const world = loadWorld(JSON.parse(readFileSync(new URL('../games/city/chicago.json', import.meta.url), 'utf8')));

function run(rewards, seed, episodes = EPISODES) {
  const agent = trainEpisodes(createAgent(world, seed), rewards, episodes, HYPER);
  return analyzeRoute(world, greedyRoute(agent, rewards), rewards);
}
const card = (id) => PRESETS.find((p) => p.id === id);
const legalTiles = (seed) => run(card('legal').rewards, seed).tiles;

describe('each try card shows the behaviour it promises (seed 1)', () => {
  for (const p of PRESETS) {
    it(`card ${p.id}: ${p.name}`, () => {
      const a = run(p.rewards, SEED);
      expect(checkPromise(p.id, a, p.id === 'mile' ? legalTiles(SEED) : 0), JSON.stringify(a)).toBe(true);
    }, 60000);
  }

  it('card 4 is legal and under GOAL_SECONDS', () => {
    const a = run(card('legal').rewards, SEED);
    expect(a.arrived).toBe(true);
    expect([a.offTiles, a.redRuns, a.wrongWays]).toEqual([0, 0, 0]);
    expect(a.seconds).toBeLessThanOrEqual(GOAL_SECONDS);
  }, 60000);
});

describe('robustness', () => {
  it('the preset promises also hold for seeds 2 and 3', () => {
    for (const seed of [2, 3]) {
      const legal = legalTiles(seed);
      for (const p of PRESETS) {
        const a = run(p.rewards, seed);
        expect(checkPromise(p.id, a, legal), `${p.id} seed ${seed}: ${JSON.stringify(a)}`).toBe(true);
      }
    }
  }, 300000);

  it('extreme rewards on the real map finish without NaN', () => {
    const max = (k) => RANGES[k].max;
    const extremes = [
      { fare: 0, time: max('time'), off: max('off'), red: max('red'), wrong: max('wrong'), perTile: max('perTile') },
      { fare: 0, time: 0, off: max('off'), red: max('red'), wrong: max('wrong'), perTile: max('perTile') },
      { fare: 0, time: 0, off: 0, red: 0, wrong: 0, perTile: 0 },
    ];
    for (const rewards of extremes) {
      const agent = trainEpisodes(createAgent(world, SEED), rewards, 2000, HYPER);
      const a = analyzeRoute(world, greedyRoute(agent, rewards), rewards);
      for (const v of Object.values(a)) {
        if (typeof v === 'number') expect(Number.isFinite(v), JSON.stringify(a)).toBe(true);
      }
      expect(Number.isFinite(a.reward)).toBe(true);
    }
  }, 60000);
});
