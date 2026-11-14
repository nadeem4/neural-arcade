// Draws Treasure Maze as an isometric stone dungeon (Kenney's Isometric Miniature Dungeon, CC0): the room is dark and
// each tile is lit by its value. Pure helpers are exported for tests.
import { ACTIONS } from './sim.js';

// A value as opacity: 0 at or below zero, 1 at vmax.
export const shade = (v, vmax = 10) => Math.min(1, Math.max(0, v / vmax));

export const arrowFor = action => '↑↓←→'[action];

// How lit a tile is: 0 at or below zero, rising to 1 by a value of about 9.
export const lightOf = v => Math.min(1, Math.max(0, v / 9)) ** 0.9;

// ---------- Layout ----------
// The map is turned a quarter for display only, so Start sits at the front corner: cell (r, c) of an R-row map
// is drawn at screen grid position (R-1-c, r). The sim never sees this.
export const turnCell = (map, s) => ({ r: map.nCols - 1 - (s % map.nCols), c: Math.floor(s / map.nCols) });

// Screen grid (r down-left, c down-right) to pixels. centre(s) is the middle of a map state's top face.
export function isoLayout(map, w, h) {
  const R = map.nCols, C = map.nRows, n = (R + C) / 2; // the screen grid has nCols rows and nRows columns
  const tw = Math.min(w / (n + 0.8), h / (n / 2 + 1.25)), th = tw / 2;
  const ox = w / 2 - ((C - R) * tw) / 4, oy = (h - n * th - tw) / 2 + tw * 0.9; // walls rise about a tile above the back corner
  const P = (r, c) => [ox + ((c - r) * tw) / 2, oy + ((c + r) * th) / 2];
  const centre = s => { const { r, c } = turnCell(map, s); return P(r + 0.5, c + 0.5); };
  return { tw, th, rows: R, cols: C, P, centre };
}

// States back to front: a tile further front is drawn after the ones behind it.
export function paintOrder(map) {
  const depth = s => { const { r, c } = turnCell(map, s); return r + c; };
  return Array.from({ length: map.nStates }, (_, s) => s).sort((a, b) => depth(a) - depth(b) || a - b);
}

// ---------- Directions ----------
// An action's direction on the turned screen grid [dr, dc].
export const screenDir = a => [0 - ACTIONS[a].dc, ACTIONS[a].dr];

// Kenney's facing for an action: 0 up-right, 2 down-right, 4 down-left, 6 up-left.
export function facingFor(a) {
  const [dr, dc] = screenDir(a), dx = dc - dr, dy = dc + dr;
  return dy < 0 ? (dx > 0 ? 0 : 6) : (dx > 0 ? 2 : 4);
}

// The action that takes the explorer from one tile to a neighbour, or null if he did not move.
export function actionBetween(map, from, to) {
  const dr = Math.floor(to / map.nCols) - Math.floor(from / map.nCols), dc = (to % map.nCols) - (from % map.nCols);
  const a = ACTIONS.findIndex(x => x.dr === dr && x.dc === dc);
  return a < 0 ? null : a;
}

// ---------- The explorer ----------
// Where he is on the screen grid (fractional while running), which sheet cell to draw, and how faded or sunk.
// from: the tile he came from (null: no running). k: how far through the move, 0 to 1. e: seconds since he arrived.
export function explorerPose(map, { to, from = null, action = null, outcome = null, k = 1, e = 0 }) {
  const b = turnCell(map, to);
  const row = (action === null ? 0 : facingFor(action)) / 2;
  const pose = { r: b.r, c: b.c, row, col: 0, alpha: 1, sink: 0 };
  if (from !== null && k < 1) {
    const a = turnCell(map, from), f = k * k * (3 - 2 * k);
    return { ...pose, r: a.r + (b.r - a.r) * f, c: a.c + (b.c - a.c) * f, col: 1 + (Math.floor(k * 10) % 10) };
  }
  if (outcome === 'big' || outcome === 'small') { pose.col = 11 + Math.min(9, Math.floor(e * 14)); pose.alpha = e > 0.7 ? Math.max(0, 1 - (e - 0.7) * 3.3) : 1; }
  else if (outcome === 'pit') { pose.sink = Math.min(1, e * 1.6); pose.alpha = 1 - pose.sink; }
  else if (outcome === 'cap') pose.alpha = Math.max(0, 1 - e * 2.5);
  return pose;
}

