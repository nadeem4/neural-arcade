// The reward design playground: a toy map, a receipt and three sliders. Builds its own markup.
import { MAP, DEFAULTS, trainToy } from './sim.js';

export const presets = [
  { label: 'Pay for speed', text: 'Only the clock costs money. The courier cuts straight across the lawn.', state: { time: 1, lawn: 0, perTile: 0 } },
  { label: 'Fine the lawn', text: 'Fine the lawn 20 a tile. The courier takes the longer road instead.', state: { time: 1, lawn: 20, perTile: 0 } },
  { label: 'Pay by the tile', text: 'Pay 2 for every tile driven. The courier loops and never delivers.', state: { time: 1, lawn: 20, perTile: 2 } },
];

export const RANGES = {
  time: { min: 0, max: 3, step: 0.5 },
  lawn: { min: 0, max: 40, step: 5 },
  perTile: { min: 0, max: 5, step: 0.5 },
};

const SLIDERS = [
  { key: 'time', name: 'Cost per second', say: 'the clock: every step costs this much' },
  { key: 'lawn', name: 'Fine per lawn tile', say: 'charged each time it drives on the lawn' },
  { key: 'perTile', name: 'Pay per tile driven', say: 'paid for every tile it moves, delivered or not' },
];
const KEYS = SLIDERS.map(s => s.key);

// Animate the courier's route unless the reader asked for reduced motion.
export const shouldAnimate = mq => !(mq && mq.matches);

// What the slip really paid for, in plain words.
export function verdictOf(pay, r) {
  if (!r.arrived) {
    return pay.perTile > 0 && r.tiles >= r.steps / 2
      ? 'It earns more by driving than by delivering, so it never drops the passenger off.'
      : 'It never arrived. Nothing it tried paid better than standing still.';
  }
  if (r.lawnTiles > 0) return `It cut across the lawn: ${pay.lawn > 0 ? 'the fine costs less than the time it saves.' : 'nobody fined that.'}`;
  return 'Legal trip: it stayed on the road.';
}

// The lines of the receipt; the amounts add up to the trip's reward.
export function receiptLines(pay, r) {
  return [
    { label: 'Fare for arriving', amount: r.arrived ? pay.fare : 0 },
    { label: `Clock, ${r.steps} s`, amount: -pay.time * r.steps },
    { label: `Lawn fines, ${r.lawnTiles} tiles`, amount: -pay.lawn * r.lawnTiles },
    { label: `Pay per tile, ${r.tiles} tiles`, amount: pay.perTile * r.tiles },
  ];
}

export function playgroundHtml() {
  return `
    <div class="stage-head"><span><b>Write the courier's pay slip</b></span><span>Fare for arriving <b class="num">${DEFAULTS.fare}</b></span></div>
    <div class="views">
      <canvas role="img" data-r="world" aria-label="A small map: a road around a wall, with a lawn along the bottom. The courier's route is drawn on it."></canvas>
      <div class="readout">
        <div><span class="who">Receipt</span><ul class="opts" data-r="receipt"></ul></div>
        <div><span class="who">Verdict</span><p data-r="verdict" aria-live="polite"></p></div>
      </div>
    </div>
    <div class="dials">${SLIDERS.map(d => `
      <div class="dial"><label for="rd-${d.key}">${d.name} <b class="num" data-r="${d.key}V">0</b></label>
        <input id="rd-${d.key}" data-r="${d.key}" type="range" min="${RANGES[d.key].min}" max="${RANGES[d.key].max}" step="${RANGES[d.key].step}" value="0">
        <span class="say">${d.say}</span></div>`).join('')}
    </div>
    <div class="stage-foot">${presets.map((p, i) => `<button type="button" class="sbtn${i ? '' : ' primary'}" aria-pressed="${i ? 'false' : 'true'}" data-r="preset${i}">${p.label}</button>`).join('')}
      <span class="hint">The courier retrains each time a slider moves.</span>
    </div>`;
}

const fmt = n => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n);

