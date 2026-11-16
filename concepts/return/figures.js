// The same reward row at three discounts, with the exact return of each. Colours are theme tokens.
import { REWARDS, discounted, returnOf } from './sim.js';

const ROWS = [1, 0.9, 0.5];

export function figureHtml() {
  const bars = ROWS.map((g, row) => {
    const top = 4 + row * 96, base = top + 84;
    const label = `<text x="20" y="${top + 16}" font-size="14" font-weight="700" style="fill:var(--stage-ink)">Discount ${g}: return ${returnOf(REWARDS, g).toFixed(2)}</text>`;
    const rects = discounted(REWARDS, g).map((v, t) => {
      const x = 33 + t * 38, h = Math.max(v * 5, 0.5);
      return `<rect x="${x}" y="${base - 50}" width="28" height="50" rx="3" style="fill:var(--stage-2)"/>`
        + `<rect x="${x}" y="${base - h}" width="28" height="${h}" rx="3" style="fill:var(--signal)"/>`;
    }).join('');
    return label + rects;
  }).join('');
  const sums = ROWS.map(g => `discount ${g} gives ${returnOf(REWARDS, g).toFixed(2)}`).join(', ');
  return `<svg viewBox="0 0 360 296" role="img" aria-label="The same row of eight rewards at three discounts: ${sums}">${bars}</svg>`;
}
