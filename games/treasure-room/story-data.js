// The write-up's figures come from a real, seeded run, recorded once into story.json:
//   node games/treasure-room/story-data.js
// A test re-records them and checks story.json still matches, so the pictures can't drift from the code.
import { ROOM, REWARD, SLIP, START, valueIteration, greedyPolicy, runPolicy, sweepOnce } from './sim.js';
import { scoreRoute } from './level-return.js';
import { initialPolicy, fixPolicy } from './level-policy.js';
import { sweepsToSettle } from './level-value.js';
import { compareRoutes, simulateTrips } from './level-mdp.js';

export const STORY_SEED = 1;
const GAMMA = 0.9;
const GAMMAS = [1, 0.9, 0.5, 0.1];
const SWEEPS = [1, 2, 3, 5];
const TRIPS = 200;
const D = 1, R = 3, U = 0;
const ROUTES = [
  { id: 'short', actions: [R, R, R, D, D, R] },
  { id: 'detour', actions: [D, D, D, R, R, R, R, U] },
];
const r4 = v => Math.round(v * 1e4) / 1e4 + 0;   // + 0 turns -0 into 0, which JSON would lose
const cells = path => path.map(c => ({ x: c.x, y: c.y }));

const walk = run => ({ outcome: run.outcome, total: run.total, cells: cells([START, ...run.trace.map(t => t.pos)]) });

function returns() {
  const route = id => ROUTES.find(r => r.id === id);
  const per = r => GAMMAS.map(g => { const s = scoreRoute(ROOM, r, g); return { terms: s.terms.map(r4), total: r4(s.total) }; });
  return { gammas: GAMMAS, short: per(route('short')), detour: per(route('detour')), shortCells: cells(scoreRoute(ROOM, route('short'), 1).cells), detourCells: cells(scoreRoute(ROOM, route('detour'), 1).cells) };
}

function value() {
  const settle = sweepsToSettle(ROOM, GAMMA);
  let v = new Array(ROOM.w * ROOM.h).fill(0), done = 0;
  const snapshots = [];
  for (const sweep of [...SWEEPS, settle]) {
    for (; done < sweep; done++) v = sweepOnce(ROOM, v, { gamma: GAMMA });
    snapshots.push({ sweep, values: v.map(r4) });
  }
  return { gamma: GAMMA, settle, snapshots };
}

export function recordStory(seed = STORY_SEED) {
  const best = greedyPolicy(ROOM, valueIteration(ROOM, { gamma: GAMMA }), { gamma: GAMMA });
  const agent = runPolicy(ROOM, best);
  const bad = initialPolicy(ROOM), fixed = fixPolicy(ROOM, GAMMA);
  const plans = compareRoutes(ROOM, GAMMA, SLIP);
  const trips = p => { const t = simulateTrips(ROOM, p.policy, { slipEach: SLIP, n: TRIPS, seed }); return { treasure: t.treasure, pit: t.pit }; };
  const mdp = k => ({ cells: cells(plans[k].cells), startValue: r4(plans[k].startValue), pitAdjacent: plans[k].pitAdjacent });
  return {
    seed,
    room: ROOM.cells.map(r => r.join('')),
    reward: { treasure: REWARD.treasure, pit: REWARD.pit, step: REWARD.step },
    agent: { trace: agent.trace.map(t => ({ pos: t.pos, action: t.action, reward: t.reward })), total: agent.total },
    triples: agent.trace.slice(0, 8).map((t, i) => ({ state: i ? agent.trace[i - 1].pos : START, action: t.action, reward: t.reward })),
    returns: returns(),
    policy: { bad, fixed, badRun: walk(runPolicy(ROOM, bad)), fixedRun: walk(runPolicy(ROOM, fixed)) },
    value: value(),
    mdp: { dry: mdp('dry'), icy: mdp('icy'), trips: { n: TRIPS, dry: trips(plans.dry), icy: trips(plans.icy) } },
  };
}

if (typeof process !== 'undefined' && import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/').replace(/^(?!\/)/, '/')}`) {
  const fs = await import('node:fs');
  fs.writeFileSync(new URL('./story.json', import.meta.url), JSON.stringify(recordStory()));
  console.log('story.json written');
}
