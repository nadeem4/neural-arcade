// The same grid at two discounts, with each cell's real value. svg grids, plus HTML text under them so it stays readable on a phone.
// Drawn on the dark stage, so stage tokens.
import { GRID } from '../../assets/grid.js';
import { valuesFor, shadeOf } from './sim.js';

const C = 40, PAD = 6;
const isFloor = (x, y) => !'TX#'.includes(GRID.cells[y][x]);

function miniGrid(gamma) {
  const v = valuesFor(GRID, gamma), floor = v.filter((_, i) => isFloor(i % GRID.w, Math.floor(i / GRID.w)));
  const lo = Math.min(...floor), hi = Math.max(...floor);
  const label = (px, py, t, fill) => `<text x="${px + C / 2}" y="${py + C / 2}" text-anchor="middle" dominant-baseline="central" font-size="13" style="fill:${fill}">${t}</text>`;
  let s = '';
  for (let y = 0; y < GRID.h; y++) for (let x = 0; x < GRID.w; x++) {
    const c = GRID.cells[y][x], px = x * C, py = y * C;
    const fill = c === '#' ? 'var(--stage-dim)' : c === 'T' ? 'var(--stage-ink)' : c === 'X' ? 'var(--red)' : 'var(--stage-2)';
    s += `<rect x="${px}" y="${py}" width="${C}" height="${C}" style="fill:${fill};stroke:var(--stage)" stroke-width="1"/>`;
    if (isFloor(x, y)) {
      const id = y * GRID.w + x;
      s += `<rect x="${px}" y="${py}" width="${C}" height="${C}" style="fill:var(--signal)" fill-opacity="${(0.6 * shadeOf(v[id], lo, hi)).toFixed(2)}"/>` + label(px, py, v[id].toFixed(1), 'var(--stage-ink)');
    } else if (c === 'T' || c === 'X') {
      s += label(px, py, c, c === 'T' ? 'var(--stage)' : 'var(--stage-ink)');
    }
  }
  return s;
}

export function figureHtml() {
  const W = GRID.w * C, H = GRID.h * C;
  const items = [0.3, 0.95].map(g => {
    const start = valuesFor(GRID, g)[0].toFixed(1);
    return `<div><svg viewBox="${-PAD} ${-PAD} ${W + 2 * PAD} ${H + 2 * PAD}" role="img" aria-label="Cell values at discount ${g}, start cell ${start}">${miniGrid(g)}</svg>`
      + `<p style="margin:0;padding:6px 4px 0;font-size:14px;color:var(--stage-ink)"><b>Discount ${g}</b><br>The start cell is worth ${start}</p></div>`;
  }).join('');
  return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;padding:16px">${items}</div>`;
}
