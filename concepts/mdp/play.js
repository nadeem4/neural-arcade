// The MDP playground: a token on a three-state diagram. Step draws the next state from the current state's odds.
// Svg diagram using CSS tokens, so it follows the theme with no redraw.
import { mulberry32 } from '../../engine/rng.js';
import { MDP, oddsFrom, stepMdp } from './sim.js';

export const presets = [
  { label: 'Start sunny', text: 'Press Step. From sunny the odds are 60% sunny, 30% cloudy, 10% rainy, and the token follows them.', state: { at: 'Sunny' } },
  { label: 'Same state, different past', text: 'Cloudy, reached by Sunny then Rainy. It could just as well have come straight from Sunny: either way the odds out of Cloudy are the same, 30%, 40%, 30%.', state: { at: 'Cloudy', history: ['Sunny', 'Rainy'] } },
  { label: 'Run 20 steps', text: 'Twenty days of weather, one draw each. It keeps coming back to sunny, because sunny holds on to itself most.', state: { at: 'Sunny', run: 20 } },
];

const POS = { Sunny: [70, 60], Cloudy: [330, 60], Rainy: [200, 210] };
const R = 34, SEED = 7, TICK = 300;
const word = s => s.toLowerCase();

function arrows(at) {
  let s = '';
  for (const from of MDP.states) for (const r of oddsFrom(MDP, from)) {
    if (r.to === from) continue;
    const [ax, ay] = POS[from], [bx, by] = POS[r.to];
    const d = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / d, uy = (by - ay) / d, nx = -uy * 12, ny = ux * 12;
    const x1 = ax + ux * R + nx, y1 = ay + uy * R + ny, x2 = bx - ux * (R + 6) + nx, y2 = by - uy * (R + 6) + ny;
    const col = from === at ? 'var(--signal)' : 'var(--stage-dim)';
    const hx = x2 - ux * 9, hy = y2 - uy * 9;
    s += `<g style="color:${col}"><line x1="${x1}" y1="${y1}" x2="${hx}" y2="${hy}" stroke="currentColor" stroke-width="2"/>`
      + `<polygon points="${x2},${y2} ${hx - uy * 5},${hy + ux * 5} ${hx + uy * 5},${hy - ux * 5}" fill="currentColor"/>`
      + `<text x="${(x1 + x2) / 2 + nx * 1.4}" y="${(y1 + y2) / 2 + ny * 1.4}" text-anchor="middle" dominant-baseline="central" font-size="14" font-weight="700" fill="currentColor">${Math.round(r.p * 100)}%</text></g>`;
  }
  return s;
}

function nodes(at) {
  return MDP.states.map(st => {
    const [x, y] = POS[st], stay = oddsFrom(MDP, st).find(r => r.to === st).p, here = st === at;
    return `<circle cx="${x}" cy="${y}" r="${R}" style="fill:var(--stage-2);stroke:${here ? 'var(--signal)' : 'var(--stage-dim)'}" stroke-width="${here ? 4 : 2}"/>`
      + `<text x="${x}" y="${y - 4}" text-anchor="middle" dominant-baseline="central" font-size="14" font-weight="700" style="fill:var(--stage-ink)">${st}</text>`
      + `<text x="${x}" y="${y + 14}" text-anchor="middle" dominant-baseline="central" font-size="12" style="fill:var(--stage-dim)">stay ${Math.round(stay * 100)}%</text>`
      + (here ? `<circle cx="${x}" cy="${y - R - 12}" r="8" style="fill:var(--signal)"/>` : '');
  }).join('');
}

export function mountPlayground(root) {
  root.innerHTML = `
    <div class="stage-head"><span><b>Press Step and watch the weather move</b></span><span>Steps <b class="num" data-r="n">0</b></span><span>Reward <b class="num" data-r="tot">0</b></span></div>
    <svg viewBox="0 -16 400 286" role="img" data-r="map" style="display:block;width:100%;height:auto;max-height:340px" aria-label="Three weather states, sunny, cloudy and rainy, with the odds of moving between them on the arrows."></svg>
    <div class="readout" style="border-left:0;border-top:1px solid var(--stage-2)" aria-live="polite">
      <div><span class="who">Now</span><p data-r="now"></p><p data-r="path"></p></div>
      <div><span class="who">Odds from here</span><p data-r="odds"></p><p>Next state depends only on <b data-r="cur"></b>, not how it got here.</p></div>
    </div>
    <div class="stage-foot"><button type="button" class="sbtn primary" data-r="step">Step</button><button type="button" class="sbtn" data-r="run">Run 20 steps</button></div>`;
  const $ = n => root.querySelector(`[data-r="${n}"]`);
  let at = 'Sunny', path = [], steps = 0, total = 0, left = 0, last = 0, raf = 0, rng = mulberry32(SEED);

  const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function render() {
    $('map').innerHTML = arrows(at) + nodes(at);
    $('now').textContent = `It is ${word(at)}.`;
    $('path').textContent = path.length ? `Path so far: ${[...path.slice(-6), at].join(' → ')}` : 'No steps yet.';
    $('odds').textContent = oddsFrom(MDP, at).map(r => `${Math.round(r.p * 100)}% ${word(r.to)}`).join(', ');
    $('cur').textContent = word(at);
    $('n').textContent = steps;
    $('tot').textContent = total;
  }

  function step() {
    const r = stepMdp(MDP, at, rng);
    path.push(at);
    at = r.to;
    steps++;
    total += r.reward;
  }

  // Animate only while the page is visible and the stage is on screen.
  let onScreen = true;
  const live = () => onScreen && !document.hidden;
  function loop(t) {
    raf = 0;
    if (!live() || left <= 0) return;
    if (t - last >= TICK) { last = t; step(); left--; render(); }
    if (left > 0) raf = requestAnimationFrame(loop);
  }
  function wake() { if (left > 0 && live() && !raf) raf = requestAnimationFrame(loop); }
  document.addEventListener('visibilitychange', wake);
  if (typeof IntersectionObserver === 'function') new IntersectionObserver(es => { onScreen = es[es.length - 1].isIntersecting; wake(); }).observe(root);

  function run(n) {
    if (reduced()) { for (let i = 0; i < n; i++) step(); left = 0; render(); }
    else { left += n; wake(); }
  }

  function apply(state) {
    at = state.at; path = [...(state.history ?? [])]; steps = 0; total = 0; left = 0; rng = mulberry32(SEED);
    render();
    if (state.run) run(state.run);
  }

  $('step').addEventListener('click', () => { step(); render(); });
  $('run').addEventListener('click', () => run(20));
  apply(presets[0].state);
  return { apply };
}
