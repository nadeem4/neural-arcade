// Usage: node scripts/city/spike.mjs
// The RC0 gate: trains every try card on the real map (games/city/chicago.json) for seeds 1, 2 and 3
// and checks each shows the behaviour its card promises, within 1,500 ms of training per card.
//
// Tune loop, in this order, re-running this script after each change:
//   1. EPISODES, HYPER, the card rewards and LIGHT_PERIOD (games/city/presets.js, chicago.config.json lightPeriod);
//   2. then the pickup and drop-off (scripts/city/chicago.config.json);
//   3. then shift the bbox a few blocks and re-run convert.js (re-fetch if it grows beyond the export).
// Never hand-edit the map or chicago.json.
//
// It also checks the map itself: the park shortcut exists at street level (a route through park or
// footpath cells is shorter in steps than the best legal road route), at least one signal and one
// one-way street lie on the legal route, and GOAL_SECONDS is the legal route's seconds plus 10%,
// rounded up to a multiple of 5.
import { readFileSync } from 'node:fs';
import { loadWorld, stepWorld, rewardsOf, analyzeRoute } from '../../games/city/sim.js';
import { createAgent, trainEpisodes, greedyRoute } from '../../games/city/train.js';
import { EPISODES, HYPER, PRESETS, GOAL_SECONDS, checkPromise } from '../../games/city/presets.js';

const MAX_MS = 1500;
const SEEDS = [1, 2, 3];
const city = JSON.parse(readFileSync(new URL('../../games/city/chicago.json', import.meta.url), 'utf8'));
const world = loadWorld(city);
const ROAD = 0;

// Fewest moves from pickup to drop-off, ignoring lights; ok(step) says whether a move is allowed.
function fewestSteps(ok) {
  const dist = new Int32Array(world.cols * world.rows).fill(-1);
  dist[world.start] = 0;
  let queue = [world.start];
  while (queue.length) {
    const next = [];
    for (const cell of queue) {
      for (let a = 0; a < 4; a++) {
        const s = stepWorld(world, rewardsOf({}), cell, 0, a);
        if (!s.moved || dist[s.cell2] >= 0 || !ok(s)) continue;
        dist[s.cell2] = dist[cell] + 1;
        next.push(s.cell2);
      }
    }
    queue = next;
  }
  return dist[world.goal];
}

function train(preset, seed) {
  const t0 = performance.now();
  const agent = trainEpisodes(createAgent(world, seed), preset.rewards, EPISODES, HYPER);
  const ms = Math.round(performance.now() - t0);
  const route = greedyRoute(agent, preset.rewards);
  return { route, ms, a: analyzeRoute(world, route, preset.rewards) };
}

const failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };

console.log(`map ${city.cols}x${city.rows}, light period ${world.period}, ${EPISODES} episodes`);
const anySteps = fewestSteps(() => true);
const legalSteps = fewestSteps((s) => world.kind[s.cell2] === ROAD && !s.wrong);
console.log(`fewest steps: any ground ${anySteps}, legal road ${legalSteps}`);
check(anySteps > 0 && legalSteps > 0 && anySteps < legalSteps, 'the park shortcut is not shorter than the legal road route');

const rows = [];
for (const seed of SEEDS) {
  const runs = PRESETS.map((p) => ({ p, ...train(p, seed) }));
  const legal = runs.find((r) => r.p.id === 'legal');
  for (const r of runs) {
    const pass = checkPromise(r.p.id, r.a, legal.a.tiles) && r.ms <= MAX_MS;
    rows.push([r.p.id, seed, r.a.arrived, r.a.seconds, r.a.tiles, r.a.offTiles, r.a.redRuns, r.a.wrongWays, r.ms, pass ? 'PASS' : 'FAIL']);
    check(pass, `${r.p.id} seed ${seed} fails its promise or is over ${MAX_MS} ms`);
  }
  if (seed === SEEDS[0]) {
    const cells = legal.route.cells;
    check(cells.some((c) => world.signal[c]), 'no signal on the legal route');
    check(cells.some((c) => world.oneway[c] >= 0), 'no one-way street on the legal route');
    const goal = Math.ceil((legal.a.seconds * 1.1) / 5) * 5;
    console.log(`legal route: ${legal.a.seconds} s, so GOAL_SECONDS should be ${goal}`);
    check(legal.a.arrived && GOAL_SECONDS === goal, `GOAL_SECONDS is ${GOAL_SECONDS}, expected ${goal}`);
  }
}

const head = ['card', 'seed', 'arrived', 'seconds', 'tiles', 'offTiles', 'redRuns', 'wrongWays', 'train ms', 'result'];
console.log(`| ${head.join(' | ')} |\n|${head.map(() => '---').join('|')}|`);
for (const r of rows) console.log(`| ${r.join(' | ')} |`);
if (failures.length) {
  console.log(`\nFAIL:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('\nPASS: every card shows its promise');
