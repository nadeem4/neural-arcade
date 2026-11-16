// A seeded 20-day weather walk as a strip of days, and the odds table. HTML on the dark stage, so stage tokens.
import { mulberry32 } from '../../engine/rng.js';
import { MDP, walk } from './sim.js';

const FILL = { Sunny: 'var(--signal)', Cloudy: 'var(--stage-dim)', Rainy: 'var(--red)' };
const pct = p => `${Math.round(p * 100)}%`;

export function figureHtml(seed = 3) {
  const days = walk(MDP, 'Sunny', 20, mulberry32(seed));
  const strip = days.map(s => `<span class="day" role="img" aria-label="${s}" style="display:inline-block;width:28px;height:28px;line-height:28px;text-align:center;border-radius:6px;font-size:14px;font-weight:700;color:var(--stage);background:${FILL[s]}">${s[0]}</span>`).join('');
  const cell = 'padding:6px 10px;text-align:right;font-size:14px;color:var(--stage-ink)';
  const head = MDP.states.map(s => `<th style="${cell}">to ${s}</th>`).join('');
  const rows = MDP.states.map(from => `<tr><th style="${cell};text-align:left">from ${from}</th>${MDP.moves[from].map(r => `<td style="${cell}">${pct(r.p)}</td>`).join('')}</tr>`).join('');
  return `<div style="padding:16px"><p style="margin:0 0 8px;font-size:14px;color:var(--stage-ink)">Twenty days, starting sunny (S sunny, C cloudy, R rainy)</p>`
    + `<div style="display:flex;flex-wrap:wrap;gap:4px">${strip}</div>`
    + `<table style="margin-top:16px;border-collapse:collapse"><thead><tr><th></th>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
}
