// Level 4 (policy): an arrow on every tile is the robot's rulebook. Flip the arrows, press Go, or let the AI fix them.
import { ROOM, START, valueIteration, greedyPolicy, runPolicy } from './sim.js';
import { stateId } from '../../assets/grid.js';

const GAMMA = 0.9;
const BEAT = 400;   // ms between steps of the walk
const SHOW = 1200;  // ms the fixed arrows stay outlined
const KEYS = { ArrowUp: 0, ArrowDown: 1, ArrowLeft: 2, ArrowRight: 3 };
const NAMES = ['up', 'down', 'left', 'right'];

const isFloor = (room, x, y) => !'TX#'.includes(room.cells[y][x]);
const floorCells = room => room.cells.flatMap((row, y) => row.map((_, x) => ({ x, y }))).filter(c => isFloor(room, c.x, c.y));

export const flipAction = a => (a + 1) % 4;

// All arrows point right: a rulebook that looks sensible and leads the robot nowhere useful.
export const initialPolicy = room => {
  const p = new Array(room.w * room.h).fill(-1);
  for (const c of floorCells(room)) p[stateId(room, c)] = 3;
  return p;
};

export function setArrow(policy, room, cell, action) {
  if (!isFloor(room, cell.x, cell.y)) return policy;
  const next = policy.slice();
  next[stateId(room, cell)] = action;
  return next;
}

export const fixPolicy = (room, gamma) => greedyPolicy(room, valueIteration(room, { gamma }), { gamma });

// The floor tiles whose arrow differs (walls, treasure and pit are -1 in both, so they never show).
export const diffCells = (a, b) => b.flatMap((v, i) => (v !== a[i] ? [{ x: i % ROOM.w, y: Math.floor(i / ROOM.w) }] : []));

export function verdict(run) {
  const n = run.trace.length;
  if (run.outcome === 'treasure') return `The robot reached the treasure in ${n} steps. Score ${run.total}.`;
  if (run.outcome === 'pit') return `The robot walked into the pit after ${n} steps. Score ${run.total}.`;
  const seen = new Set(run.trace.map(t => `${t.pos.x},${t.pos.y}`));
  return seen.size < n ? 'The robot is going round in circles and never reaches the treasure.' : 'The robot ran out of steps.';
}

const label = (policy, room, { x, y }) => `tile ${x},${y}: arrow ${NAMES[policy[stateId(room, { x, y })]]}`;

export function mount(ui) {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ac = new AbortController(), on = (t, ev, fn) => t.addEventListener(ev, fn, { signal: ac.signal });
  const $ = sel => ui.panel.querySelector(sel);
  const room = ui.room, tiles = ui.tiles;
  let policy = initialPolicy(room), agent = START, marks = [], walking = false, timer = null, pending = null;

  const stop = () => { clearInterval(timer); clearTimeout(pending); timer = pending = null; walking = false; };
  const busy = () => walking || pending !== null;

  function renderTiles() {
    tiles.innerHTML = Array.from({ length: room.w * room.h }, (_, i) => {
      const x = i % room.w, y = Math.floor(i / room.w);
      return isFloor(room, x, y)
        ? `<button type="button" data-x="${x}" data-y="${y}" aria-label="${label(policy, room, { x, y })}"></button>`
        : '<span></span>';
    }).join('');
  }
  function paint() {
    ui.draw({ policy, agent, marks });
    for (const b of [$('#go'), $('#fix'), $('#resetArrows')]) b.disabled = busy();
  }
  function edit(cell, action) {
    if (busy()) return;
    stop(); agent = START;
    policy = setArrow(policy, room, cell, action ?? flipAction(policy[stateId(room, cell)]));
    ui.say('');
    renderTiles();
    tiles.querySelector(`[data-x="${cell.x}"][data-y="${cell.y}"]`)?.focus();
    paint();
  }
  function go() {
    stop();
    const run = runPolicy(room, policy, { maxSteps: 30 });
    const path = [START, ...run.trace.map(t => t.pos)];
    const finish = () => { stop(); ui.say(verdict(run)); ui.readout(run.trace.length, run.total); paint(); };
    agent = START;
    if (reduceMotion || path.length === 1) { agent = path.at(-1); finish(); return; }
    walking = true;
    let i = 0;
    timer = setInterval(() => {
      if (document.hidden) return; // paused with the tab
      agent = path[++i];
      ui.flash();
      ui.readout(i, run.trace.slice(0, i).reduce((s, t) => s + t.reward, 0));
      if (i >= path.length - 1) finish(); else paint();
    }, BEAT);
    paint();
  }
  function fix() {
    if (busy()) return;
    const next = fixPolicy(room, GAMMA);
    marks = diffCells(policy, next);
    policy = next;
    renderTiles();
    if (reduceMotion) { marks = []; go(); return; }
    ui.say('The AI changed the outlined arrows.');
    pending = setTimeout(() => { pending = null; marks = []; go(); }, SHOW);
    paint();
  }
  function reset() {
    stop(); policy = initialPolicy(room); agent = START; marks = [];
    ui.say(''); ui.readout(0, 0); renderTiles(); paint();
  }

  on(tiles, 'click', e => {
    const b = e.target.closest?.('[data-x]');
    if (b) edit({ x: Number(b.dataset.x), y: Number(b.dataset.y) });
  });
  on(tiles, 'keydown', e => { // an arrow key on a focused tile points it that way; other keys keep their usual job
    const b = e.target.closest?.('[data-x]');
    if (!b || !(e.key in KEYS) || e.metaKey || e.ctrlKey || e.altKey) return;
    e.preventDefault();
    edit({ x: Number(b.dataset.x), y: Number(b.dataset.y) }, KEYS[e.key]);
  });
  on($('#go'), 'click', go);
  on($('#fix'), 'click', fix);
  on($('#resetArrows'), 'click', reset);

  ui.readout(0, 0);
  renderTiles();
  paint();
  return { destroy() { stop(); ac.abort(); tiles.innerHTML = ''; }, redraw: paint };
}
