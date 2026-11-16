// The agent playground: a grid, four action buttons, and a readout of who said what. Builds its own markup.
import { GRID, ACTIONS, drawGrid } from '../../assets/grid.js';
import { createWorld, act, autoAct } from './sim.js';
import { mulberry32 } from '../../engine/rng.js';

export const presets = [
  { label: 'Move it yourself', text: 'Press an arrow. You are the agent: you pick the action, the world answers.', state: { auto: false } },
  { label: 'Let it act on its own', text: 'Let it act. Now a program is the agent, picking its own actions, and the world answers each one the same way.', state: { auto: true } },
  { label: 'Ask the world', text: 'One move right. The agent chose; the world replied with a new state and a reward.', state: { auto: false, act: 3 } },
];

const TICK = 500;
const ARROWS = ['↑', '↓', '←', '→'];

export function mountPlayground(root) {
  root.innerHTML = `
    <div class="stage-head"><span><b>Pick an action, see what the world says</b></span><span>Steps <b class="num" data-r="n">0</b></span><span>Reward so far <b class="num" data-r="tot">0.0</b></span></div>
    <div class="views">
      <canvas role="img" data-r="world" aria-label="A grid with a start, a treasure worth 10, a pit worth minus 10, and walls; the agent is the orange dot"></canvas>
      <div class="readout" aria-live="polite">
        <div><span class="who">Agent</span><p data-r="said">Waiting for a move.</p></div>
        <div><span class="who">Environment</span><p data-r="answered">The world has not answered yet.</p></div>
      </div>
    </div>
    <div class="stage-foot">
      ${ACTIONS.map((a, i) => `<button type="button" class="sbtn" data-a="${i}" aria-label="${a.name}">${ARROWS[i]} ${a.name}</button>`).join('')}
      <button type="button" class="sbtn primary" data-r="pick">Agent picks</button>
      <label class="hint"><input type="checkbox" data-r="auto"> Keep going on its own</label>
    </div>`;
  const $ = n => root.querySelector(`[data-r="${n}"]`);
  const canvas = $('world'), autoBox = $('auto');
  const rng = mulberry32(11);
  let world = createWorld(), last = 0;

  const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function readout() {
    const l = world.last;
    $('n').textContent = world.steps;
    $('tot').textContent = world.total.toFixed(1);
    if (!l) { $('said').textContent = 'Waiting for a move.'; $('answered').textContent = 'New episode: back at the start.'; return; }
    $('said').textContent = `Agent did: ${ACTIONS[l.action].name}`;
    const end = world.done ? (l.reward > 0 ? ' Treasure! Episode over.' : ' Into the pit. Episode over.') : '';
    $('answered').textContent = `World answered: new state (${world.pos.x},${world.pos.y}), reward ${l.reward.toFixed(1)}.${end}`;
  }

  function apply(state) {
    world = createWorld();
    autoBox.checked = !!state.auto && !reduced();
    if (state.act !== undefined) act(world, state.act);
    if (state.auto && reduced()) autoAct(world, rng); // no animation, so take one visible step
    readout();
    last = 0;
    wake();
  }

  root.querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', () => { act(world, +b.dataset.a); readout(); }));
  $('pick').addEventListener('click', () => { autoAct(world, rng); readout(); });

  function draw() {
    const r = canvas.getBoundingClientRect(), d = window.devicePixelRatio || 1;
    const w = Math.round(r.width * d), h = Math.round(r.height * d);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const x = canvas.getContext('2d');
    x.setTransform(d, 0, 0, d, 0, 0);
    x.clearRect(0, 0, r.width, r.height);
    const cell = Math.floor(Math.min((r.width - 16) / GRID.w, (r.height - 16) / GRID.h));
    x.translate((r.width - cell * GRID.w) / 2, (r.height - cell * GRID.h) / 2);
    drawGrid(x, GRID, { cell, agent: world.pos });
  }

  // Run only while the page is visible and the stage is on screen.
  let onScreen = true, raf = 0;
  const live = () => onScreen && !document.hidden;
  function loop(t) {
    raf = 0;
    if (!live()) return;
    if (autoBox.checked && t - last >= TICK) { last = t; autoAct(world, rng); readout(); }
    draw();
    raf = requestAnimationFrame(loop);
  }
  function wake() { if (live() && !raf) raf = requestAnimationFrame(loop); }
  document.addEventListener('visibilitychange', wake);
  if (typeof IntersectionObserver === 'function') {
    new IntersectionObserver(es => { onScreen = es[es.length - 1].isIntersecting; wake(); }).observe(root);
  }

  // Open already acting on its own, so something is happening.
  apply(presets[1].state);
  return { apply };
}
