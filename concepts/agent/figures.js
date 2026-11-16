// Three consecutive steps of a seeded run, each a small grid with the real reward. Pure string builder.
import { GRID, ACTIONS } from '../../assets/grid.js';
import { createWorld, autoAct } from './sim.js';
import { mulberry32 } from '../../engine/rng.js';

const C = 22; // cell size in the figure

function miniGrid(pos, ox) {
  let s = '';
  for (let y = 0; y < GRID.h; y++) for (let x = 0; x < GRID.w; x++) {
    const c = GRID.cells[y][x];
    const fill = c === '#' ? 'var(--line)' : c === 'T' ? 'var(--ink)' : c === 'X' ? 'var(--red)' : 'var(--surface)';
    s += `<rect x="${ox + x * C}" y="${y * C}" width="${C}" height="${C}" style="fill:${fill};stroke:var(--line)" stroke-width=".5"/>`;
  }
  return s + `<circle cx="${ox + pos.x * C + C / 2}" cy="${pos.y * C + C / 2}" r="${C * 0.3}" style="fill:var(--signal)"/>`;
}

export function figureHtml(seed = 7) {
  const w = createWorld(seed), rng = mulberry32(seed);
  const gw = GRID.w * C, gap = 20, n = 3, H = GRID.h * C;
  let body = miniGrid(w.pos, 0), cap = '';
  for (let i = 0; i < n; i++) {
    autoAct(w, rng);
    const ox = (i + 1) * (gw + gap);
    body += `<text x="${ox - gap / 2}" y="${H / 2}" font-size="14" text-anchor="middle" style="fill:var(--ink)">&#8594;</text>` + miniGrid(w.pos, ox);
    cap += `${i ? ', ' : ''}step ${i + 1}: ${ACTIONS[w.last.action].name}, reward ${w.last.reward.toFixed(1)}`;
  }
  const W = (n + 1) * gw + n * gap;
  return `<svg viewBox="0 0 ${W} ${H + 24}" role="img" aria-label="Three steps of one run: ${cap}">${body}<text x="${W / 2}" y="${H + 16}" font-size="9" text-anchor="middle" style="fill:var(--ink-2)">${cap}</text></svg>`;
}
