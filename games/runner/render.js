// Draws Coin Runner's level in Kenney's Pixel Platformer art, plus the visual-only effects (dust, coin pops,
// squash and stretch, a little shake). It only reads the game state; nothing here changes what the brain learns.
import { W, GROUND, BLOCK, STEP, FLAG_X, HW, isPit } from './sim.js';

export const TILE = 18, VIEW_W = 16, VIEW_H = 10; // a 288 × 180 view: the tray's 8:5
const CH = 24, BG = 24;                            // characters and backgrounds are 24 px tiles
const T = { grassL: 1, grass: 2, grassR: 3, dirtL: 121, dirt: 122, dirtR: 123, block: 10, spent: 9, crate: 26, coin: 151, flag: 111, flag2: 112 };
const HERO = [0, 1], ENEMY_WALK = [18, 19], ENEMY_FLAT = 20;

export function loadArt(base) {
  const load = name => new Promise((ok, fail) => { const im = new Image(); im.onload = () => ok(im); im.onerror = fail; im.src = `${base}${name}.png`; });
  return Promise.all(['tiles', 'characters', 'backgrounds'].map(load)).then(([tiles, chars, bg]) => ({ tiles, chars, bg }));
}

function sprite(ctx, img, size, cols, i, x, y) {
  ctx.drawImage(img, (i % cols) * size, Math.floor(i / cols) * size, size, size, Math.round(x), Math.round(y), size, size);
}

// Effects live outside the game state: a camera, a few particles, the hero's squash and a decaying shake.
export function createFx() { return { cam: 0, parts: [], squash: 0, trauma: 0, flat: null, frame: 0 }; }

// Feed one step's events in, so the drawing can react to them.
export function react(fx, g, ev, { reduceMotion = false } = {}) {
  const px = g.x + HW / 2;
  if (ev.jumped) { fx.squash = -0.25; dust(fx, px, g.y); }
  if (ev.landed) { fx.squash = 0.3; dust(fx, px, g.y); }
  if (ev.bumped) fx.parts.push({ kind: 'coin', x: BLOCK.x + 0.5, y: BLOCK.y + 1, vy: 9, life: 30 });
  else if (ev.coins) fx.parts.push({ kind: 'spark', x: px, y: g.y + 0.6, vy: 3, life: 18 });
  if (ev.stomped) { fx.flat = { x: g.ex, life: 30 }; if (!reduceMotion) fx.trauma = Math.min(1, fx.trauma + 0.35); }
  if (ev.died && !reduceMotion) fx.trauma = Math.min(1, fx.trauma + 0.6);
}
function dust(fx, x, y) {
  for (const s of [-1, 1]) fx.parts.push({ kind: 'dust', x: x + s * 0.2, y, vx: s * 1.5, vy: 0.6, life: 14 });
}

// Advance effects by one 60 Hz step.
export function settle(fx) {
  fx.frame++;
  fx.squash *= 0.8;
  fx.trauma = Math.max(0, fx.trauma - 1.4 / 60);
  for (const p of fx.parts) { p.x += (p.vx || 0) / 60; p.y += p.vy / 60; if (p.kind === 'coin') p.vy -= 30 / 60; p.life--; }
  fx.parts = fx.parts.filter(p => p.life > 0);
  if (fx.flat && --fx.flat.life <= 0) fx.flat = null;
}

// The camera keeps the hero a third of the way in, looking ahead to the right, and eases towards it.
export function follow(fx, g, snap = false) {
  const target = Math.max(0, Math.min(W - VIEW_W, g.x - VIEW_W / 3));
  fx.cam = snap ? target : fx.cam + (target - fx.cam) * 0.12;
}

// The level is drawn at its true pixel size (288 × 180) and then scaled up in one go, so the pixels stay crisp
// and tiles never show seams. The shake moves that one finished picture.
let small = null;
export function drawLevel(out, g, fx, art, { width, dpr }) {
  small ??= Object.assign(document.createElement('canvas'), { width: VIEW_W * TILE, height: VIEW_H * TILE });
  const ctx = small.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  paint(ctx, g, fx, art);
  const scale = (width * dpr) / small.width, sh = fx.trauma * fx.trauma;
  const ox = sh * 4 * Math.sin(fx.frame * 1.7), oy = sh * 3 * Math.sin(fx.frame * 2.3);
  out.setTransform(1, 0, 0, 1, 0, 0);
  out.imageSmoothingEnabled = false;
  out.fillStyle = '#1d2b2a'; out.fillRect(0, 0, out.canvas.width, out.canvas.height);
  out.drawImage(small, Math.round(ox * scale), Math.round(oy * scale), out.canvas.width, out.canvas.height);
}

