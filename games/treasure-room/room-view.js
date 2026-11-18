// Treasure Room drawing: the shared grid from assets/grid.js, plus floating reward tags, and tap-to-cell.
import { drawGrid } from '../../assets/grid.js';

export const cellAt = (size, room, px, py) => {
  if (px < 0 || py < 0 || px >= size || py >= size) return null;
  const cell = size / room.w;
  return { x: Math.floor(px / cell), y: Math.floor(py / cell) };
};

export const tagTone = reward => (reward > 0 ? 'good' : reward <= -10 ? 'bad' : 'step');

const token = (name, fallback) => {
  try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback; }
  catch { return fallback; }
};

// Tags sit on a white tile: step is the muted ink, bad the red token; no green token exists, so good keeps a dark green (as in grid.js).
// On the treasure or pit tile the tag is plain ink, because green or red text would vanish on a green or red tile.
const tagColor = (tone, onEnd) => {
  if (onEnd) return token('--ink', '#222');
  return tone === 'good' ? '#1b7a37' : tone === 'bad' ? token('--red', '#e5533f') : token('--ink-2', '#4a515b');
};

// opts: { cell, agent, values, policy, hover, tags: [{ x, y, text, tone }] }
export function drawRoom(ctx, room, opts = {}) {
  const { cell = 48, tags = [] } = opts;
  drawGrid(ctx, room, opts);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.round(cell * 0.3)}px sans-serif`;
  for (const t of tags) {
    ctx.fillStyle = tagColor(t.tone, 'TX'.includes(room.cells[t.y][t.x]));
    ctx.fillText(t.text, t.x * cell + cell / 2, t.y * cell + cell * 0.12);
  }
}
