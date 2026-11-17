// The round minimap: the route so far, the taxi, a dot for each fine and a flag at the drop-off. The model is pure
// (unit coordinates); drawMinimap only calls canvas methods.
const PAD = 0.1;
const FINES = ['red', 'wrong', 'off'];

// `f` is the step index as a float. The view is fitted to the whole route once, so it never rescales mid-drive.
// A race passes both routes as fitRoutes so the two models share one view.
export function minimapModel(world, route, f, events, fitRoutes = [route]) {
  const at = (cell) => [cell % world.cols, Math.floor(cell / world.cols)];
  const all = [...fitRoutes.flatMap((r) => r.cells), world.goal].map(at);
  const xs = all.map((p) => p[0]), ys = all.map((p) => p[1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys), span = Math.max(1, Math.max(...xs) - x0, Math.max(...ys) - y0);
  const k = (1 - 2 * PAD) / span;
  const cx = 0.5 - ((Math.max(...xs) - x0) * k) / 2, cy = 0.5 - ((Math.max(...ys) - y0) * k) / 2;
  const unit = (cell) => { const [c, r] = at(cell); return { x: cx + (c - x0) * k, y: cy + (r - y0) * k }; };

  const last = route.cells.length - 1;
  const whole = Math.min(last, Math.max(0, Math.floor(f)));
  const points = route.cells.slice(0, whole + 1).map(unit);
  const a = points[whole], b = whole < last ? unit(route.cells[whole + 1]) : a;
  const u = Math.max(0, Math.min(1, f - whole));
  const taxi = u === 0 || a === b ? a : { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
  const dots = [];
  for (const s of events.steps.slice(0, whole)) {
    const kind = FINES.find((l) => s.lines.includes(l));
    if (kind) dots.push({ kind, ...unit(s.cell) });
  }
  return { points, taxi, dots, flag: unit(world.goal) };
}

export const COLOURS_B = { route: '#FF7AB6', taxi: '#E8589C', fine: '#FF9A6B', flag: '#8FE3A1' };
const COLOURS = { route: '#5BC0EB', taxi: '#F5B820', fine: '#FF9A6B', flag: '#8FE3A1' };

// clear:false draws over what is there, for the second car of a race.
export function drawMinimap(ctx, model, size, colours = COLOURS, { clear = true } = {}) {
  const px = (p) => [p.x * size, p.y * size];
  if (clear) ctx.clearRect(0, 0, size, size);
  if (model.points.length > 1) {
    ctx.beginPath();
    ctx.moveTo(...px(model.points[0]));
    for (let i = 1; i < model.points.length; i++) ctx.lineTo(...px(model.points[i]));
    ctx.strokeStyle = colours.route; ctx.lineWidth = Math.max(2, size / 40); ctx.lineJoin = 'round'; ctx.stroke();
  }
  ctx.fillStyle = colours.flag;
  const [fx, fy] = px(model.flag);
  ctx.fillRect(fx - size / 40, fy - size / 12, size / 20, size / 12);
  for (const d of model.dots) {
    ctx.beginPath(); ctx.arc(...px(d), size / 36, 0, Math.PI * 2); ctx.fillStyle = colours.fine; ctx.fill();
  }
  ctx.beginPath(); ctx.arc(...px(model.taxi), size / 22, 0, Math.PI * 2); ctx.fillStyle = colours.taxi; ctx.fill();
}
