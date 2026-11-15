// The PID playground: a drone view, an error trace, three dials. Builds its own markup.
import { SPAN, DT, createSim, stepSim, gust, setTarget } from './sim.js';

export const presets = [
  { label: 'Set P only', text: 'Leave only P on. It bobs forever and hangs below the line.', state: { p: 6, i: 0, d: 0 } },
  { label: 'Add D', text: 'Add D. The bobbing dies out, but it still sags under the line.', state: { p: 6, i: 0, d: 3 } },
  { label: 'Add I', text: 'Add a little I. The sag adds up until it lifts the drone onto the line.', state: { p: 6, i: 2, d: 3 } },
];

const DIALS = [
  { key: 'p', name: 'P · now', max: 20, step: 0.5, say: 'pushes harder the further off it is' },
  { key: 'i', name: 'I · so far', max: 8, step: 0.25, say: 'adds up error that won’t go away' },
  { key: 'd', name: 'D · changing', max: 8, step: 0.25, say: 'brakes when it’s closing in fast' },
];
const KEYS = ['p', 'i', 'd'];

export function mountPlayground(root) {
  root.innerHTML = `
    <div class="stage-head"><span><b>Hold the drone on the line</b></span><span>Height <b class="num" data-r="h">0.0</b> m</span><span>Target <b class="num" data-r="t">5.0</b> m</span><span>Error <b class="num" data-r="e">0.0</b> m</span></div>
    <div class="views">
      <canvas role="img" data-r="world" aria-label="Drone hovering, with a dashed target line"></canvas>
      <canvas role="img" data-r="trace" aria-label="Error over the last eight seconds"></canvas>
    </div>
    <div class="dials">${DIALS.map(d => `
      <div class="dial"><label for="pid-${d.key}">${d.name} <b class="num" data-r="${d.key}V">0.0</b></label>
        <input id="pid-${d.key}" data-r="${d.key}" type="range" min="0" max="${d.max}" step="${d.step}" value="0">
        <span class="say">${d.say} · <span class="term num" data-r="${d.key}T">0.0</span></span></div>`).join('')}
    </div>
    <div class="stage-foot">
      <button type="button" class="sbtn primary" data-r="gust">Gust</button>
      <button type="button" class="sbtn" data-r="reset">Reset</button>
      <span class="hint">Tap the drone view to move the target.</span>
    </div>`;
  const $ = n => root.querySelector(`[data-r="${n}"]`);
  const world = $('world'), trace = $('trace');
  const k = { p: 0, i: 0, d: 0 };
  let s = createSim();

  function apply(state) {
    for (const key of KEYS) {
      k[key] = state[key];
      $(key).value = state[key];
      $(key + 'V').textContent = (+state[key]).toFixed(1);
    }
    s = createSim();
  }
  for (const key of KEYS) {
    $(key).addEventListener('input', () => {
      k[key] = +$(key).value;
      $(key + 'V').textContent = k[key].toFixed(1);
    });
  }
  $('gust').addEventListener('click', () => gust(s));
  $('reset').addEventListener('click', () => { s = createSim(); });
  world.addEventListener('click', ev => {
    const r = world.getBoundingClientRect();
    setTarget(s, 10 * (1 - (ev.clientY - r.top - 20) / (r.height - 40)));
  });

  const tok = (n, fb) => getComputedStyle(root).getPropertyValue(n).trim() || fb;
  function fit(c) {
    const r = c.getBoundingClientRect(), d = window.devicePixelRatio || 1;
    const w = Math.round(r.width * d), h = Math.round(r.height * d);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const x = c.getContext('2d'); x.setTransform(d, 0, 0, d, 0, 0);
    return [x, r.width, r.height];
  }

  function draw() {
    const ink = tok('--stage-ink', '#E9EDF2'), dim = tok('--stage-dim', '#7D8794');
    const sig = tok('--signal', '#FF5A1F'), line = tok('--stage-2', '#1A2029'), mono = tok('--mono', 'monospace');
    let [x, w, h] = fit(world);
    x.clearRect(0, 0, w, h);
    const yPx = v => h - 20 - (v / 10) * (h - 40);
    x.strokeStyle = line; x.lineWidth = 1; x.beginPath(); x.moveTo(0, h - 20); x.lineTo(w, h - 20); x.stroke();
    x.setLineDash([6, 6]); x.strokeStyle = dim; x.beginPath(); x.moveTo(0, yPx(s.tgt)); x.lineTo(w, yPx(s.tgt)); x.stroke(); x.setLineDash([]);
    x.fillStyle = dim; x.font = '12px ' + mono; x.fillText('target', 10, yPx(s.tgt) - 6);
    const cx = w / 2, cy = yPx(s.y);
    x.strokeStyle = sig; x.lineWidth = 2; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx, yPx(s.tgt)); x.stroke();
    x.fillStyle = ink; x.fillRect(cx - 26, cy - 5, 52, 10);
    x.fillRect(cx - 34, cy - 10, 18, 3); x.fillRect(cx + 16, cy - 10, 18, 3);
    const th = Math.max(0, s.terms[0] + s.terms[1] + s.terms[2]);
    x.fillStyle = sig; x.globalAlpha = 0.7;
    [cx - 25, cx + 25].forEach(px => { x.beginPath(); x.moveTo(px - 5, cy + 6); x.lineTo(px + 5, cy + 6); x.lineTo(px, cy + 6 + Math.min(30, th * 1.2)); x.fill(); });
    x.globalAlpha = 1;

    [x, w, h] = fit(trace);
    x.clearRect(0, 0, w, h);
    const mid = h / 2, sc = (h / 2 - 20) / 6;
    x.strokeStyle = line; x.lineWidth = 1;
    for (let g = -6; g <= 6; g += 2) { x.beginPath(); x.moveTo(0, mid - g * sc); x.lineTo(w, mid - g * sc); x.stroke(); }
    x.strokeStyle = dim; x.setLineDash([6, 6]); x.beginPath(); x.moveTo(0, mid); x.lineTo(w, mid); x.stroke(); x.setLineDash([]);
    x.fillStyle = dim; x.font = '12px ' + mono; x.fillText('error  0 = on the line', 10, mid - 8); x.fillText('last 8 s', w - 70, h - 8);
    x.strokeStyle = sig; x.lineWidth = 2.5; x.beginPath();
    const n = SPAN / DT;
    s.hist.forEach((e, i) => {
      const px = w - (s.hist.length - i) / n * w, py = mid - Math.max(-6, Math.min(6, e)) * sc;
      if (i) x.lineTo(px, py); else x.moveTo(px, py);
    });
    x.stroke();

    $('h').textContent = s.y.toFixed(1); $('t').textContent = s.tgt.toFixed(1); $('e').textContent = (s.tgt - s.y).toFixed(1);
    KEYS.forEach((key, i) => { $(key + 'T').textContent = s.terms[i].toFixed(1); });
  }

  // Run only while the page is visible and the stage is on screen.
  let onScreen = true, raf = 0;
  const live = () => onScreen && !document.hidden;
  function loop() {
    raf = 0;
    if (!live()) return;
    stepSim(s, k); stepSim(s, k); draw();
    raf = requestAnimationFrame(loop);
  }
  const wake = () => { if (live() && !raf) raf = requestAnimationFrame(loop); };
  document.addEventListener('visibilitychange', wake);
  if (typeof IntersectionObserver === 'function') {
    new IntersectionObserver(es => { onScreen = es[es.length - 1].isIntersecting; wake(); }).observe(root);
  }

  apply(presets[0].state);
  wake();
  return { apply };
}
