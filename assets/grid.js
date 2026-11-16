// A tiny deterministic grid world shared by the concept pages (agent, reward, value, policy).
// Rewards match the maze game; copied, not imported, so pages never depend on games/*.

export const ACTIONS = [
  { name: 'up', dx: 0, dy: -1 },
  { name: 'down', dx: 0, dy: 1 },
  { name: 'left', dx: -1, dy: 0 },
  { name: 'right', dx: 1, dy: 0 },
];

export const REWARD = { treasure: 10, pit: -10, step: -0.1 };

// S start, T treasure, X pit, # wall, . floor
export function makeGrid(rows) {
  const w = rows[0].length;
  if (rows.some(r => r.length !== w)) throw new Error('ragged grid rows');
  if (!rows.some(r => r.includes('S'))) throw new Error('grid needs an S');
  return { w, h: rows.length, cells: rows.map(r => r.split('')) };
}

// Row 0 runs straight through the pit (short, tempting); the best route drops to row 1 and goes round.
export const GRID = makeGrid([
  'S.X.T',
  '.....',
  '.###.',
  '.....',
]);

export const stateId = (grid, pos) => pos.y * grid.w + pos.x;

export function move(grid, pos, actionIndex) {
  const a = ACTIONS[actionIndex];
  const x = pos.x + a.dx, y = pos.y + a.dy;
  const blocked = x < 0 || y < 0 || x >= grid.w || y >= grid.h || grid.cells[y][x] === '#';
  if (blocked) return { pos: { x: pos.x, y: pos.y }, reward: REWARD.step, done: false };
  const c = grid.cells[y][x];
  if (c === 'T') return { pos: { x, y }, reward: REWARD.treasure, done: true };
  if (c === 'X') return { pos: { x, y }, reward: REWARD.pit, done: true };
  return { pos: { x, y }, reward: REWARD.step, done: false };
}

const isFloor = (grid, x, y) => !'TX#'.includes(grid.cells[y][x]);

// Best discounted value of acting from each cell; walls, treasure and pit stay 0.
export function valueIteration(grid, gamma, sweeps = 100) {
  const v = new Array(grid.w * grid.h).fill(0);
  for (let i = 0; i < sweeps; i++) {
    for (let y = 0; y < grid.h; y++) for (let x = 0; x < grid.w; x++) {
      if (!isFloor(grid, x, y)) continue;
      let best = -Infinity;
      for (let a = 0; a < ACTIONS.length; a++) {
        const r = move(grid, { x, y }, a);
        best = Math.max(best, r.reward + (r.done ? 0 : gamma * v[stateId(grid, r.pos)]));
      }
      v[stateId(grid, { x, y })] = best;
    }
  }
  return v;
}

// Best action per cell (index into ACTIONS); -1 for walls, treasure and pit.
export function greedyPolicy(grid, values, gamma) {
  const pol = new Array(grid.w * grid.h).fill(-1);
  for (let y = 0; y < grid.h; y++) for (let x = 0; x < grid.w; x++) {
    if (!isFloor(grid, x, y)) continue;
    let best = -Infinity;
    for (let a = 0; a < ACTIONS.length; a++) {
      const r = move(grid, { x, y }, a);
      const q = r.reward + (r.done ? 0 : gamma * values[stateId(grid, r.pos)]);
      if (q > best + 1e-9) { best = q; pol[stateId(grid, { x, y })] = a; }
    }
  }
  return pol;
}

const css = (name, fallback) => {
  try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback; }
  catch { return fallback; }
};

const ARROWS = ['↑', '↓', '←', '→'];

// opts: { cell, agent:{x,y}, values:number[], policy:number[], hover:{x,y} }
export function drawGrid(ctx, grid, opts = {}) {
  const { cell = 48, agent, values, policy, hover } = opts;
  const ink = css('--ink', '#222'), line = css('--line', '#888'), bg = css('--surface', '#fff');
  const good = css('--good', '#2a9d4b'), bad = css('--bad', '#d64545'), accent = css('--accent', '#3b6fd4');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let y = 0; y < grid.h; y++) for (let x = 0; x < grid.w; x++) {
    const c = grid.cells[y][x], px = x * cell, py = y * cell;
    ctx.fillStyle = c === '#' ? line : c === 'T' ? good : c === 'X' ? bad : bg;
    ctx.fillRect(px, py, cell, cell);
    ctx.strokeStyle = line;
    ctx.strokeRect(px, py, cell, cell);
    if (hover && hover.x === x && hover.y === y) {
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3;
      ctx.strokeRect(px + 1.5, py + 1.5, cell - 3, cell - 3);
      ctx.lineWidth = 1;
    }
    ctx.fillStyle = ink;
    ctx.font = `${Math.round(cell * 0.3)}px sans-serif`;
    if (c === 'T' || c === 'X' || c === 'S') ctx.fillText(c, px + cell / 2, py + cell * 0.25);
    if (isFloor(grid, x, y)) {
      const id = stateId(grid, { x, y });
      if (values) ctx.fillText(values[id].toFixed(1), px + cell / 2, py + cell * 0.8);
      if (policy && policy[id] >= 0) {
        ctx.font = `${Math.round(cell * 0.4)}px sans-serif`;
        ctx.fillText(ARROWS[policy[id]], px + cell / 2, py + cell * 0.5);
      }
    }
  }
  if (agent) {
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(agent.x * cell + cell / 2, agent.y * cell + cell / 2, cell * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }
}