function paint(ctx, g, fx, art) {
  const cam = fx.cam, sx = tx => Math.round((tx - cam) * TILE), sy = ty => (VIEW_H - 1 - ty) * TILE;

  // Sky and far hills, scrolling slower than the level (parallax).
  const far = -((cam * TILE * 0.35) % (BG * 2));
  for (let x = far - BG; x < VIEW_W * TILE + BG * 2; x += BG) {
    for (let y = 0; y < VIEW_H * TILE; y += BG) sprite(ctx, art.bg, BG, 8, 6, x, y);
    sprite(ctx, art.bg, BG, 8, Math.round((x - far) / BG) % 2 ? 15 : 14, x, sy(GROUND) - BG);
    sprite(ctx, art.bg, BG, 8, 22, x, sy(GROUND));
  }

  const x0 = Math.max(0, Math.floor(cam) - 1), x1 = Math.min(W - 1, Math.ceil(cam + VIEW_W));
  for (let tx = x0; tx <= x1; tx++) {
    if (isPit(tx)) { ctx.fillStyle = '#1d2b2a'; ctx.fillRect(sx(tx), sy(GROUND - 1), TILE, TILE * GROUND); continue; }
    const left = tx === 0 || isPit(tx - 1), right = tx === W - 1 || isPit(tx + 1);
    sprite(ctx, art.tiles, TILE, 20, left ? T.grassL : right ? T.grassR : T.grass, sx(tx), sy(GROUND - 1));
    sprite(ctx, art.tiles, TILE, 20, left ? T.dirtL : right ? T.dirtR : T.dirt, sx(tx), sy(0));
  }
  sprite(ctx, art.tiles, TILE, 20, g.armed ? T.block : T.spent, sx(BLOCK.x), sy(BLOCK.y));
  sprite(ctx, art.tiles, TILE, 20, T.crate, sx(STEP.x), sy(GROUND));
  for (const c of g.coins) sprite(ctx, art.tiles, TILE, 20, T.coin, sx(c), sy(GROUND) - 2 * Math.abs(Math.sin((fx.frame + c * 9) / 14)));

  // The flag: a pole from the ground, and a flag that waves.
  ctx.fillStyle = '#3a2d2a';
  ctx.fillRect(sx(FLAG_X) + 2, sy(GROUND + 2), 2, TILE * 3);
  sprite(ctx, art.tiles, TILE, 20, Math.floor(fx.frame / 20) % 2 ? T.flag2 : T.flag, sx(FLAG_X), sy(GROUND + 3));

  // The enemy walks with two frames, facing its direction; squashed, it lies flat for half a second.
  if (g.eAlive) {
    const f = ENEMY_WALK[Math.floor(fx.frame / 10) % 2], ex = sx(g.ex) + (0.9 * TILE) / 2;
    ctx.save(); ctx.translate(ex, 0); ctx.scale(g.edir < 0 ? -1 : 1, 1);
    sprite(ctx, art.chars, CH, 9, f, -CH / 2, sy(GROUND) + TILE - CH);
    ctx.restore();
  } else if (fx.flat) sprite(ctx, art.chars, CH, 9, ENEMY_FLAT, sx(fx.flat.x) + (0.9 * TILE) / 2 - CH / 2, sy(GROUND) + TILE - CH);

  // The hero, stretched as it jumps and squashed as it lands, from its feet.
  const hx = sx(g.x) + (HW * TILE) / 2, feet = (VIEW_H - g.y) * TILE;
  const moving = g.onGround && g.vx > 0, frame = moving ? HERO[Math.floor(fx.frame / 6) % 2] : HERO[0];
  const sq = fx.squash, kx = 1 + sq * 0.5, ky = 1 - sq * 0.5;
  ctx.save(); ctx.translate(hx, feet); ctx.scale(kx, ky);
  sprite(ctx, art.chars, CH, 9, frame, -CH / 2, -CH);
  ctx.restore();

  for (const p of fx.parts) {
    const x = sx(p.x), y = (VIEW_H - p.y) * TILE;
    ctx.globalAlpha = Math.min(1, p.life / 10);
    if (p.kind === 'coin') sprite(ctx, art.tiles, TILE, 20, T.coin, x - TILE / 2, y - TILE / 2);
    else { ctx.fillStyle = p.kind === 'spark' ? '#ffe478' : '#f2e6d0'; const r = p.kind === 'spark' ? 2 : 3; ctx.fillRect(Math.round(x - r / 2), Math.round(y - r), r, r); }
  }
  ctx.globalAlpha = 1;
}

// One bar per 50 tries, stacked by how they ended. Amber = reached the flag (the site's colour for survived),
// red = died, muted = ran out of time.
export function drawOutcomes(ctx, history, { width, height, theme, per = 50, slots = 24 }) {
  ctx.clearRect(0, 0, width, height);
  ctx.font = `400 13px ${theme.body}`; ctx.textBaseline = 'middle';
  const bars = [];
  for (let i = 0; i + per <= history.length; i += per) {
    const b = history.slice(i, i + per), n = k => b.filter(t => t.outcome === k).length / per;
    bars.push([n('finished'), n('died'), n('timeout')]);
  }
  if (!bars.length) {
    ctx.fillStyle = theme.muted; ctx.textAlign = 'left';
    ctx.fillText(`The first bar appears after ${per} tries.`, 0, height / 2);
    return;
  }
  const shown = bars.slice(-slots), first = bars.length - shown.length, top = 8, bottom = height - 22;
  const slot = width / slots, bw = Math.max(2, slot - 3), colours = [theme.amber, theme.red, theme.muted];
  shown.forEach((b, i) => {
    let y = bottom;
    b.forEach((share, k) => { const h = share * (bottom - top); ctx.fillStyle = colours[k]; ctx.fillRect(i * slot, y - h, bw, h); y -= h; });
  });
  ctx.strokeStyle = theme.rule; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, bottom + 0.5); ctx.lineTo(width, bottom + 0.5); ctx.stroke();
  ctx.fillStyle = theme.muted;
  ctx.textAlign = 'left'; ctx.fillText(`Try ${first * per + 1}`, 0, height - 8);
  ctx.textAlign = 'right'; ctx.fillText(`Try ${(first + shown.length) * per}`, width, height - 8);
}
