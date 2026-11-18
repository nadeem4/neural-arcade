// Level 6 (the icy floor): moves slip, so the best plan changes. Compare the dry and icy plans, run them on ice, and name the five MDP parts.
import { mulberry32 } from '../../engine/rng.js';
import { stateId } from '../../assets/grid.js';
import { START, SLIP, valueIteration, greedyPolicy, runPolicy, bestPathCells, adjacentToPit } from './sim.js';

const BEAT = 400;  // ms between steps of the walk
const LIGHT = 700; // ms between one tag lighting and the next
export const TAGS = ['states', 'actions', 'rewards', 'slip', 'gamma'];
const LABEL = { states: 'States', actions: 'Actions', rewards: 'Rewards', slip: 'Slip chance', gamma: 'Discount' };
const pct = p => Math.round(p * 100);

export function tagNote(tag, { slip = SLIP, gamma = 0.9 } = {}) {
  return {
    states: 'States: the 25 tiles of the room, each one a place the robot can be.',
    actions: 'Actions: up, down, left or right, chosen on every tile.',
    rewards: 'Rewards: -1 for every step, +10 for the treasure, -10 for the pit.',
    slip: `Slip chance: a move works ${pct(1 - 2 * slip)}% of the time and slips to each side ${pct(slip)}% of the time.`,
    gamma: `Discount: ${gamma} shrinks each later reward, so far-off ones count for less.`,
  }[tag];
}

const planFor = (room, gamma, slip) => {
  const values = valueIteration(room, { gamma, slip });
  return { values, policy: greedyPolicy(room, values, { gamma, slip }) };
};

// The AI's plan on a dry floor and on an icy one: the most likely route, its start value, and whether it passes next to the pit.
export function compareRoutes(room, gamma, slipEach) {
  const one = slip => {
    const { values, policy } = planFor(room, gamma, slip);
    const cells = bestPathCells(room, policy);
    return { policy, cells, startValue: values[stateId(room, START)], pitAdjacent: cells.some(c => adjacentToPit(room, c)) };
  };
  return { dry: one(0), icy: one(slipEach) };
}

// n seeded trips of a policy on a floor that slips slipEach to each side; the same seed gives the same trips.
export function simulateTrips(room, policy, { slipEach, n, seed }) {
  const rng = mulberry32(seed);
  let treasure = 0, pit = 0, sum = 0;
  for (let i = 0; i < n; i++) {
    const r = runPolicy(room, policy, { slip: slipEach, rng });
    if (r.outcome === 'treasure') treasure++;
    else if (r.outcome === 'pit') pit++;
    sum += r.total;
  }
  return { treasure, pit, meanTotal: sum / n };
}

export function mount(ui) {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ac = new AbortController(), on = (t, ev, fn) => t.addEventListener(ev, fn, { signal: ac.signal });
  const $ = sel => ui.panel.querySelector(sel);
  const room = ui.room, GAMMA = 0.9;
  const { dry, icy } = compareRoutes(room, GAMMA, SLIP);
  let onIce = false, agent = START, tags = [], lit = 0, seed = 1, trips = 1, timer = null, lighting = null;

  const stop = () => { clearInterval(timer); clearInterval(lighting); timer = lighting = null; };
  const busy = () => timer !== null || lighting !== null;

  function paintTags() {
    $('#tags').innerHTML = TAGS.map((t, i) => `<li${i < lit ? ' class="lit"' : ''}><b>${LABEL[t]}</b><span>${tagNote(t, { slip: SLIP, gamma: GAMMA })}</span></li>`).join('');
  }
  function paint() {
    ui.draw({ ice: onIce, ghost: [dry.cells, icy.cells], agent, tags });
    $('#dry').setAttribute('aria-pressed', String(!onIce));
    $('#icy').setAttribute('aria-pressed', String(onIce));
    $('#floorNote').textContent = onIce
      ? `Icy floor: a move works ${pct(1 - 2 * SLIP)}% of the time. The AI plans the long way round, away from the pit (value ${icy.startValue.toFixed(1)}).`
      : `Dry floor: every move works. The AI takes the short way, past the pit (value ${dry.startValue.toFixed(1)}).`;
    for (const id of ['#dry', '#icy', '#walkPlan', '#trips', '#showMdp']) $(id).disabled = busy();
    paintTags();
  }
  function setFloor(ice) { stop(); onIce = ice; agent = START; tags = []; ui.say(''); ui.readout(0, 0); paint(); }

  function walkPlan() {
    stop();
    const plan = onIce ? icy : dry;
    const run = runPolicy(room, plan.policy, { slip: onIce ? SLIP : 0, rng: mulberry32(seed++) });
    const frames = [{ pos: START, tag: null }, ...run.trace.map(t => ({ pos: t.pos, tag: t.slipped ? { x: t.pos.x, y: t.pos.y, text: 'slipped!', tone: 'bad' } : null }))];
    const show = i => {
      agent = frames[i].pos; tags = frames[i].tag ? [frames[i].tag] : [];
      ui.readout(i, run.trace.slice(0, i).reduce((s, t) => s + t.reward, 0));
    };
    const finish = () => {
      stop();
      const slips = run.trace.filter(t => t.slipped).length;
      ui.say(`${run.outcome === 'treasure' ? 'Reached the treasure' : run.outcome === 'pit' ? 'Fell in the pit' : 'Ran out of steps'}, score ${run.total}${slips ? `, slipped ${slips} time${slips > 1 ? 's' : ''}` : ''}.`);
      paint();
    };
    agent = START; tags = [];
    if (reduceMotion || frames.length === 1) { show(frames.length - 1); finish(); return; }
    let i = 0;
    timer = setInterval(() => {
      if (document.hidden) return; // paused with the tab
      show(++i);
      ui.flash();
      if (i >= frames.length - 1) finish(); else paint();
    }, BEAT);
    paint();
  }
  function runTrips() {
    const a = simulateTrips(room, dry.policy, { slipEach: SLIP, n: 20, seed: trips });
    const b = simulateTrips(room, icy.policy, { slipEach: SLIP, n: 20, seed: trips++ });
    $('#tripsOut').textContent = `Dry plan on ice: ${a.treasure} treasure, ${a.pit} pit.\nIcy plan on ice: ${b.treasure} treasure, ${b.pit} pit.`;
    ui.say('On ice, the plan made for ice does better.');
  }
  function showMdp() {
    stop();
    if (reduceMotion) { lit = TAGS.length; paint(); return; }
    lit = 1;
    lighting = setInterval(() => {
      if (document.hidden) return;
      lit += 1;
      if (lit >= TAGS.length) { clearInterval(lighting); lighting = null; }
      paint();
    }, LIGHT);
    paint();
  }

  on($('#dry'), 'click', () => setFloor(false));
  on($('#icy'), 'click', () => setFloor(true));
  on($('#walkPlan'), 'click', walkPlan);
  on($('#trips'), 'click', runTrips);
  on($('#showMdp'), 'click', showMdp);

  ui.readout(0, 0);
  paint();
  return { destroy() { stop(); ac.abort(); }, redraw: paint };
}
