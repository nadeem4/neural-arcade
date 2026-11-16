// The state, action, reward playground: hover (or tap) a cell to see its state id, four actions and each reward.
import { GRID, ACTIONS, drawGrid } from '../../assets/grid.js';
import { describeCell } from './sim.js';

export const presets = [
  { label: 'Pick cell', text: 'Hover or tap any cell. Each cell is one state, and it has its own id.', state: { hover: [1, 1] } },
  { label: 'Look next to the pit', text: 'Right here, moving right drops you in the pit: that one action pays minus 10.', state: { hover: [1, 0] } },
  { label: 'Look next to the treasure', text: 'Right here, moving right lands on the treasure: that one action pays 10.', state: { hover: [3, 0] } },
];

const ARROWS = ['↑', '↓', '←', '→'];

export function mountPlayground(root) {
  root.innerHTML = `
    <div class="stage-head"><span><b>Hover or tap a cell to read its state, actions and rewards</b></span></div>
    <div class="views">
      <canvas role="img" data-r="world" aria-label="A grid with a start, a treasure worth 10, a pit worth minus 10, and walls. Hover or tap a cell to inspect it."></canvas>
      <div class="readout" aria-live="polite"><div data-r="info"></div></div>
    </div>`;
  const $ = n => root.querySelector(`[data-r="${n}"]`);
  const canvas = $('world'), info = $('info');
  let hover = null;

  const layout = () => {
    const r = canvas.getBoundingClientRect();
    const cell = Math.floor(Math.min((r.width - 16) / GRID.w, (r.height - 16) / GRID.h));
    return { r, cell, ox: (r.width - cell * GRID.w) / 2, oy: (r.height - cell * GRID.h) / 2 };
  };

  function readout() {
    if (!hover) { info.innerHTML = '<p>Point at a cell.</p>'; return; }
    const c = GRID.cells[hover.y][hover.x];
    if (c === '#') { info.innerHTML = '<span class="who">Wall</span><p>The agent can never stand here.</p>'; return; }
    const d = describeCell(GRID, hover);
    const end = c === 'T' ? 'Treasure: the episode ends here.' : c === 'X' ? 'Pit: the episode ends here.' : '';
    info.innerHTML = `<span class="who">State ${d.state}</span><p>Cell (${hover.x},${hover.y}). ${end || 'Four actions, four rewards:'}</p>`
      + (end ? '' : `<ul class="opts">${d.options.map(o => `<li><b>${ARROWS[o.action]} ${ACTIONS[o.action].name}</b> <span class="num">${o.reward > 0 ? '+' : ''}${o.reward.toFixed(1)}</span></li>`).join('')}</ul>`);
  }

  function draw() {
    const { r, cell, ox, oy } = layout(), d = window.devicePixelRatio || 1;
    const w = Math.round(r.width * d), h = Math.round(r.height * d);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const x = canvas.getContext('2d');
    x.setTransform(d, 0, 0, d, 0, 0);
    x.clearRect(0, 0, r.width, r.height);
    x.translate(ox, oy);
    drawGrid(x, GRID, { cell, hover: hover || undefined });
  }

  function pick(e) {
    const { r, cell, ox, oy } = layout();
    const x = Math.floor((e.clientX - r.left - ox) / cell), y = Math.floor((e.clientY - r.top - oy) / cell);
    hover = x >= 0 && y >= 0 && x < GRID.w && y < GRID.h ? { x, y } : null;
    readout(); draw();
  }
  canvas.addEventListener('pointermove', pick);
  canvas.addEventListener('pointerdown', pick); // tap on touch
  window.addEventListener('resize', draw);

  function apply(state) {
    hover = { x: state.hover[0], y: state.hover[1] };
    readout(); draw();
  }

  // No animation loop: drawing happens only on input or resize, so nothing runs while hidden.
  apply(presets[0].state);
  return { apply };
}
