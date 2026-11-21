// Level 3 (return and discount): pick or draw a route, see its rewards added up, and slide the discount to shrink far-away rewards.
import { START, pathActions, discounted, returnOf, treasureWorth, REWARD } from './sim.js';
import { ACTIONS } from '../../assets/grid.js';
import { gammaHint } from './words.js';
import { tagTone } from './room-math.js';

const D = 1, R = 3, U = 0;
// Chosen from the real room: the dry greedy route (passes next to the pit), a longer safe way round the bottom, and one that ends in the pit.
export const ROUTES = [
  { id: 'short', label: 'Short way', actions: [R, R, R, D, D, R] },
  { id: 'detour', label: 'Detour', actions: [D, D, D, R, R, R, R, U] },
  { id: 'pit', label: 'Risky way', actions: [R, R, D] },
];

const BEAT = 400; // ms between steps of the walk
const signed = r => (r > 0 ? `+${r}` : `−${-r}`);
const fmt = n => { const v = Math.round(n * 100) / 100; return v < 0 ? `−${-v}` : `${v}`; };

export function scoreRoute(room, route, gamma) {
  const walk = pathActions(room, START, route.actions);
  const rewards = walk.trace.map(t => t.reward);
  return {
    rewards, terms: discounted(rewards, gamma), total: returnOf(rewards, gamma),
    steps: rewards.length, outcome: walk.outcome, cells: [START, ...walk.trace.map(t => t.pos)],
  };
}

// Taps on tiles, each next to the one before (the first next to the start), become a list of actions. Null if any tap breaks that.
export function routeFromTaps(room, cells) {
  const actions = [];
  let at = START;
  for (const c of cells) {
    if (room.cells[at.y][at.x] === 'T' || room.cells[at.y][at.x] === 'X') return null; // the episode already ended
    const a = ACTIONS.findIndex(({ dx, dy }) => at.x + dx === c.x && at.y + dy === c.y);
    if (a < 0 || room.cells[c.y][c.x] === '#') return null;
    actions.push(a);
    at = c;
  }
  return actions;
}

// Walk it needs a route; with none it says why. Busy (a walk is running) disables without a reason.
export const walkItState = ({ route, busy }) => (busy ? { disabled: true, why: '' }
  : route.length ? { disabled: false, why: '' } : { disabled: true, why: 'Pick a route, or tap tiles from the robot.' });

export const treasureScale = (steps, gamma) => Math.max(0.15, treasureWorth(steps, gamma) / REWARD.treasure);

// One frame per step of the walk: where the robot is, the tag that floats there, and the discounted total so far.
export function frames(room, route, gamma) {
  const s = scoreRoute(room, route, gamma);
  let total = 0;
  return [{ pos: START, tag: null, total: 0 }, ...s.cells.slice(1).map((pos, i) => {
    total += s.terms[i];
    return { pos, tag: { x: pos.x, y: pos.y, text: signed(s.rewards[i]), tone: tagTone(s.rewards[i]) }, total };
  })];
}

// The treasure tile's label: what the treasure is worth from the start, given the route length and the discount.
export const worthTags = (room, steps, gamma) => room.cells.flatMap((row, y) => row.flatMap((c, x) => (c === 'T'
  ? [{ x, y, text: `+${Math.round(treasureWorth(steps, gamma) * 10) / 10} here`, tone: 'good' }] : [])));

export const compare = (room, gamma) => ROUTES.map(r => `${r.label} ${fmt(scoreRoute(room, r, gamma).total)}`).join(' · ');

export function mount(ui) {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ac = new AbortController(), on = (t, ev, fn) => t.addEventListener(ev, fn, { signal: ac.signal });
  const $ = sel => ui.panel.querySelector(sel);
  const slider = $('#gamma'), walkBtn = $('#walk');
  let route = ROUTES[0], gamma = Number(slider.value) || 0.9, timer = null, walk = null, at = 0;

  const stop = () => { clearInterval(timer); timer = null; };
  // How far the treasure is from the start along this route; a route that never reaches it is judged by the short way.
  const distance = s => (s.outcome === 'treasure' ? s.steps : ROUTES[0].actions.length);

  function paint() {
    const s = scoreRoute(ui.room, route, gamma), shown = walk ? at : s.steps;
    const f = walk ? walk[at] : null;
    ui.draw({
      agent: f ? f.pos : START, ghost: s.cells, gamma, tags: [...(f?.tag ? [f.tag] : []), ...worthTags(ui.room, distance(s), gamma)], treasureScale: treasureScale(distance(s), gamma),
    });
    $('#compare').textContent = compare(ui.room, gamma);
    $('#gammaOut').textContent = gamma.toFixed(2);
    $('#gammaHint').textContent = gammaHint(gamma);
    $('#sum').textContent = s.steps
      ? `Rewards: ${s.rewards.slice(0, shown).map(signed).join(' ')}\nDiscounted: ${s.terms.slice(0, shown).map(fmt).join(' ')}\nReturn: ${fmt(s.terms.slice(0, shown).reduce((a, b) => a + b, 0))}`
      : '';
    ui.readout(shown, fmt(s.terms.slice(0, shown).reduce((a, b) => a + b, 0)));
    const w = walkItState({ route: s.cells.slice(1), busy: !!timer });
    walkBtn.disabled = w.disabled;
    $('#walkItWhy').textContent = w.why;
  }

  function setRoute(r) { stop(); walk = null; route = r; ui.say(''); paint(); }

  function finish() {
    stop();
    const s = scoreRoute(ui.room, route, gamma);
    ui.say(`${s.outcome === 'treasure' ? 'Reached the treasure' : s.outcome === 'pit' ? 'Fell in the pit' : 'Stopped'}: return ${fmt(s.total)}.`);
  }
  function tick() {
    if (document.hidden) return; // paused with the tab
    at += 1;
    if (at >= walk.length - 1) finish();
    paint();
  }
  function go() {
    walk = frames(ui.room, route, gamma);
    at = 0;
    if (reduceMotion) { at = walk.length - 1; finish(); } else { ui.flash(); timer = setInterval(tick, BEAT); }
    paint();
  }

  on($('#routes'), 'click', e => {
    const b = e.target.closest?.('[data-route]');
    if (b) setRoute(ROUTES.find(r => r.id === b.dataset.route));
  });
  on($('#clear'), 'click', () => setRoute({ id: 'own', actions: [] }));
  on(walkBtn, 'click', go);
  on(slider, 'input', () => { gamma = Number(slider.value); walk = null; stop(); ui.say(''); paint(); });
  on(ui.canvas, 'click', e => {
    const c = ui.cellAt(e);
    if (!c) return;
    const cells = scoreRoute(ui.room, route, gamma).cells.slice(1);
    const next = routeFromTaps(ui.room, [...cells, c]);
    if (next) setRoute({ id: 'own', actions: next });
    else ui.say('Tap a tile next to the end of the route.');
  });

  paint();
  return { destroy() { stop(); ac.abort(); }, redraw: paint };
}
