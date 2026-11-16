// The policy playground: click a cell to change its arrow, press Run to walk the agent along the rulebook.
import { GRID, drawGrid } from '../../assets/grid.js';
import { createPolicy, setAction, runPolicy } from './sim.js';
import { RULEBOOKS } from './rulebooks.js';

export const presets = [
  { label: RULEBOOKS[0].label, text: 'Press Run. The arrows send the agent back and forth between two cells, so it never gets anywhere.', state: { policy: RULEBOOKS[0].policy } },
  { label: RULEBOOKS[1].label, text: 'Press Run. Every arrow points right, so the agent takes the short way along the top and drops into the pit.', state: { policy: RULEBOOKS[1].policy } },
  { label: RULEBOOKS[2].label, text: 'Press Run. These arrows come from the best route: down, round the pit, then up to the treasure.', state: { policy: RULEBOOKS[2].policy } },
];

const ARROWS = ['↑', '↓', '←', '→'];
const SAY = { treasure: 'Reached the treasure', pit: 'Fell in the pit', loop: 'Went round in circles', timeout: 'Ran out of steps' };
const TICK = 350;

export function mountPlayground(root) {
  root.innerHTML = `
    <div class="stage-head"><span><b>Click a cell to change its arrow, then press Run</b></span><span>Total reward <b class="num" data-r="tot">0.0</b></span></div>
    <div class="views">
      <canvas role="img" tabindex="0" data-r="world" aria-label="A grid with an arrow in every cell: the agent's rulebook. Use the arrow keys to pick a cell and Enter or Space to turn its arrow."></canvas>
      <div class="readout" aria-live="polite"><div><span class="who">Outcome</span><p data-r="out">Press Run to follow the rulebook.</p></div></div>
    </div>
    <div class="stage-foot"><button type="button" class="sbtn primary" data-r="run">Run</button></div>`;
  const $ = n => root.querySelector(`[data-r="${n}"]`);
  const canvas = $('world');
  let policy = createPolicy(GRID, 0), sel = { x: 0, y: 0 };
  let result = null, shown = 0, last = 0, running = false;

  const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isFloor = (x, y) => !'TX#'.includes(GRID.cells[y][x]);
  const css = (n, f) => { try { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || f; } catch { return f; } };

  const layout = () => {
    const r = canvas.getBoundingClientRect();
    const cell = Math.floor(Math.min((r.width - 16) / GRID.w, (r.height - 16) / GRID.h));
    return { r, cell, ox: (r.width - cell * GRID.w) / 2, oy: (r.height - cell * GRID.h) / 2 };
  };

  function draw() {
    const { r, cell, ox, oy } = layout(), d = window.devicePixelRatio || 1;
    const w = Math.round(r.width * d), h = Math.round(r.height * d);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const x = canvas.getContext('2d');
    x.setTransform(d, 0, 0, d, 0, 0);
    x.clearRect(0, 0, r.width, r.height);
    x.translate(ox, oy);
    const shownPath = result ? result.path.slice(0, shown) : [];
    drawGrid(x, GRID, { cell, policy: policy.map((a, i) => (isFloor(i % GRID.w, Math.floor(i / GRID.w)) ? a : -1)), hover: sel, agent: shownPath.length ? { x: shownPath.at(-1)[0], y: shownPath.at(-1)[1] } : undefined });
    if (shownPath.length > 1) {
      x.strokeStyle = css('--signal', '#ff5a1f');
      x.lineWidth = 3;
      x.beginPath();
      shownPath.forEach(([px, py], i) => x[i ? 'lineTo' : 'moveTo'](px * cell + cell / 2, py * cell + cell / 2));
      x.stroke();
      x.lineWidth = 1;
    }
  }

  function readout() {
    const done = result && shown >= result.path.length;
    $('out').textContent = !result ? 'Press Run to follow the rulebook.' : done ? `${SAY[result.outcome]}.` : 'Walking the rulebook...';
    $('tot').textContent = done ? result.total.toFixed(1) : '0.0';
  }

  function reset() { result = null; shown = 0; running = false; readout(); draw(); }

  function turn(x, y) {
    if (!isFloor(x, y)) return;
    const i = y * GRID.w + x;
    policy = setAction(policy, i, (policy[i] + 1) % 4);
    reset();
  }

  function run() {
    result = runPolicy(GRID, policy);
    last = 0;
    if (reduced()) { shown = result.path.length; running = false; } // no animation: the whole path at once
    else { shown = 1; running = true; wake(); }
    readout(); draw();
  }

  // Animate only while the page is visible and the stage is on screen.
  let onScreen = true, raf = 0;
  const live = () => onScreen && !document.hidden;
  function loop(t) {
    raf = 0;
    if (!live() || !running) return;
    if (t - last >= TICK) {
      last = t;
      shown++;
      if (shown >= result.path.length) { running = false; readout(); }
    }
    draw();
    if (running) raf = requestAnimationFrame(loop);
  }
  function wake() { if (running && live() && !raf) raf = requestAnimationFrame(loop); }
  document.addEventListener('visibilitychange', wake);
  if (typeof IntersectionObserver === 'function') {
    new IntersectionObserver(es => { onScreen = es[es.length - 1].isIntersecting; wake(); }).observe(root);
  }

  function pick(e) {
    const { r, cell, ox, oy } = layout();
    const x = Math.floor((e.clientX - r.left - ox) / cell), y = Math.floor((e.clientY - r.top - oy) / cell);
    if (x < 0 || y < 0 || x >= GRID.w || y >= GRID.h) return;
    sel = { x, y };
    turn(x, y);
  }
  canvas.addEventListener('pointerdown', pick);
  const KEYS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  canvas.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); turn(sel.x, sel.y); return; }
    const k = KEYS[e.key];
    if (!k) return;
    e.preventDefault();
    sel = { x: Math.min(GRID.w - 1, Math.max(0, sel.x + k[0])), y: Math.min(GRID.h - 1, Math.max(0, sel.y + k[1])) };
    draw();
  });
  $('run').addEventListener('click', run);
  window.addEventListener('resize', draw);
  // Redraw when the theme changes, since the grid colours come from CSS tokens.
  new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  if (typeof matchMedia === 'function') matchMedia('(prefers-color-scheme: dark)').addEventListener('change', draw);

  function apply(state) { policy = [...state.policy]; reset(); }

  apply(presets[0].state);
  return { apply };
}
