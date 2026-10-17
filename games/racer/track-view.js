// Draws the tray, the road and the cars. Shared by the game page and the arcade home preview.
import { WORLD_W, WORLD_H, SENSOR_ANGLES, RAY_MAX } from './sim.js';

const pathCache = new WeakMap();
function roadPath(track) {
  let p = pathCache.get(track);
  if (!p) {
    p = new Path2D();
    track.pts.forEach((pt, i) => (i ? p.lineTo(pt.x, pt.y) : p.moveTo(pt.x, pt.y)));
    p.closePath();
    pathCache.set(track, p);
  }
  return p;
}

export function sizeCanvas(canvas, ratio) {
  const dpr = window.devicePixelRatio || 1, w = canvas.clientWidth, h = ratio ? w * ratio : canvas.clientHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  return { dpr, w, h };
}

// `focus` zooms the camera onto a point (follow-leader mode); with `focus.heading` it also turns the world so that
// heading points up the screen, with the point low in the frame (a driver's view). `tags` label cars by name ([{ car, text }]).
export function drawTrack(ctx, race, leader, theme, { scale, dpr, sensors = true, focus = null, tags = [] }) {
  const track = race.track, path = roadPath(track);
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  if (focus && focus.heading !== undefined) {
    const k = scale * dpr * focus.zoom, cw = WORLD_W * scale * dpr, ch = WORLD_H * scale * dpr;
    ctx.fillStyle = theme.tray; ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    const a = -focus.heading - Math.PI / 2, cos = Math.cos(a) * k, sin = Math.sin(a) * k;
    // Rotate and zoom about the point, then place it in the middle, 70% of the way down.
    ctx.setTransform(cos, sin, -sin, cos, cw / 2 - (cos * focus.x - sin * focus.y), ch * 0.7 - (sin * focus.x + cos * focus.y));
    ctx.fillStyle = theme.tray; ctx.fillRect(-WORLD_W, -WORLD_H, WORLD_W * 3, WORLD_H * 3);
  } else if (focus) {
    const k = scale * dpr * focus.zoom, cw = WORLD_W * scale * dpr, ch = WORLD_H * scale * dpr;
    const clamp = (v, lo) => Math.min(0, Math.max(lo, v));
    ctx.fillStyle = theme.tray; ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    ctx.setTransform(k, 0, 0, k, clamp(cw / 2 - focus.x * k, cw - WORLD_W * k), clamp(ch / 2 - focus.y * k, ch - WORLD_H * k));
  }
  ctx.fillStyle = theme.tray;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.lineWidth = track.width; ctx.strokeStyle = theme.road; ctx.stroke(path);

  // Road edges as dashed chalk lines, drawn by stroking wider and masking the middle.
  ctx.save();
  ctx.lineWidth = track.width + 3; ctx.strokeStyle = theme.edge; ctx.setLineDash([2, 7]); ctx.stroke(path);
  ctx.setLineDash([]); ctx.lineWidth = track.width - 3; ctx.strokeStyle = theme.road; ctx.stroke(path);
  ctx.restore();

  // Start line across the road.
  const p0 = track.pts[0], nx = -Math.sin(track.startAngle), ny = Math.cos(track.startAngle), hw = track.width / 2;
  ctx.lineCap = 'butt'; ctx.lineWidth = 3; ctx.strokeStyle = theme.ink;
  ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(p0.x - nx * hw, p0.y - ny * hw); ctx.lineTo(p0.x + nx * hw, p0.y + ny * hw); ctx.stroke();
  ctx.setLineDash([]);

  // Out of the race first, then the field, then the leader on top.
  for (const c of race.cars) if (!c.alive && c !== leader) drawCar(ctx, c, theme, c.kind === 'ghost' ? 'ghost' : c.finished ? 'finished' : c.crashed ? 'crashed' : 'stalled');
  for (const c of race.cars) if (c.alive && c !== leader) drawCar(ctx, c, theme, c.kind);
  if (leader) {
    if (sensors && leader.alive) {
      ctx.lineCap = 'round'; ctx.lineWidth = 1.2; ctx.strokeStyle = theme.amber; ctx.fillStyle = theme.amber;
      ctx.globalAlpha = 0.8;
      for (let s = 0; s < 5; s++) {
        const a = leader.angle + SENSOR_ANGLES[s], d = leader.acts[0][s] * RAY_MAX;
        const ex = leader.x + Math.cos(a) * d, ey = leader.y + Math.sin(a) * d;
        ctx.beginPath(); ctx.moveTo(leader.x, leader.y); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.fillRect(ex - 2, ey - 2, 4, 4);
      }
      ctx.globalAlpha = 1;
    }
    drawCar(ctx, leader, theme, 'leader');
  }
  // Name tags sit above their car and stay the same size on screen whatever the zoom.
  const m = ctx.getTransform(), px = 1 / (Math.hypot(m.a, m.b) / dpr);
  ctx.font = `600 ${13 * px}px ${theme.body}`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  for (const { car, text } of tags) {
    const w = ctx.measureText(text).width + 10 * px, x = car.x, y = car.y - 12 * px;
    ctx.fillStyle = theme.tray; ctx.globalAlpha = 0.85; ctx.fillRect(x - w / 2, y - 17 * px, w, 18 * px);
    ctx.globalAlpha = 1; ctx.fillStyle = car === leader ? theme.amber : theme.ink; ctx.fillText(text, x, y);
  }
}

