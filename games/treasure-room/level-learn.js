// Lesson 1: drive with the lights off, see what each move paid, then watch a robot learn the room over 200 tries.
import { initial, reduce, wireDrive } from './level-agent.js';
import { learn, TRIES } from './learner.js';
import { outcomeNote } from './words.js';

const BEAT = 250; // ms between the steps of a watched try
const PADS = { learnUp: 0, learnDown: 1, learnLeft: 2, learnRight: 3 };
const TABS = [
  { label: '1 Lights off', hint: 'The room is dark. You see where the robot is, not what each move paid. Make 10 moves: can you tell a good move from a bad one?' },
  { label: '2 Show rewards', hint: 'Here is what each of your moves paid. Add them up: the sum is the score of one try.' },
  { label: '3 Let it learn', hint: 'Nobody tells the robot the answer. Watch its first try, skip ahead to its 200th, and watch that one.' },
];
export const tabsHtml = TABS.map((t, i) => `<button type="button" id="learnTab${i + 1}">${t.label}</button>`).join('');

const sum = list => list.reduce((a, b) => a + b, 0);
const chips = rewards => rewards.map(r => `<span class="rwd">${r}</span>`).join('');

export function mount(ui) {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ac = new AbortController(), on = (t, ev, fn) => t.addEventListener(ev, fn, { signal: ac.signal });
  const $ = sel => ui.panel.querySelector(sel);
  let s = initial(), rewards = [], tab = 1, run = null, trained = false, timer = null;

  const stop = () => { clearInterval(timer); timer = null; };

  function paintDrive() {
    ui.draw({ agent: s.pos, tags: [] });
    const shown = tab === 2;
    ui.readout(s.steps, shown ? s.total : '?');
    $('#learnSees').textContent = `x ${s.pos.x}, y ${s.pos.y}, reward ${shown && s.lastObs ? s.lastObs.reward : '?'}`;
    $('#rewardRow').innerHTML = rewards.length ? chips(rewards) : 'Make a move in step 1 and its reward shows here.';
    $('#rewardSum').textContent = rewards.length ? `Score ${s.total}` : '';
    for (const id in PADS) $('#' + id).disabled = s.done;
  }
  function paintTab() {
    ui.lightsOff(tab === 1);
    TABS.forEach((_, i) => { const b = $(`#learnTab${i + 1}`); i + 1 === tab ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current'); });
    $('#learnHint').textContent = TABS[tab - 1].hint;
    $('#learnDrive').hidden = tab === 3;
    $('#learnRewards').hidden = tab !== 2;
    $('#learnTrain').hidden = tab !== 3;
    $('#watchLast').disabled = !trained;
    $('#learnWhy').textContent = trained ? '' : 'Press Skip to try 200 first: the robot has to learn before you can watch it.';
  }
  function show(n) {
    stop(); tab = n; ui.say('');
    if (n === 3) { ui.draw({ agent: s.pos, tags: [] }); ui.readout(0, 0); $('#learnSees').textContent = 'The robot is on its own.'; }
    else paintDrive();
    paintTab();
  }

  function move(action) {
    if (tab === 3) return;
    const before = s.steps;
    s = reduce(s, { type: 'move', action });
    if (s.steps === before) return;
    rewards.push(s.lastObs.reward);
    ui.flash();
    if (s.done && tab === 2) ui.say(outcomeNote(s.outcome, s.total));
    paintDrive();
  }

  function watch(trace, label) {
    stop(); ui.say('');
    const at = i => {
      const got = trace.rewards.slice(0, i);
      ui.draw({ agent: trace.path[i], tags: [] });
      ui.readout(i, sum(got));
      if (i === trace.rewards.length) {
        ui.say(outcomeNote(trace.outcome, trace.score));
        $('#tryNote').textContent = `${label} · Score ${trace.score} · ${trace.rewards.length} steps`;
      }
    };
    if (reduceMotion) { at(trace.rewards.length); return; }
    let i = 0;
    at(0);
    timer = setInterval(() => { if (document.hidden) return; at(++i); if (i >= trace.rewards.length) stop(); }, BEAT);
  }
  const ensure = () => (run ??= learn());

  for (const [id, a] of Object.entries(PADS)) on($('#' + id), 'click', () => move(a));
  TABS.forEach((_, i) => on($(`#learnTab${i + 1}`), 'click', () => show(i + 1)));
  on($('#learnRestart'), 'click', () => { s = initial(); rewards = []; show(1); });
  on($('#watchFirst'), 'click', () => watch(ensure().first, 'Try 1'));
  on($('#skipTrain'), 'click', () => {
    stop(); ensure(); trained = true;
    ui.curve(run.scores);
    $('#tryNote').textContent = `Try ${TRIES}`;
    paintTab();
  });
  on($('#watchLast'), 'click', () => watch(run.last, `Try ${TRIES}`));
  wireDrive(on, ui, () => s.pos, () => !s.done && tab !== 3, move);

  show(1);
  return { destroy() { stop(); ac.abort(); }, redraw() { if (trained) ui.curve(run.scores); } };
}
