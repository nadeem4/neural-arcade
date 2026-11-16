// Four small grids of a seeded run (start, then three steps), each with the real reward. Pure string builder.
// The grids are svg; the per-step text is HTML underneath so it stays readable on a phone. Drawn on the dark stage, so stage tokens.
import { GRID, ACTIONS } from '../../assets/grid.js';
import { createWorld, autoAct } from './sim.js';
import { mulberry32 } from '../../engine/rng.js';

const C = 22; // cell size in the figure
const PAD = 6;

function miniGrid(pos, ox) {
  let s = '';
  for (let y = 0; y < GRID.h; y++) for (let x = 0; x < GRID.w; x++) {
    const c = GRID.cells[y][x];
    const fill = c === '#' ? 'var(--stage-dim)' : c === 'T' ? 'var(--stage-ink)' : c === 'X' ? 'var(--red)' : 'var(--stage-2)';
    s += `<rect x="${ox + x * C}" y="${y * C}" width="${C}" height="${C}" style="fill:${fill};stroke:var(--stage)" stroke-width="1"/>`;
  }
  return s + `<circle cx="${ox + pos.x * C + C / 2}" cy="${pos.y * C + C / 2}" r="${C * 0.3}" style="fill:var(--signal)"/>`;
}

export function figureHtml(seed = 7) {
  const w = createWorld(), rng = mulberry32(seed);
  const gw = GRID.w * C, gap = 20, n = 3, H = GRID.h * C;
  let body = miniGrid(w.pos, 0), steps = '', cap = '';
  for (let i = 0; i < n; i++) {
    autoAct(w, rng);
    const ox = (i + 1) * (gw + gap);
    body += `<path d="M${ox - gap + 4} ${H / 2} h${gap - 8} m-4 -3 l4 3 l-4 3" style="fill:none;stroke:var(--stage-ink)" stroke-width="1.5"/>` + miniGrid(w.pos, ox);
    const t = `${ACTIONS[w.last.action].name}, reward ${w.last.reward.toFixed(1)}`;
    cap += `${i ? ', ' : ''}step ${i + 1}: ${t}`;
    steps += `<li>${t}</li>`;
  }
  const W = (n + 1) * gw + n * gap;
  return `<svg viewBox="${-PAD} ${-PAD} ${W + 2 * PAD} ${H + 2 * PAD}" role="img" aria-label="Three steps of one run: ${cap}">${body}</svg>`
    + `<ol class="steps" style="margin:0;padding:10px 12px 0 32px;font-size:14px;color:var(--stage-ink)">${steps}</ol>`;
}
