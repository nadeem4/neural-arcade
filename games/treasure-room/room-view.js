// Treasure Room drawing: the shared grid from assets/grid.js, plus floating reward tags, and tap-to-cell.
import { drawGrid } from '../../assets/grid.js';

export const cellAt = (size, room, px, py) => {
  if (px < 0 || py < 0 || px >= size || py >= size) return null;
  const cell = size / room.w;
  return { x: Math.floor(px / cell), y: Math.floor(py / cell) };
};

export const tagTone = reward => (reward > 0 ? 'good' : reward <= -10 ? 'bad' : 'step');

const TONE = { good: '#2a9d4b', bad: '#e5533f', step: '#888' };

// opts: { cell, agent, values, policy, hover, tags: [{ x, y, text, tone }] }
export function drawRoom(ctx, room, opts = {}) {
  const { cell = 48, tags = [] } = opts;
  drawGrid(ctx, room, opts);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.round(cell * 0.3)}px sans-serif`;
  for (const t of tags) {
    ctx.fillStyle = TONE[t.tone] ?? TONE.step;
    ctx.fillText(t.text, t.x * cell + cell / 2, t.y * cell + cell * 0.12);
  }
}
