// Level 5 (value): sweep to spread worth outward from the treasure, see it as numbers and heat, then walk uphill to it.
import { ACTIONS, stateId } from '../../assets/grid.js';
import { ROOM, START, sweepOnce } from './sim.js';
import { gammaHint } from './words.js';

const BEAT = 400;   // ms between steps of the walk
const RIPPLE = 150; // ms between the ten sweeps of Sweep x10
const SETTLED = 0.01;
const isFloor = (room, x, y) => !'TX#'.includes(room.cells[y][x]);

// 0..1 per tile, over the floor tiles only: the lowest value is 0, the highest 1. Flat values give all 0.
export function heatOf(values, room = ROOM) {
  const floor = values.map((_, i) => i).filter(i => isFloor(room, i % room.w, Math.floor(i / room.w)));
  const lo = Math.min(...floor.map(i => values[i])), hi = Math.max(...floor.map(i => values[i]));
  return values.map((v, i) => (hi > lo && floor.includes(i) ? (v - lo) / (hi - lo) : 0));
}

// Follow the neighbour worth most, as long as it beats where you stand. The treasure always beats a tile, the pit is never entered.
// 'still' when no neighbour is better (no value around yet), 'treasure' on arrival.
export function uphillWalk(room, values, from) {
  const path = [{ x: from.x, y: from.y }];
  let at = from;
  for (let i = 0; i < room.w * room.h; i++) {
    let best = null, bestV = values[stateId(room, at)];
    for (const { dx, dy } of ACTIONS) {
      const x = at.x + dx, y = at.y + dy, c = room.cells[y]?.[x];
      if (c === undefined || c === '#' || c === 'X') continue;
      const v = c === 'T' ? Infinity : values[stateId(room, { x, y })];
      if (v > bestV) { best = { x, y }; bestV = v; }
    }
    if (!best) return { path, outcome: 'still' };
    path.push(best);
    at = best;
    if (room.cells[at.y][at.x] === 'T') return { path, outcome: 'treasure' };
  }
  return { path, outcome: 'still' };
}

// How many sweeps until no tile changes by as much as 0.01.
export function sweepsToSettle(room, gamma) {
  let v = new Array(room.w * room.h).fill(0);
  for (let n = 1; n <= 1000; n++) {
    const next = sweepOnce(room, v, { gamma });
    if (next.every((x, i) => Math.abs(x - v[i]) < SETTLED)) return n;
    v = next;
  }
  return 1000;
}

const changed = (room, a, b) => b.flatMap((v, i) => (v !== a[i] ? [{ x: i % room.w, y: Math.floor(i / room.w) }] : []));

export function mount(ui) {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ac = new AbortController(), on = (t, ev, fn) => t.addEventListener(ev, fn, { signal: ac.signal });
  const $ = sel => ui.panel.querySelector(sel);
  const room = ui.room, slider = $('#valueGamma');
  const blank = () => new Array(room.w * room.h).fill(0);
  let gamma = Number(slider.value) || 0.9, values = blank(), sweeps = 0, marks = [], agent = START, timer = null;

  const stop = () => { clearInterval(timer); timer = null; };
  const busy = () => timer !== null;

  function paint() {
    ui.draw({ values, heat: heatOf(values, room), marks, agent });
    $('#valueGammaOut').textContent = gamma.toFixed(2);
    $('#valueGammaHint').textContent = gammaHint(gamma);
    const settled = sweeps > 0 && sweepsToSettle(room, gamma) <= sweeps;
    $('#sweepInfo').textContent = settled ? `Settled after ${sweepsToSettle(room, gamma)} sweeps` : `Sweep ${sweeps}`;
    for (const id of ['#sweep', '#sweep10', '#walkUp', '#resetSweeps']) $(id).disabled = busy();
  }
  function sweep() {
    const next = sweepOnce(room, values, { gamma });
    marks = changed(room, values, next);
    values = next; sweeps += 1; agent = START;
  }
  function sweepMany(n) {
    stop(); ui.say('');
    if (reduceMotion) { for (let i = 0; i < n; i++) sweep(); marks = []; paint(); return; }
    let left = n;
    timer = setInterval(() => {
      if (document.hidden) return; // paused with the tab
      sweep();
      if (--left <= 0) stop();
      paint();
    }, RIPPLE);
    paint();
  }
  function walkUp() {
    stop(); marks = [];
    const w = uphillWalk(room, values, START);
    const finish = () => {
      stop();
      ui.say(w.outcome === 'treasure' ? `Walked uphill to the treasure in ${w.path.length - 1} steps.`
        : sweeps === 0 || w.path.length === 1 ? 'No value here yet: sweep first.' : 'No tile next to the robot is better yet: sweep some more.');
      paint();
    };
    agent = START;
    ui.readout(0, 0);
    if (reduceMotion || w.path.length === 1) { agent = w.path.at(-1); ui.readout(w.path.length - 1, w.outcome === 'treasure' ? 12 - w.path.length : 0); finish(); return; }
    let i = 0;
    timer = setInterval(() => {
      if (document.hidden) return;
      agent = w.path[++i];
      ui.flash();
      ui.readout(i, w.outcome === 'treasure' && i === w.path.length - 1 ? 12 - w.path.length : -i);
      if (i >= w.path.length - 1) finish(); else paint();
    }, BEAT);
    paint();
  }
  function reset() { stop(); values = blank(); sweeps = 0; marks = []; agent = START; ui.say(''); ui.readout(0, 0); paint(); }

  on($('#sweep'), 'click', () => { stop(); ui.say(''); sweep(); if (reduceMotion) marks = []; paint(); });
  on($('#sweep10'), 'click', () => sweepMany(10));
  on($('#walkUp'), 'click', walkUp);
  on($('#resetSweeps'), 'click', reset);
  on(slider, 'input', () => { gamma = Number(slider.value); reset(); });

  ui.readout(0, 0);
  paint();
  return { destroy() { stop(); ac.abort(); }, redraw: paint };
}
