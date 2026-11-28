// Level 1 (agent and environment), and the play engine level 2 reuses: you drive the robot, or hand over to the AI.
// The AI is shown only { x, y, reward } after each step: that is the lesson.
import { ROOM, START, step, valueIteration, greedyPolicy } from './sim.js';
import { stateId, ACTIONS } from '../../assets/grid.js';
import { outcomeNote } from './words.js';

const GAMMA = 0.9;
const BEAT = 450; // ms between the AI's steps
const KEYS = { ArrowUp: 0, ArrowDown: 1, ArrowLeft: 2, ArrowRight: 3 };

let POLICY;
const policy = () => (POLICY ??= greedyPolicy(ROOM, valueIteration(ROOM, { gamma: GAMMA }), { gamma: GAMMA }));

export const initial = () => ({ pos: { ...START }, steps: 0, total: 0, done: false, outcome: null, mode: 'you', lastObs: null, lastAction: null, lastStep: null });

function act(s, action) {
  const r = step(ROOM, s.pos, action);
  const outcome = r.done ? (ROOM.cells[r.pos.y][r.pos.x] === 'T' ? 'treasure' : 'pit') : null;
  return {
    ...s, pos: r.pos, steps: s.steps + 1, total: s.total + r.reward, done: r.done, outcome,
    lastObs: { x: r.pos.x, y: r.pos.y, reward: r.reward }, lastAction: action, lastStep: { pos: s.pos, action, reward: r.reward },
  };
}

const RIGHT = 3;
const TURN_TABS = [
  { label: '1 You are the agent', hint: 'Press the arrow buttons yourself. You are the agent: you pick the move, the room answers.' },
  { label: '2 Answer off', hint: "The room's answer is cut, so the robot never hears where it is. Press Step: it keeps sending Right." },
  { label: '3 Answer on', hint: 'Press Step. Each turn the agent sends one action and the room answers.' },
];
export const tabsHtml = TURN_TABS.map((t, i) => `<button type="button" id="tab${i + 1}">${t.label}</button>`).join('');

