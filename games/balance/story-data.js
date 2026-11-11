// The write-up's figures come from real, seeded runs: four PID tries and one AI training run. Training takes a
// moment, too long for a phone to redo on every visit, so they are recorded once into story.json:
//   node games/balance/story-data.js
// A test re-records them and checks story.json still matches, so the pictures can't drift from the code.
import { createActs } from '../../engine/tinynet.js';
import { startTry, advance, pidAct, newGame, step, WIND_FORCE, LIMIT } from './sim.js';
import { AI_STORY_SEED, SIZES, createTrainer, aiAct } from './ai.js';

export const STORY_SEED = AI_STORY_SEED;
const EVERY = 3;                       // sample every 3 steps: 20 per second
const TRACE_STEPS = 600;               // up to 10 seconds
const WIND_STEPS = LIMIT;              // wind tries run the full 20 s: the cart drifts slowly, so 10 s is too short to see it settle
const r4 = v => Math.round(v * 1e4) / 1e4 + 0;   // + 0 turns -0 into 0, which JSON would lose
const r6 = v => Math.round(v * 1e6) / 1e6 + 0;

// One PID try: the pole angle and cart position, sampled, plus how it ended.
function pidTrace(dials, wind = 0, steps = TRACE_STEPS) {
  const run = startTry(), th = [], x = [];
  while (run.g.t < steps && !run.outcome) {
    advance(run, pidAct(run.pid, run.g, dials), wind);
    if (run.g.t % EVERY === 0) { th.push(r4(run.g.th)); x.push(r4(run.g.x)); }
  }
  return { th, x, fell: run.reason };
}

// A push-free replay of one brain from the standard small tilt: its trace and how long it lasted.
function replay(genome) {
  const g = newGame(), acts = createActs(SIZES), input = new Float32Array(4), th = [], x = [];
  while (g.t < LIMIT) {
    const fell = step(g, aiAct(genome, g, acts, input));
    if (g.t <= TRACE_STEPS && g.t % EVERY === 0) { th.push(r4(g.th)); x.push(r4(g.x)); }
    if (fell) break;
  }
  return { genome: genome.map(r6), th, x, seconds: g.t / 60 };
}

export function recordStory(seed = STORY_SEED) {
  const pid = {
    pOnly: pidTrace({ p: 25, i: 0, d: 0 }),
    pd: pidTrace({ p: 25, i: 0, d: 4 }),
    windNoI: pidTrace({ p: 25, i: 0, d: 4 }, WIND_FORCE, WIND_STEPS),
    windI: pidTrace({ p: 25, i: 12, d: 4 }, WIND_FORCE, WIND_STEPS),
  };

  const tr = createTrainer(seed);
  const fresh = [...tr.bestGenome];
  let early, firstFull = -1;
  while (tr.gen < 40 && (firstFull < 0 || tr.gen < firstFull + 5)) {
    tr.runGeneration();
    if (tr.gen === 1) early = [...tr.bestGenome];
    if (firstFull < 0 && tr.history.at(-1) >= LIMIT / 60) firstFull = tr.gen;
  }
  const ai = {
    history: tr.history.map(r4), firstFull,
    fresh: fresh.map(r6), early: replay(early), late: replay([...tr.bestGenome]),
  };
  return { seed, every: EVERY, pid, ai };
}

if (typeof process !== 'undefined' && import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/').replace(/^(?!\/)/, '/')}`) {
  const fs = await import('node:fs');
  fs.writeFileSync(new URL('./story.json', import.meta.url), JSON.stringify(recordStory()));
  console.log('story.json written');
}
