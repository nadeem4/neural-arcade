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

function paintTreasure(ctx, room, cell, scale) {
  ctx.fillStyle = token('--surface', '#fff');
  for (let y = 0; y < room.h; y++) for (let x = 0; x < room.w; x++) {
    if (room.cells[y][x] !== 'T') continue;
    ctx.beginPath();
    ctx.arc(x * cell + cell / 2, y * cell + cell * 0.58, cell * 0.28 * scale, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintGhost(ctx, path, cell) {
  ctx.strokeStyle = token('--signal', '#ff5a1f');
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  path.forEach((c, i) => ctx[i ? 'lineTo' : 'moveTo'](c.x * cell + cell / 2, c.y * cell + cell / 2));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineWidth = 1;
}

function paintMark(ctx, m, cell) {
  ctx.strokeStyle = token('--signal', '#ff5a1f');
  ctx.lineWidth = 4;
  ctx.strokeRect(m.x * cell + 2, m.y * cell + 2, cell - 4, cell - 4);
  ctx.lineWidth = 1;
}

// opts: { cell, agent, values, policy, hover, tags: [{ x, y, text, tone }],
//         ghost: [{ x, y }] a dashed route line, marks: [{ x, y }] outlined tiles, treasureScale: 0..1 size of a disc on the treasure }
export function drawRoom(ctx, room, opts = {}) {
  const { cell = 48, tags = [], ghost = [], marks = [], treasureScale } = opts;
  drawGrid(ctx, room, opts);
  if (treasureScale !== undefined) paintTreasure(ctx, room, cell, treasureScale);
  if (ghost.length > 1) paintGhost(ctx, ghost, cell);
  for (const m of marks) paintMark(ctx, m, cell);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.round(cell * 0.3)}px sans-serif`;
  for (const t of tags) {
    ctx.fillStyle = tagColor(t.tone, 'TX'.includes(room.cells[t.y][t.x]));
    ctx.fillText(t.text, t.x * cell + cell / 2, t.y * cell + cell * 0.12);
  }
}
