// The write-up's figures come from three real, seeded learning runs, one per ready-made rule set. Training takes a
// few seconds, too long for a phone to redo on every visit, so the runs are recorded once into story.json:
//   node games/runner/story-data.js
// A test re-records them and checks story.json still matches, so the pictures can't drift from the code.
import { mulberry32 } from '../../engine/rng.js';
import { createLearner, policy } from '../../engine/reinforce.js';
import { forward, createActs } from '../../engine/tinynet.js';
import { PRESETS, RUNNER_SIZES, N_IN, createTrainer, TRY_BUDGET, newGame, sense } from './sim.js';

export const STORY_SEED = 1000;
const CODE = { finished: 'F', died: 'D', timeout: 'T' };
const round = v => Math.round(v * 1e6) / 1e6;

// The chances of each move at the very start of the level.
function startChances(genome) {
  const out = forward(genome, RUNNER_SIZES, sense(newGame(), new Float32Array(N_IN)), createActs(RUNNER_SIZES));
  return [...policy(out)].map(round);
}

export function recordStory(seed = STORY_SEED) {
  const runs = {};
  for (const key of Object.keys(PRESETS)) {
    const tr = createTrainer(PRESETS[key].rules, seed);
    const before = startChances(tr.L.genome);
    while (tr.tries < TRY_BUDGET) tr.runTry();
    runs[key] = {
      outcomes: tr.history.map(t => CODE[t.outcome]).join(''),
      coins: tr.history.map(t => t.coins),
      before, after: startChances(tr.L.genome),
      genome: [...tr.L.genome].map(round),
    };
  }
  // A fresh brain, for the "before" picture of the brain itself.
  const fresh = [...createLearner(RUNNER_SIZES, mulberry32(seed)).genome].map(round);
  return { seed, tries: TRY_BUDGET, fresh, runs };
}

// Turns the compact outcome string back into the history shape the chart and words use.
export function historyOf(run) {
  const NAME = { F: 'finished', D: 'died', T: 'timeout' };
  return [...run.outcomes].map((c, i) => ({ outcome: NAME[c], coins: run.coins[i] }));
}

// First try after which `share` of the next 50 tries do what `test` asks: when the behaviour took hold.
export function settledAt(history, test, share = 0.8) {
  for (let i = 50; i <= history.length; i++) if (history.slice(i - 50, i).filter(test).length >= share * 50) return i - 50 + 1;
  return -1;
}

if (typeof process !== 'undefined' && import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/').replace(/^(?!\/)/, '/')}`) {
  const fs = await import('node:fs');
  fs.writeFileSync(new URL('./story.json', import.meta.url), JSON.stringify(recordStory()));
  console.log('story.json written');
}