export function mountPlayground(root) {
  root.innerHTML = playgroundHtml();
  const $ = n => root.querySelector(`[data-r="${n}"]`);
  const world = $('world');
  const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  const pay = { ...DEFAULTS };
  let result = null, shown = 0, timer = 0;

  const tok = (n, fb) => getComputedStyle(root).getPropertyValue(n).trim() || fb;
  function draw() {
    const d = window.devicePixelRatio || 1, r = world.getBoundingClientRect();
    const w = Math.round(r.width * d), h = Math.round(r.height * d);
    if (world.width !== w || world.height !== h) { world.width = w; world.height = h; }
    const x = world.getContext('2d'); x.setTransform(d, 0, 0, d, 0, 0);
    x.clearRect(0, 0, r.width, r.height);
    const cols = MAP[0].length, rows = MAP.length, pad = 12;
    const cell = Math.min((r.width - 2 * pad) / cols, (r.height - 2 * pad) / rows);
    const ox = (r.width - cell * cols) / 2, oy = (r.height - cell * rows) / 2;
    const mono = tok('--mono', 'monospace');
    const ink = tok('--stage-ink', '#E9EDF2'), dim = tok('--stage-dim', '#7D8794'), line = tok('--stage-2', '#1A2029'), sig = tok('--signal', '#FF5A1F');
    const wall = tok('--ghost', 'rgba(233,237,242,.18)'), grass = 'rgba(74,160,96,.45)';
    const labels = () => {
      x.font = '12px ' + mono; x.fillStyle = ink;
      MAP.forEach((row, j) => [...row].forEach((c, i) => {
        const px = ox + i * cell + 6, py = oy + (j + 1) * cell - 8;
        if (c === 'g' && i === 1) x.fillText('lawn', px, py);
        if (c === 'S') x.fillText('start', px, py);
        if (c === 'T') x.fillText('end', px, py);
      }));
    };
    MAP.forEach((row, j) => [...row].forEach((c, i) => {
      const px = ox + i * cell, py = oy + j * cell;
      if (c === '#') { x.fillStyle = wall; x.fillRect(px + 1, py + 1, cell - 2, cell - 2); }
      if (c === 'g') { x.fillStyle = grass; x.fillRect(px + 1, py + 1, cell - 2, cell - 2); }
      x.strokeStyle = line; x.lineWidth = 1; x.strokeRect(px + .5, py + .5, cell - 1, cell - 1);
    }));
    if (!result) return labels();
    const pts = result.route.slice(0, shown + 1).map(p => [ox + (p.x + .5) * cell, oy + (p.y + .5) * cell]);
    x.strokeStyle = sig; x.lineWidth = 3; x.lineJoin = 'round'; x.beginPath();
    pts.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py))); x.stroke();
    const [ex, ey] = pts[pts.length - 1];
    x.fillStyle = sig; x.beginPath(); x.arc(ex, ey, cell / 6, 0, 7); x.fill();
    labels();
  }

  function tick() {
    timer = 0;
    draw();
    if (shown < result.route.length - 1) { shown++; timer = setTimeout(tick, 60); }
  }

  function train() {
    clearTimeout(timer); timer = 0;
    result = trainToy(pay, { seed: 1 });
    $('receipt').innerHTML = receiptLines(pay, result).map(l => `<li><span>${l.label}</span><b class="num">${fmt(l.amount)}</b></li>`).join('')
      + `<li><span>Total</span><b class="num">${fmt(result.reward)}</b></li>`;
    $('verdict').textContent = verdictOf(pay, result);
    if (shouldAnimate(mq)) { shown = 0; tick(); } else { shown = result.route.length - 1; draw(); }
  }

  function mark(on) {
    presets.forEach((p, i) => { const b = $('preset' + i); b.classList.toggle('primary', i === on); b.setAttribute('aria-pressed', String(i === on)); });
  }
  function apply(state) {
    for (const k of KEYS) { pay[k] = state[k]; $(k).value = state[k]; $(k + 'V').textContent = state[k]; }
    mark(presets.findIndex(p => KEYS.every(k => p.state[k] === state[k])));
    train();
  }
  for (const k of KEYS) {
    $(k).addEventListener('input', () => { pay[k] = +$(k).value; $(k + 'V').textContent = pay[k]; mark(presets.findIndex(p => KEYS.every(q => p.state[q] === pay[q]))); train(); });
  }
  presets.forEach((p, i) => $('preset' + i).addEventListener('click', () => apply(p.state)));
  window.addEventListener('resize', () => result && draw());
  apply(presets[0].state);
  return { apply };
}