// A walk along a path (tile states) at one tile per `beat` steps of 60 Hz, t steps after it started.
// Returns what drawMaze needs: from (null while standing), to, k, the facing action, and once he arrives the outcome and e
// (seconds since arrival). done is true after the outcome has had `end` steps from the start of the last move.
export function walkAt(map, path, outcome, t, beat = 15, end = 75) {
  const moves = path.length - 1, leg = Math.min(moves - 1, Math.max(0, Math.floor(t / beat)));
  let action = null;
  for (let i = Math.min(leg, moves - 1); i >= 0 && action === null; i--) action = actionBetween(map, path[i], path[i + 1]);
  if (moves < 1) return { from: null, to: path[0], k: 1, action, outcome, e: t / 60, done: t >= end };
  const arrived = t >= moves * beat, from = path[leg], to = path[leg + 1];
  return {
    from: from === to ? null : from, to, action,
    k: arrived ? 1 : (t - leg * beat) / beat,
    outcome: arrived ? outcome : null, e: arrived ? (t - moves * beat) / 60 : 0,
    done: t >= leg * beat + end,
  };
}

// ---------- Curve helpers (the learning curve under the stage) ----------
// Trailing mean over the last `window` values, same length as the input.
export function smooth(values, window = 20) {
  let sum = 0;
  return values.map((v, i) => {
    sum += v;
    if (i >= window) sum -= values[i - window];
    return sum / Math.min(i + 1, window);
  });
}

// The last `shown` points of the 20-episode average, smoothed over the whole history so the tail matches the full curve.
export function curvePoints(history, shown = 500, window = 20) {
  const start = Math.max(0, history.length - shown);
  const values = smooth(history.slice(Math.max(0, start - window + 1)), window).slice(start - Math.max(0, start - window + 1));
  return { values, start };
}

// ---------- Art ----------
export function loadArt(base) {
  const load = name => new Promise((ok, fail) => { const im = new Image(); im.onload = () => ok(im); im.onerror = fail; im.src = `${base}${name}.png`; });
  return Promise.all(['tiles', 'explorer'].map(load)).then(([tiles, explorer]) => ({ tiles, explorer }));
}

// tiles.png: 13 cells of 128 x 146, in this order. The anchor is the middle of the top face.
const CELL = { stone: 0, stoneTile: 1, stoneUneven: 2, stoneInset: 3, topN: 4, topE: 5, topS: 6, topW: 7, wallE: 8, wallS: 9, column: 10, chestOpen: 11, chestClosed: 12 };
const TW = 128, TH = 146, TOP_Y = 104;
const FLOORS = [0, 0, 0, 1, 2]; // mostly plain stone, now and then a tile or an uneven one

// A fixed pick per tile, so the floor never shimmers.
export const floorTile = (r, c) => FLOORS[(((r * 73856093) ^ (c * 19349663)) >>> 0) % FLOORS.length];

// explorer.png: rows are facings 0, 2, 4, 6; each cell is 64 x 96 with his feet at (32, 74).
const EW = 64, EH = 96;

const LABEL = { T: ['+10', '#ffcf5a', '#2a1a00'], N: ['+3', '#ffe3a3', '#2a1a00'], P: ['-10', 'rgba(255,120,90,.92)', '#2a0700'] };

function glow(g, x, y, rad, inner, outer = 'rgba(0,0,0,0)') {
  const gr = g.createRadialGradient(x, y, 0, x, y, rad);
  gr.addColorStop(0, inner); gr.addColorStop(1, outer);
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
}