// Arrow keys and room clicks drive the robot only while canDrive(): not from the level links or a form control.
function wireDrive(on, ui, pos, canDrive, move) {
  on(document, 'keydown', e => {
    if (!(e.key in KEYS) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (!canDrive() || e.target.closest?.('#levels, input, select, textarea')) return;
    e.preventDefault(); // stops the page scrolling under the arrow
    move(KEYS[e.key]);
  });
  on(ui.canvas, 'click', e => {
    const c = ui.cellAt(e), p = pos();
    const a = c ? ACTIONS.findIndex(({ dx, dy }) => p.x + dx === c.x && p.y + dy === c.y) : -1;
    if (a >= 0) move(a);
  });
}

// Events: move (you), turn (the agent acts; without the answer it believes it never left the start and sends Right), handover, aiStep, restart.
// Nothing moves once the episode is done, until restart.
export function reduce(s, ev) {
  if (ev.type === 'restart') return initial();
  if (s.done) return s;
  if (ev.type === 'turn') return act(s, ev.answer ? policy()[stateId(ROOM, s.pos)] : RIGHT);
  if (ev.type === 'handover') return { ...s, mode: 'ai' };
  if (ev.type === 'move' && s.mode === 'you') return act(s, ev.action);
  if (ev.type === 'aiStep' && s.mode === 'ai') return act(s, policy()[stateId(ROOM, s.pos)]);
  return s;
}

// The shared level: opts.handover is the button label, opts.onStep(state, tags) lets level 2 add its log and floating tags.
export function mountPlay(ui, { handover, onStep, onRestart } = {}) {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ac = new AbortController(), on = (t, ev, fn) => t.addEventListener(ev, fn, { signal: ac.signal });
  const pads = [...ui.panel.querySelectorAll('[data-move]')];
  const handBtn = ui.panel.querySelector('#handover'), restartBtn = ui.panel.querySelector('#restart');
  let s = initial(), timer = null;
  handBtn.textContent = handover;

  const stop = () => { clearInterval(timer); timer = null; };
  function paint() {
    const tags = onStep ? onStep.tags(s) : [];
    ui.draw({ agent: s.pos, tags });
    for (const b of [...pads, handBtn]) b.disabled = s.done || (s.mode === 'ai');
    ui.readout(s.steps, s.total);
    ui.sees(s.lastObs ? `x ${s.lastObs.x}, y ${s.lastObs.y}, reward ${s.lastObs.reward}` : 'Nothing yet');
  }
  function apply(ev) {
    const before = s;
    s = reduce(s, ev);
    if (s.steps === before.steps) return;
    ui.flash();
    onStep?.record(s);
    if (s.done) { stop(); ui.say(outcomeNote(s.outcome, s.total)); }
  }
  function tick() {
    if (document.hidden) return; // paused with the tab
    apply({ type: 'aiStep' });
    paint();
  }
  function handOver() {
    apply({ type: 'handover' });
    if (reduceMotion) { for (let i = 0; i < 60 && !s.done; i++) apply({ type: 'aiStep' }); } else timer = setInterval(tick, BEAT);
    paint();
  }
  const move = action => { apply({ type: 'move', action }); paint(); };

  pads.forEach(b => on(b, 'click', () => move(Number(b.dataset.move))));
  on(handBtn, 'click', handOver);
  on(restartBtn, 'click', () => { stop(); s = initial(); onRestart?.(); ui.say(''); paint(); });
  wireDrive(on, ui, () => s.pos, () => !s.done && s.mode === 'you', move);

  paint();
  return { destroy() { stop(); ac.abort(); }, redraw: paint };
}

const cap = name => name[0].toUpperCase() + name.slice(1);

// Level 1: three steps. You drive; then the agent acts with the room's answer cut; then with it on, one Step press per turn.
export function mount(ui) {
  const ac = new AbortController(), on = (t, ev, fn) => t.addEventListener(ev, fn, { signal: ac.signal });
  const $ = sel => ui.panel.querySelector(sel);
  const pad = $('#pad'), stepBtn = $('#stepBtn'), turn = $('#turn');
  const moveBtns = [...ui.panel.querySelectorAll('[data-move]')];
  let s = initial(), tab = 1;

  function paint() {
    ui.draw({ agent: s.pos, tags: [] });
    ui.readout(s.steps, s.total);
    ui.sees(tab === 2 ? 'Nothing: the answer is cut' : s.lastObs ? `x ${s.lastObs.x}, y ${s.lastObs.y}, reward ${s.lastObs.reward}` : 'Nothing yet');
    pad.hidden = tab !== 1;
    stepBtn.hidden = tab === 1;
    stepBtn.disabled = s.done;
    for (const b of moveBtns) b.disabled = s.done;
    turn.hidden = tab !== 3 || !s.lastObs;
    if (!turn.hidden) {
      $('#turnSends').textContent = `Agent sends: action ${cap(ACTIONS[s.lastAction].name)}`;
      $('#turnAnswers').textContent = `Room answers: reward ${s.lastObs.reward}, now at x ${s.lastObs.x}, y ${s.lastObs.y}`;
    }
  }
  function apply(ev) {
    const before = s;
    s = reduce(s, ev);
    if (s.steps === before.steps) return;
    ui.flash();
    if (s.done) ui.say(outcomeNote(s.outcome, s.total));
  }
  function show(n) {
    tab = n; s = initial(); ui.say('');
    $('#stepHint').textContent = TURN_TABS[n - 1].hint;
    TURN_TABS.forEach((_, i) => { const b = $(`#tab${i + 1}`); i + 1 === n ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current'); });
    paint();
  }
  const move = action => { if (tab === 1) { apply({ type: 'move', action }); paint(); } };

  TURN_TABS.forEach((_, i) => on($(`#tab${i + 1}`), 'click', () => show(i + 1)));
  on(stepBtn, 'click', () => { apply({ type: 'turn', answer: tab === 3 }); paint(); });
  on($('#restart'), 'click', () => show(tab));
  moveBtns.forEach(b => on(b, 'click', () => move(Number(b.dataset.move))));
  wireDrive(on, ui, () => s.pos, () => !s.done && tab === 1, move);

  show(1);
  return { destroy() { ac.abort(); }, redraw: paint };
}
