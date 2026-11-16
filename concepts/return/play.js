// The return playground: a row of upcoming rewards, one discount slider, and the running return. Builds its own markup.
import { REWARDS, discounted, returnOf } from './sim.js';

export const presets = [
  { label: 'No discount', text: 'Discount 1: every reward counts in full, so the far-off 10 counts as 10.', state: { gamma: 1 } },
  { label: 'Discount 0.9', text: 'Discount 0.9: each step further away counts a tenth less, so the far 10 shrinks to about 4.8.', state: { gamma: 0.9 } },
  { label: 'Near-sighted', text: 'Discount 0.5: each step halves the reward, so the far 10 all but vanishes and only the near rewards matter.', state: { gamma: 0.5 } },
];

const show = v => (v >= 10 ? String(Math.round(v)) : v.toFixed(1));

export function mountPlayground(root) {
  root.innerHTML = `
    <div class="stage-head"><span><b>Slide the discount and watch the far-off rewards shrink</b></span></div>
    <div class="bars" role="img" aria-label="Eight upcoming rewards. The bars shrink the further away they are."></div>
    <div class="dials one">
      <div class="dial"><label for="ret-gamma">Discount <b class="num" data-r="gv">0.90</b></label>
        <input id="ret-gamma" data-r="gamma" type="range" min="0" max="1" step="0.01" value="0.9">
        <span class="say">each step away multiplies the reward by this</span></div>
    </div>
    <div class="stage-foot"><span class="sum" aria-live="polite" data-r="sum"></span></div>`;
  const $ = n => root.querySelector(`[data-r="${n}"]`);
  const slider = $('gamma'), bars = root.querySelector('.bars');

  function render() {
    const g = Number(slider.value), d = discounted(REWARDS, g);
    $('gv').textContent = g.toFixed(2);
    bars.innerHTML = REWARDS.map((r, t) => `
      <div class="rbar"><div class="track"><div class="fill" style="height:${(d[t] / 10) * 100}%"></div></div>
        <span class="num">${show(d[t])}</span><span class="step">${t === 0 ? 'now' : '+' + t}</span></div>`).join('');
    $('sum').innerHTML = `Return = ${d.map(show).join(' + ')} = <b class="num">${returnOf(REWARDS, g).toFixed(2)}</b>`;
  }

  slider.addEventListener('input', render);

  function apply(state) { slider.value = state.gamma; render(); }

  // No animation loop and no canvas: the markup is rebuilt only on input, so nothing runs while hidden and no theme redraw is needed.
  apply(presets[1].state);
  return { apply };
}