// Car marks follow the pedigree key: kept = solid, child = solid lighter, newcomer = hollow.
function drawCar(ctx, c, theme, state) {
  ctx.save();
  ctx.translate(c.x, c.y); ctx.rotate(c.angle);
  switch (state) {
    case 'leader':
      ctx.fillStyle = theme.amber; ctx.fillRect(-8, -4, 16, 8);
      ctx.strokeStyle = theme.tray; ctx.lineWidth = 1; ctx.strokeRect(-8, -4, 16, 8);
      break;
    case 'kept': ctx.fillStyle = theme.car; ctx.fillRect(-7, -3.5, 14, 7); break;
    case 'child': ctx.globalAlpha = 0.62; ctx.fillStyle = theme.car; ctx.fillRect(-7, -3.5, 14, 7); break;
    case 'ghost': ctx.strokeStyle = theme.ink; ctx.lineWidth = 1.6; ctx.setLineDash([3, 2]); ctx.strokeRect(-8, -4, 16, 8); break;
    case 'new': ctx.strokeStyle = theme.car; ctx.lineWidth = 1.4; ctx.strokeRect(-6.3, -2.8, 12.6, 5.6); break;
    case 'finished': ctx.globalAlpha = 0.55; ctx.fillStyle = theme.amber; ctx.fillRect(-7, -3.5, 14, 7); break;
    case 'crashed': ctx.globalAlpha = 0.45; ctx.fillStyle = theme.red; ctx.fillRect(-7, -3.5, 14, 7); break;
    default: ctx.globalAlpha = 0.2; ctx.fillStyle = theme.car; ctx.fillRect(-7, -3.5, 14, 7);
  }
  // Nose mark shows heading.
  if (state !== 'new' && state !== 'ghost') { ctx.globalAlpha = 1; ctx.fillStyle = theme.tray; ctx.globalAlpha = 0.5; ctx.fillRect(3, -2, 2.5, 4); }
  ctx.restore();
}

// A small whole-track map in the top-right corner, for the driver's view: the road, crash marks and the car.
export function drawMinimap(ctx, track, car, theme, { scale, dpr, crashes = [] }) {
  const w = Math.min(150, WORLD_W * scale * 0.3), k = (w / WORLD_W) * dpr, pad = 8 * dpr;
  const x0 = WORLD_W * scale * dpr - w * dpr - pad, y0 = pad;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = theme.tray; ctx.globalAlpha = 0.85;
  ctx.fillRect(x0 / dpr - 4, y0 / dpr - 4, w + 8, (w * WORLD_H) / WORLD_W + 8);
  ctx.globalAlpha = 1;
  ctx.setTransform(k, 0, 0, k, x0, y0);
  ctx.lineJoin = 'round'; ctx.lineWidth = track.width; ctx.strokeStyle = theme.road; ctx.stroke(roadPath(track));
  ctx.strokeStyle = theme.red; ctx.lineWidth = 2.5 / (k / dpr);
  const r = 5 / (k / dpr);
  for (const { x, y } of crashes) { ctx.beginPath(); ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r); ctx.moveTo(x + r, y - r); ctx.lineTo(x - r, y + r); ctx.stroke(); }
  ctx.fillStyle = theme.amber;
  const d = 5 / (k / dpr);
  ctx.fillRect(car.x - d, car.y - d, d * 2, d * 2);
}
