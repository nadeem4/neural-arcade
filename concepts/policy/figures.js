// The three rulebooks as small grids with the path each one walks. The grids are svg; the outcome and
// total are HTML underneath so they stay readable on a phone. Drawn on the dark stage, so stage tokens.
import { GRID } from '../../assets/grid.js';
import { RULEBOOKS } from './rulebooks.js';

const C = 28, PAD = 6;
const WORDS = { loop: 'Went round in circles', pit: 'Fell in the pit', treasure: 'Reached the treasure', timeout: 'Ran out of steps' };

function miniGrid({ path }) {
  let s = '';
  for (let y = 0; y < GRID.h; y++) for (let x = 0; x < GRID.w; x++) {
    const c = GRID.cells[y][x];
    const fill = c === '#' ? 'var(--stage-dim)' : c === 'T' ? 'var(--stage-ink)' : c === 'X' ? 'var(--red)' : 'var(--stage-2)';
    s += `<rect x="${x * C}" y="${y * C}" width="${C}" height="${C}" style="fill:${fill};stroke:var(--stage)" stroke-width="1"/>`;
  }
  const pts = path.map(([x, y]) => `${x * C + C / 2},${y * C + C / 2}`).join(' ');
  const [ex, ey] = path.at(-1);
  return s + `<polyline points="${pts}" style="fill:none;stroke:var(--signal)" stroke-width="3" stroke-linejoin="round"/>`
    + `<circle cx="${ex * C + C / 2}" cy="${ey * C + C / 2}" r="${C * 0.25}" style="fill:var(--signal)"/>`;
}

export function figureHtml() {
  const W = GRID.w * C, H = GRID.h * C;
  const items = RULEBOOKS.map(r => {
    const word = WORDS[r.result.outcome];
    return `<div><svg viewBox="${-PAD} ${-PAD} ${W + 2 * PAD} ${H + 2 * PAD}" role="img" aria-label="${r.label}: ${word}, total ${r.result.total.toFixed(1)}">${miniGrid(r.result)}</svg>`
      + `<p style="margin:0;padding:6px 4px 0;font-size:14px;color:var(--stage-ink)"><b>${r.label}</b><br>${word}, total ${r.result.total.toFixed(1)}</p></div>`;
  }).join('');
  return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:16px;padding:16px">${items}</div>`;
}
