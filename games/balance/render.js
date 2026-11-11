// Draws Balance's stage: a rail with two end stops, the cart, the pole, the push and the wind.
// It only reads the game state and uses theme tokens, so both themes work. Pure geometry is exported for tests.
import { X_LIMIT, HALF_POLE } from './sim.js';

export function layout(width, height) {
  const scale = width / (2 * X_LIMIT + 1.6);
  return { scale, cx: width / 2, railY: height * 0.78, cartW: 0.7 * scale, cartH: 0.35 * scale, poleLen: 2 * HALF_POLE * scale, stopW: 0.1 * scale };
}

export function cartRect(g, lay) {
  return { x: lay.cx + g.x * lay.scale - lay.cartW / 2, y: lay.railY - lay.cartH, w: lay.cartW, h: lay.cartH };
}

// The hinge is the cart's top centre; the tip leans by th from vertical (positive is right).
export function poleLine(g, lay) {
  const r = cartRect(g, lay), x0 = r.x + r.w / 2, y0 = r.y;
  return { x0, y0, x1: x0 + Math.sin(g.th) * lay.poleLen, y1: y0 - Math.cos(g.th) * lay.poleLen };
}

function arrow(ctx, x, y, len, color, head) {
  const d = Math.sign(len);
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + len, y); ctx.lineTo(x + len - d * head, y - head / 2); ctx.lineTo(x + len - d * head, y + head / 2); ctx.closePath(); ctx.fill();
}

export function drawStage(ctx, g, { lay, theme, wind = 0, force = 0, fell = false }) {
  const half = X_LIMIT * lay.scale + lay.cartW / 2;
  // the rail and its two end stops
  ctx.strokeStyle = theme.edge; ctx.fillStyle = theme.edge; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(lay.cx - half, lay.railY); ctx.lineTo(lay.cx + half, lay.railY); ctx.stroke();
  for (const s of [-1, 1]) ctx.fillRect(lay.cx + s * (half + lay.stopW / 2) - lay.stopW / 2, lay.railY - lay.cartH, lay.stopW, lay.cartH);
  // cart and pole
  const r = cartRect(g, lay), p = poleLine(g, lay);
  ctx.fillStyle = theme.car; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = fell ? theme.red : theme.car; ctx.lineWidth = Math.max(3, lay.scale * 0.08); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(p.x0, p.y0); ctx.lineTo(p.x1, p.y1); ctx.stroke();
  ctx.fillStyle = theme.amber; ctx.beginPath(); ctx.arc(p.x0, p.y0, Math.max(3, lay.scale * 0.06), 0, Math.PI * 2); ctx.fill();
  // the push, under the cart
  const head = lay.scale * 0.12;
  if (force) arrow(ctx, r.x + r.w / 2, lay.railY + lay.scale * 0.2, force * lay.scale * 0.6, theme.amber, head);
  // wind: three small arrows up high, pointing the way it blows
  if (wind) {
    const d = Math.sign(wind), len = lay.scale * 0.5;
    for (let i = 0; i < 3; i++) arrow(ctx, lay.cx - d * len / 2, lay.railY - lay.poleLen - lay.scale * 0.3 + i * lay.scale * 0.15, d * len, theme.edge, head);
  }
}
