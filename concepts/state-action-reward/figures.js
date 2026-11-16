// One cell with its four actions and the reward each gives, straight from describeCell. Colours are theme tokens.
import { GRID, ACTIONS } from '../../assets/grid.js';
import { describeCell } from './sim.js';

const ARROWS = ['&#8593;', '&#8595;', '&#8592;', '&#8594;'];

export function figureHtml(pos = { x: 1, y: 0 }) {
  const d = describeCell(GRID, pos);
  const at = [[180, 34], [180, 166], [64, 100], [296, 100]]; // up, down, left, right label centres
  const lab = d.options.map(o => `${ACTIONS[o.action].name} ${o.reward.toFixed(1)}`).join(', ');
  const t = d.options.map((o, i) => `<text x="${at[i][0]}" y="${at[i][1]}" text-anchor="middle" font-size="15" style="fill:var(--ink)">${ARROWS[i]} ${o.reward.toFixed(1)}</text>`).join('');
  return `<svg viewBox="0 0 360 200" role="img" aria-label="State ${d.state} with four actions and their rewards: ${lab}">`
    + `<rect x="130" y="62" width="100" height="76" rx="8" style="fill:var(--surface);stroke:var(--line)" stroke-width="2"/>`
    + `<text x="180" y="96" text-anchor="middle" font-size="16" font-weight="700" style="fill:var(--ink)">State ${d.state}</text>`
    + `<text x="180" y="118" text-anchor="middle" font-size="12" style="fill:var(--ink-2)">cell (${pos.x},${pos.y})</text>`
    + t + `</svg>`;
}
