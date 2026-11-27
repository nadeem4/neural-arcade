// Level 3 (return and discount): a coin 2 steps away or a chest 6 steps away, told in three steps: add up each route, see later rewards count less, turn the discount and watch the pick flip.
import { START, pathActions, discounted, returnOf, treasureWorth } from './sim.js';
import { tagTone } from './room-math.js';

const D = 1, R = 3;
export const ROUTES = [
  { id: 'coin', label: 'Coin', actions: [D, D] },
  { id: 'chest', label: 'Chest', actions: [R, R, R, D, D, R] },
];
const [COIN, CHEST] = ROUTES;

const STEP_GAMMA = 0.9; // step 2 shows the discount at one fixed, friendly value
const BEAT = 400; // ms between steps of the walk
const TABS = ['1. Add it up', '2. Later counts less', '3. Turn the dial'];
const signed = r => (r > 0 ? `+${r}` : `−${-r}`);
const fmt = n => { const v = Math.sign(n) * Math.round(Math.abs(n) * 100) / 100; return v < 0 ? `−${-v}` : `${v}`; };

export const tabsHtml = open => TABS.map((t, i) => `<button type="button" data-step="${i + 1}"${i + 1 === open ? ' aria-current="step"' : ''}>${t}</button>`).join('');

export function scoreRoute(room, route, gamma) {
  const walk = pathActions(room, START, route.actions);
  const rewards = walk.trace.map(t => t.reward);
  return {
    rewards, terms: discounted(rewards, gamma), total: returnOf(rewards, gamma),
    steps: rewards.length, outcome: walk.outcome, cells: [START, ...walk.trace.map(t => t.pos)],
  };
}

export const pickAt = (room, gamma) => (scoreRoute(room, CHEST, gamma).total > scoreRoute(room, COIN, gamma).total ? CHEST : COIN);

// The discount where the pick changes, found by halving the slider range (the chest wins above it, the coin below).
export function flipPoint(room) {
  let lo = 0.1, hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (pickAt(room, mid) === CHEST) hi = mid; else lo = mid;
  }
  return hi;
}

// A prize's size in the room: what it is still worth after `delay` steps, as a share of its full worth, never below 0.15.
export const worthScale = (delay, gamma) => Math.max(0.15, gamma ** delay);

export const discountRows = gamma => [0, 1, 2, 3, 4, 5].map(n => ({ label: n ? `${n} later` : 'now', value: fmt(treasureWorth(n, gamma)) }));

// One frame per step of the walk: where the robot is, the tag that floats there, and the discounted total so far.
export function frames(room, route, gamma) {
  const s = scoreRoute(room, route, gamma);
  let total = 0;
  return [{ pos: START, tag: null, total: 0 }, ...s.cells.slice(1).map((pos, i) => {
    total += s.terms[i];
    return { pos, tag: { x: pos.x, y: pos.y, text: signed(s.rewards[i]), tone: tagTone(s.rewards[i]) }, total };
  })];
}

export function mount(ui) {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ac = new AbortController(), on = (t, ev, fn) => t.addEventListener(ev, fn, { signal: ac.signal });
  const $ = sel => ui.panel.querySelector(sel);
  const slider = $('#gamma');
  const delay = r => r.actions.length - 1;
  const flip = flipPoint(ui.room);
  let step = 1, gamma = Number(slider.value) || STEP_GAMMA, route = null, walk = null, at = 0, timer = null, picked = null;
  const seen = {};

  const stop = () => { clearInterval(timer); timer = null; };
  const g = () => (step === 1 ? 1 : step === 2 ? STEP_GAMMA : gamma);

  function paint() {
    const f = walk?.[at], now = g();
    ui.draw({
      agent: f ? f.pos : START, ghost: walk && step !== 2 ? walk.map(w => w.pos) : null, gamma: now,
      tags: f?.tag ? [f.tag] : [], treasureScale: worthScale(delay(CHEST), now), coinScale: worthScale(delay(COIN), now),
    });
    ui.readout(at, fmt(f?.total ?? 0));
    if (step === 1) {
      const shown = walk ? walk.slice(1, at + 1) : [];
      $('#tally').textContent = shown.length ? `${shown.map(x => x.tag.text).join(' ')} = ${fmt(shown.at(-1).total)}` : '';
    }
  }

  function finish() {
    stop();
    if (step !== 1) return;
    seen[route.id] = walk.at(-1).total;
    $(`#v${route.id}`).textContent = fmt(seen[route.id]);
    if (seen.coin !== undefined && seen.chest !== undefined) {
      $('#boxchest').classList.add('win');
      $('#hint1').textContent = 'Chest wins, 5 to 1. Now: is 10 points six steps away really worth a full 10? Step 2.';
    }
  }
  function tick() {
    if (document.hidden) return; // paused with the tab
    at += 1;
    if (at >= walk.length - 1) finish();
    paint();
  }
  function go(r) {
    stop();
    route = r; walk = frames(ui.room, r, g()); at = 0;
    if (reduceMotion) { at = walk.length - 1; finish(); } else { ui.flash(); timer = setInterval(tick, BEAT); }
    paint();
  }

  function dial() {
    const c = scoreRoute(ui.room, COIN, gamma).total, t = scoreRoute(ui.room, CHEST, gamma).total, pick = t > c ? CHEST : COIN;
    $('#gammaOut').textContent = gamma.toFixed(2);
    $('#ret3coin').textContent = fmt(c);
    $('#ret3chest').textContent = fmt(t);
    $('#box3coin').classList.toggle('win', pick === COIN);
    $('#box3chest').classList.toggle('win', pick === CHEST);
    $('#pick').textContent = pick.label;
    $('#hint3').textContent = pick === CHEST
      ? `Drag below ${flip.toFixed(2)} and watch it change its mind.`
      : `Drag above ${flip.toFixed(2)} and it goes back to the chest.`;
    if (pick !== picked) { picked = pick; go(pick); return; }
    stop(); walk = frames(ui.room, pick, gamma); at = walk.length - 1; paint();
  }

  function show(n) {
    stop(); walk = null; route = null; picked = null; step = n;
    ui.panel.querySelectorAll('[data-step]').forEach(b => (Number(b.dataset.step) === n ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current')));
    ui.panel.querySelectorAll('[data-step-view]').forEach(v => { v.hidden = Number(v.dataset.stepView) !== n; });
    if (n === 3) dial(); else paint();
  }

  $('#discRows').innerHTML = discountRows(STEP_GAMMA).map(r => `<tr><td>${r.label}</td><td>${r.value}</td></tr>`).join('');
  on($('#stepTabs'), 'click', e => {
    const b = e.target.closest?.('[data-step]');
    if (b) show(Number(b.dataset.step));
  });
  on($('#sendCoin'), 'click', () => go(COIN));
  on($('#sendChest'), 'click', () => go(CHEST));
  on(slider, 'input', () => { gamma = Number(slider.value); dial(); });

  paint();
  return { destroy() { stop(); ac.abort(); }, redraw: paint };
}
