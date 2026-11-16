// The value playground: each cell shows how much reward the agent can expect from there. Slide the discount, pick a floor cell to move the treasure.
import { GRID, drawGrid } from '../../assets/grid.js';
import { valuesFor, shadeOf, moveTreasure } from './sim.js';

export const presets = [
  { label: 'Near-sighted', text: 'Discount 0.3: only cells right beside the treasure look worth anything. The start cell is worth about nothing.', state: { gamma: 0.3 } },
  { label: 'Far-sighted', text: 'Discount 0.95: the treasure glows from far away, so even the start cell is worth over 7.', state: { gamma: 0.95 } },
  { label: 'Move the treasure', text: 'The treasure is now bottom-left: the glow moves with it, and the cells beside it gain value.', state: { gamma: 0.9, treasure: [0, 3] } },
];

const isFloor = (g, x, y) => !'TX#'.includes(g.cells[y][x]);
const css = (n, f) => { try { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || f; } catch { return f; } };

export function mountPlayground(root) {
  root.innerHTML = `
    <div class="stage-head"><span><b>Each number is what the agent can expect from that cell. Click a floor cell to move the treasure</b></span></div>
    <div class="views one">
      <canvas role="img" tabindex="0" data-r="world" aria-label="A grid where each cell shows its value. Use the arrow keys to pick a cell and Enter or Space to move the treasure there."></canvas>
    </div>
    <div class="dials one">
      <div class="dial"><label for="val-gamma">Discount <b class="num" data-r="gv">0.90</b></label>
        <input id="val-gamma" data-r="gamma" type="range" min="0" max="0.99" step="0.01" value="0.9">
        <span class="say">how much far-off reward still counts</span></div>
    </div>
    <div class="stage-foot"><span class="sum" aria-live="polite" data-r="sum"></span></div>`;
  const $ = n => root.querySelector(`[data-r="${n}"]`);
  const canvas = $('world'), slider = $('gamma');
  let grid = GRID, sel = { x: 0, y: 0 };

  const layout = () => {
    const r = canvas.getBoundingClientRect();
    const cell = Math.floor(Math.min((r.width - 16) / grid.w, (r.height - 16) / grid.h));
    return { r, cell, ox: (r.width - cell * grid.w) / 2, oy: (r.height - cell * grid.h) / 2 };
  };

  function draw() {
    const { r, cell, ox, oy } = layout(), d = window.devicePixelRatio || 1;
    const w = Math.round(r.width * d), h = Math.round(r.height * d);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const x = canvas.getContext('2d');
    x.setTransform(d, 0, 0, d, 0, 0);
    x.clearRect(0, 0, r.width, r.height);
    x.translate(ox, oy);
    const v = valuesFor(grid, Number(slider.value));
    drawGrid(x, grid, { cell, values: v, hover: sel });
    // heat: a translucent wash over each floor cell, stronger for higher value
    const floor = v.filter((_, i) => isFloor(grid, i % grid.w, Math.floor(i / grid.w)));
    const lo = Math.min(...floor), hi = Math.max(...floor);
    x.fillStyle = css('--signal', '#ff5a1f');
    for (let j = 0; j < grid.h; j++) for (let i = 0; i < grid.w; i++) {
      if (!isFloor(grid, i, j)) continue;
      x.globalAlpha = 0.3 * shadeOf(v[j * grid.w + i], lo, hi);
      x.fillRect(i * cell + 1, j * cell + 1, cell - 2, cell - 2);
    }
    x.globalAlpha = 1;
    $('sum').textContent = `Start cell is worth ${v[0].toFixed(1)}`;
  }

  function render() { $('gv').textContent = Number(slider.value).toFixed(2); draw(); }

  function put(x, y) {
    if (x < 0 || y < 0 || x >= grid.w || y >= grid.h) return;
    sel = { x, y };
    try { grid = moveTreasure(grid, [x, y]); } catch { /* wall, pit or start: the treasure stays */ }
    draw();
  }
  canvas.addEventListener('pointerdown', e => {
    const { r, cell, ox, oy } = layout();
    put(Math.floor((e.clientX - r.left - ox) / cell), Math.floor((e.clientY - r.top - oy) / cell));
  });
  const KEYS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  canvas.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); put(sel.x, sel.y); return; }
    const k = KEYS[e.key];
    if (!k) return;
    e.preventDefault();
    sel = { x: Math.min(grid.w - 1, Math.max(0, sel.x + k[0])), y: Math.min(grid.h - 1, Math.max(0, sel.y + k[1])) };
    draw();
  });
  slider.addEventListener('input', render);
  window.addEventListener('resize', draw);
  // Redraw when the theme changes, since the grid colours come from CSS tokens.
  new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  if (typeof matchMedia === 'function') matchMedia('(prefers-color-scheme: dark)').addEventListener('change', draw);

  function apply(state) {
    grid = state.treasure ? moveTreasure(GRID, state.treasure) : GRID;
    slider.value = state.gamma;
    render();
  }

  // No animation loop: it redraws only on input, so nothing runs while hidden.
  apply(presets[1].state);
  return { apply };
}
