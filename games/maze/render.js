// Draws Treasure Maze's grid: shaded values, arrows for the policy, the robot and its trail. Pure helpers are exported for tests.

// A value as opacity: 0 at or below zero, 1 at vmax.
export const shade = (v, vmax = 10) => Math.min(1, Math.max(0, v / vmax));

export const arrowFor = action => '↑↓←→'[action];

// Square tiles, the whole grid centred in a w by h canvas.
export function tileRect(map, s, w, h) {
  const size = Math.min(w / map.nCols, h / map.nRows);
  const x0 = (w - size * map.nCols) / 2, y0 = (h - size * map.nRows) / 2;
  return { x: x0 + (s % map.nCols) * size, y: y0 + Math.floor(s / map.nCols) * size, size };
}

// Trailing mean over the last `window` values, same length as the input.
export function smooth(values, window = 20) {
  let sum = 0;
  return values.map((v, i) => {
    sum += v;
    if (i >= window) sum -= values[i - window];
    return sum / Math.min(i + 1, window);
  });
}

const LABEL = { big: '+10', small: '+3', pit: '-10' };

// showFour and q are for the four-values view (M4); ignored for now.
export function drawMaze(ctx, theme, { map, values, policy, robot, trail = [], w, h }) {
  ctx.save();
  const size = tileRect(map, 0, w, h).size;
  ctx.font = `600 ${Math.round(size * 0.34)}px ${theme.body}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let s = 0; s < map.nStates; s++) {
    const { x, y } = tileRect(map, s, w, h), kind = map.cells[s] === '#' ? 'wall' : { T: 'big', N: 'small', P: 'pit' }[map.cells[s]] || 'floor';
    ctx.fillStyle = theme.tray; ctx.fillRect(x, y, size, size);
    if (kind === 'wall') { ctx.fillStyle = theme.ink; ctx.fillRect(x, y, size, size); }
    else if (kind === 'pit') { ctx.fillStyle = theme.red; ctx.fillRect(x, y, size, size); }
    else if (kind === 'big' || kind === 'small') { ctx.globalAlpha = kind === 'big' ? 1 : 0.5; ctx.fillStyle = theme.amber; ctx.fillRect(x, y, size, size); ctx.globalAlpha = 1; }
    else if (values) { ctx.globalAlpha = shade(values[s]); ctx.fillStyle = theme.amber; ctx.fillRect(x, y, size, size); ctx.globalAlpha = 1; }
    ctx.strokeStyle = theme.rule; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
    if (LABEL[kind]) { ctx.fillStyle = kind === 'pit' ? theme.ground : theme['amber-ink']; ctx.fillText(LABEL[kind], x + size / 2, y + size / 2); }
    if (policy?.[s] != null) { ctx.fillStyle = shade(values?.[s] ?? 0) > 0.3 ? theme.ink : theme.ground; ctx.fillText(arrowFor(policy[s]), x + size / 2, y + size / 2); }
  }
  if (trail.length > 1) {
    ctx.strokeStyle = theme.ink; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.beginPath();
    trail.forEach((s, i) => { const r = tileRect(map, s, w, h); if (i) ctx.lineTo(r.x + size / 2, r.y + size / 2); else ctx.moveTo(r.x + size / 2, r.y + size / 2); });
    ctx.stroke();
  }
  if (robot != null) {
    const r = tileRect(map, robot, w, h);
    ctx.fillStyle = theme.ink; ctx.beginPath(); ctx.arc(r.x + size / 2, r.y + size / 2, size * 0.22, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = theme.ground; ctx.lineWidth = 2; ctx.stroke();
  }
  ctx.restore();
}