// showFour and q are for the four-values view (M4); ignored for now.
// light: an offscreen canvas for the darkness layer (drawn in the same pixel units as the stage); without one the room stays lit.
// now: seconds, for the lantern flicker; null means no flicker. explorer: { from, action, outcome, k, e } for explorerPose.
// The stage is dark in both themes, so every colour here is the dungeon's own.
export function drawMaze(ctx, theme, { map, values, policy, robot, explorer = {}, art, light, now = null, w, h }) {
  ctx.save();
  ctx.fillStyle = theme.tray; ctx.fillRect(0, 0, w, h);
  const { tw, th, rows, cols, P, centre } = isoLayout(map, w, h), s = tw / TW;
  const at = (r, c) => P(r + 0.5, c + 0.5);
  const flick = t => (now === null ? 1 : 0.92 + 0.08 * Math.sin(now * 7 + t));
  const tile = (i, [x, y], k = 1, anchor = TOP_Y) => art && ctx.drawImage(art.tiles, i * TW, 0, TW, TH, x - (TW / 2) * s * k, y - anchor * s * k, TW * s * k, TH * s * k);
  const pose = robot == null ? null : explorerPose(map, { to: robot, ...explorer });
  const pos = pose && at(pose.r, pose.c);

  const top = P(0, 0)[1];
  glow(ctx, w / 2, top + (rows * th) / 2, w * 0.55, 'rgba(60,48,40,.35)');

  // Painter's order: back walls, then tiles by depth, the explorer slotted in by his own depth.
  const items = [];
  for (let r = 0; r < rows; r++) items.push([r - 0.9, () => tile(CELL.wallE, at(r, 0))]);
  for (let c = 0; c < cols; c++) items.push([c - 0.9, () => tile(CELL.wallS, at(0, c))]);
  items.push([-0.8, () => { const [x, y] = at(0, 0); tile(CELL.column, [x - tw * 0.5, y]); }]);
  for (const st of paintOrder(map)) {
    const { r, c } = turnCell(map, st), ch = map.cells[st], p = centre(st);
    items.push([r + c, () => {
      if (ch === 'P') { // a hole: nothing from the art, the ember glow fills it in later
        ctx.beginPath(); [P(r, c), P(r, c + 1), P(r + 1, c + 1), P(r + 1, c)].forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
        ctx.fillStyle = '#050304'; ctx.fill();
        return;
      }
      tile(st === map.start ? CELL.stoneInset : floorTile(r, c), p);
      if (ch === '#') for (const e of ['topE', 'topS', 'topN', 'topW']) tile(CELL[e], p);
      if (ch === 'T') tile(CELL.chestOpen, p, 1.5, 110);
      if (ch === 'N') tile(CELL.chestClosed, p, 1.3, 108);
    }]);
  }
  if (pose && art) items.push([Math.ceil(pose.r + pose.c) + 0.5, () => { // after the tile he is walking onto
    const k = s * 1.35;
    ctx.globalAlpha = pose.alpha;
    ctx.drawImage(art.explorer, pose.col * EW, pose.row * EH, EW, EH, pos[0] - 32 * k, pos[1] + pose.sink * tw * 0.3 - 74 * k, EW * k, EH * k);
    ctx.globalAlpha = 1;
  }]);
  items.sort((a, b) => a[0] - b[0]).forEach(([, draw]) => draw());

  // Darkness, with light cut out where the tile is worth something, and by the explorer's lantern.
  if (light) {
    const lc = light.getContext('2d');
    lc.globalCompositeOperation = 'source-over'; lc.clearRect(0, 0, w, h);
    lc.fillStyle = 'rgba(5,6,14,.8)'; lc.fillRect(0, 0, w, h);
    lc.globalCompositeOperation = 'destination-out';
    for (let st = 0; st < map.nStates; st++) {
      const ch = map.cells[st], [x, y] = centre(st);
      const L = ch === 'T' ? 1 : ch === 'N' ? 0.75 : ch === 'P' || ch === '#' ? 0 : lightOf(values?.[st] ?? 0);
      if (L > 0.02) glow(lc, x, y - th * 0.2, tw * (0.55 + 0.35 * L) * flick(st), `rgba(0,0,0,${0.95 * L})`);
    }
    if (pose) glow(lc, pos[0], pos[1] - th * 0.4, tw * 0.7 * flick(9), `rgba(0,0,0,${0.55 * pose.alpha})`);
    lc.globalCompositeOperation = 'source-over';
    ctx.drawImage(light, 0, 0, w, h);
  }

  // Warm colour in the light, red from the pits.
  ctx.globalCompositeOperation = 'lighter';
  for (let st = 0; st < map.nStates; st++) {
    const ch = map.cells[st], [x, y] = centre(st);
    if (ch === 'T') glow(ctx, x, y - th * 0.3, tw * flick(1), 'rgba(255,170,60,.45)');
    else if (ch === 'N') glow(ctx, x, y - th * 0.3, tw * 0.7 * flick(2), 'rgba(255,170,60,.3)');
    else if (ch === 'P') glow(ctx, x, y + th * 0.1, tw * 0.6 * flick(st), 'rgba(230,60,20,.55)');
    else if (ch !== '#') { const L = lightOf(values?.[st] ?? 0); if (L > 0.02) glow(ctx, x, y, tw * 0.6, `rgba(255,150,50,${0.22 * L})`); }
  }
  if (pose) glow(ctx, pos[0], pos[1] - th * 0.4, tw * 0.45, `rgba(255,190,110,${0.18 * pose.alpha})`);
  ctx.globalCompositeOperation = 'source-over';

  // Arrows for the best move on each tile, cream with a dark outline, stronger where it is brighter.
  ctx.lineJoin = 'round'; ctx.lineWidth = 3;
  for (let st = 0; st < map.nStates; st++) {
    const a = policy?.[st];
    if (a == null) continue;
    const { r, c } = turnCell(map, st), [dr, dc] = screenDir(a), pr = -dc, pc = dr; // a perpendicular in grid space
    ctx.beginPath();
    [[-0.2, 0.06], [0.04, 0.06], [0.04, 0.15], [0.24, 0], [0.04, -0.15], [0.04, -0.06], [-0.2, -0.06]]
      .forEach(([u, v], i) => { const [x, y] = P(r + 0.5 + dr * u + pr * v, c + 0.5 + dc * u + pc * v); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.closePath();
    ctx.globalAlpha = 0.55 + 0.45 * lightOf(values?.[st] ?? 0);
    ctx.strokeStyle = 'rgba(20,12,4,.75)'; ctx.stroke();
    ctx.fillStyle = '#fff0d2'; ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Badges last, so nothing covers them.
  const fs = Math.max(11, tw * 0.15);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const badge = (x, y, text, bg, fg, size) => {
    ctx.font = `800 ${size}px ${theme.body}`;
    const bw = ctx.measureText(text).width + size * 0.9, bh = size * 1.45;
    ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(x - bw / 2, y - bh / 2, bw, bh, bh / 2); ctx.fill();
    ctx.fillStyle = fg; ctx.fillText(text, x, y + 1);
  };
  for (let st = 0; st < map.nStates; st++) {
    const [x, y] = centre(st), kind = LABEL[map.cells[st]];
    if (kind) badge(x, y - (map.cells[st] === 'T' ? tw * 0.62 : map.cells[st] === 'N' ? tw * 0.5 : th * 0.05), kind[0], kind[1], kind[2], map.cells[st] === 'P' ? fs * 0.9 : fs);
    if (st === map.start) badge(x, y + th * 0.62, 'Start', 'rgba(255,255,255,.88)', '#11141a', fs * 0.85);
  }
  ctx.restore();
}
