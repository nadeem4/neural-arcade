// Reward City page: the reward sliders, live training, the drive, receipt, verdict and the goal.
// The footer is mounted by assets/game-page.js; the top bar is in the page and the lamp is wired here.
import { wireLamp } from '../../assets/theme.js';
import { SUN, MOON } from '../../assets/site.js';
import { SEED, EPISODES, GOAL_SECONDS } from './presets.js';
import { loadWorld } from './sim.js';
import { createJobs, trainInChunks } from './jobs.js';
import { buildReceipt, nextStepOf } from './receipt.js';
import { INFO, goalReached, shareLine } from './words.js';
import { FIELDS, defaultRewards, createSession, recordTry } from './reward.js';
import { webglAvailable, chooseStage } from './stage.js';
import { motionAllowed, routeFrames } from './playback.js';
import { tripEvents, tagsFor, foldTag } from './events.js';
import { driveTrack } from './drive.js';
import { meterAt, meterText } from './meter.js';
import { minimapModel, drawMinimap } from './minimap.js';
import { createSound } from './sound.js';

const $ = id => document.getElementById(id);
const signed = n => (n > 0 ? '+' : '') + n;

let world = null, cellM = 12, stage = null, session = createSession(), rewards = defaultRewards();
let shown = 0, worker = null, workerOk = typeof Worker === 'function', latest = 0, msgId = 0, shareText = '';
const pending = new Map(); // message id -> { resolve, reject, onProgress }
const say = text => { $('status').textContent = text; };

// ---------- Drive HUD: live meter, floating tags, minimap, sound ----------
const MUTE_KEY = 'rc-muted';
const loadMuted = () => { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; } };
const sound = createSound({ muted: loadMuted(), reducedMotion: !motionAllowed() });
let hud = null; // { events, route, done } while a trip is on screen

function showMeter(on) { $('meter').hidden = !on; $('minimap').hidden = !on; }
// A tag that repeats on the next step grows a count (x2, x3) on the same bubble instead of stacking another.
function popTag(tag, at, i) {
  const prev = hud.lastTag?.[tag.text];
  const run = foldTag(prev, tag, i);
  let span = run.count > 1 && prev.span.isConnected ? prev.span : null;
  if (!span) { span = document.createElement('span'); $('labels').append(span); }
  hud.lastTag = { ...hud.lastTag, [tag.text]: { ...run, span } };
  span.className = `tag ${tag.kind}`; span.textContent = run.label;
  span.style.left = at.x + 'px'; span.style.top = at.y + 'px';
  span.style.animation = 'none'; void span.offsetWidth; span.style.animation = ''; // replay the pop
  clearTimeout(span._t); span._t = setTimeout(() => span.remove(), 1400);
}
// One frame of the drive: the meter and minimap follow the taxi; each tile it finishes can fire tags and a blip.
function hudFrame(state, at) {
  if (!hud) return;
  const m = meterAt(hud.events, state.progress);
  $('meterTotal').textContent = meterText(m.total);
  $('meterCounts').textContent = `${m.seconds} s · ${m.counts.tiles} tiles · off ${m.counts.off} · red ${m.counts.red} · wrong ${m.counts.wrong}`;
  const c = $('minimap');
  drawMinimap(c.getContext('2d'), minimapModel(world, hud.route, state.progress, hud.events), c.width);
  for (; hud.done < Math.min(state.stepIndex, hud.events.steps.length); hud.done++) {
    if (!at) continue; // the end jump under reduced motion: no tags, no sound
    const step = hud.events.steps[hud.done];
    const tags = tagsFor(step, hud.rewards);
    tags.forEach((t, k) => popTag(t, { x: at.x, y: at.y - k * 26 }, hud.done));
    sound.play(step.red ? 'red' : step.done ? 'fare' : step.off || step.wrong ? 'fine' : step.moved ? 'tick' : null);
  }
}
function startHud(events, route, rewards_) {
  hud = { events, route, rewards: { ...rewards_ }, done: 0 };
  showMeter(stage.ready);
  hudFrame({ progress: 0, stepIndex: 0 }, null);
}

// ---------- Training: Web Worker, else the main thread in chunks ----------
function settleAll(value) { for (const p of pending.values()) p.resolve(value); pending.clear(); }
function killWorker() { if (worker) worker.terminate(); worker = null; settleAll(null); }

function viaWorker(req, onProgress) {
  return new Promise((resolve, reject) => {
    if (!worker) {
      try {
        worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
      } catch (e) { reject(e); return; }
      worker.onmessage = ({ data }) => {
        const p = pending.get(data.id);
        if (!p) return;
        if (data.type === 'progress') p.onProgress(data);
        else if (data.type === 'done') { pending.delete(data.id); p.resolve(data); }
        else if (data.type === 'error') { pending.delete(data.id); p.reject(new Error(data.message)); }
      };
      worker.onerror = e => {
        const err = new Error(e.message || 'worker failed to load');
        for (const p of pending.values()) p.reject(err);
        pending.clear();
      };
    }
    const id = ++msgId;
    for (const [old, p] of pending) { p.resolve(null); pending.delete(old); } // superseded runs settle with null
    pending.set(id, { resolve, reject, onProgress });
    worker.postMessage({ type: 'train', id, ...req });
  });
}

async function runTrain(req, onProgress) {
  const mine = ++latest;
  if (workerOk) {
    try { return await viaWorker(req, onProgress); } catch {
      if (mine !== latest) return null;
      workerOk = false; killWorker();
      say('Training in the background did not start, so it runs here instead. It may take a few seconds.');
    }
  }
  return trainInChunks(world, req, onProgress, 50, () => mine !== latest);
}
const jobs = createJobs(runTrain);

// ---------- Reward sliders ----------
const readRewards = () => Object.fromEntries(FIELDS.map(f => [f.key, Number($(f.key).value)]));
function showReward() {
  for (const f of FIELDS) { $(f.key).value = rewards[f.key]; $(f.key + 'Out').textContent = String(rewards[f.key]); }
}

// ---------- The panel: open, or folded away to a tab (desktop) or a handle (phone) ----------
function setPanel(open) {
  $('play').dataset.collapsed = String(!open);
  for (const id of ['panelToggle', 'panelTab']) $(id).setAttribute('aria-expanded', String(open));
  $('panelToggle').firstElementChild.textContent = open ? 'Hide ›' : 'Show ▴';
  const next = open ? $('panelToggle') : $('panelTab');
  if (next.offsetParent) next.focus(); // the tab is not shown on a phone, where the handle stays
}

// A press of Train brings the map back if the player had scrolled down to the brief.
function showStage() {
  const r = $('play').getBoundingClientRect();
  if (r.top < -40 || r.top > innerHeight * 0.2) $('play').scrollIntoView({ behavior: motionAllowed() ? 'smooth' : 'auto', block: 'start' });
}

// ---------- Receipt, verdict, goal ----------
function showReceipt(a) {
  const { lines, total } = buildReceipt(rewards, a);
  const row = (cls, left, right) => {
    const d = document.createElement('div'); d.className = cls;
    for (const t of [left, right]) { const s = document.createElement('span'); s.textContent = t; d.append(s); }
    return d;
  };
  $('receipt').replaceChildren(
    ...lines.map(l => row('row', l.detail ? `${l.label}: ${l.detail}` : l.label, signed(l.amount))),
    row('row total', 'Total', signed(total)));
  const verdict = nextStepOf(rewards, a);
  $('verdict').textContent = verdict; $('verdictFloat').textContent = verdict; $('announce').textContent = verdict;
}
function showGoal(a) {
  const goal = $('goal'), share = $('share');
  if (goalReached(a)) {
    goal.textContent = `Fixed. A legal trip in ${a.seconds} s, under ${GOAL_SECONDS} s.`;
    shareText = shareLine(session.tries, a);
    $('shareText').textContent = shareText;
    share.hidden = false;
  } else {
    goal.textContent = `Fix the taxi: a legal trip under ${GOAL_SECONDS} s. Tries so far: ${session.tries}.` +
      (session.best ? ` Best legal trip: ${session.best.seconds} s.` : '');
    share.hidden = true;
  }
}

// ---------- One training run ----------
async function train(req) {
  const progress = $('progress');
  if (!stage) return;
  progress.value = 0; progress.hidden = false; $('driving').hidden = true; $('train').dataset.stale = 'false'; say('Training the taxi…');
  for (const id of ['verdict', 'verdictFloat', 'announce']) $(id).textContent = '';
  const run = ++shown; // a drive that is interrupted must not show its receipt
  stage.clearRoute(); hud = null; showMeter(false);
  try {
    const res = await jobs.start({ seed: SEED, rewards: req, episodes: EPISODES },
      p => { progress.value = Math.round(100 * p.done / p.total); if (p.visits) stage.setHeat(p.visits); });
    if (!res) return; // a newer run took over
    progress.hidden = true; say('');
    rewards = req;
    session = recordTry(session, res.analysis);
    stage.setHeat(res.visits);
    if (run === shown) $('driving').hidden = false;
    const events = tripEvents(world, req, res.route);
    const track = driveTrack(routeFrames(world, cellM, res.route), events);
    startHud(events, res.route, req);
    stage.playTrip({ track, events, onFrame: hudFrame, onDone() { if (run === shown) { $('driving').hidden = true; showReceipt(res.analysis); showGoal(res.analysis); $('announce').textContent += ' ' + $('goal').textContent; } } });
  } catch {
    progress.hidden = true;
    say('Training failed. Reload the page and try again.');
  }
}
function reset() {
  jobs.cancel(); latest++; killWorker(); shown++;
  session = createSession(); rewards = defaultRewards(); hud = null; showMeter(false);
  for (const id of ['receipt', 'verdict', 'verdictFloat', 'announce', 'goal']) $(id).textContent = '';
  $('share').hidden = true; $('progress').hidden = true; $('driving').hidden = true; say('');
  showReward();
  train(rewards);
}

// ---------- Wiring ----------
function build() {
  for (const f of FIELDS) {
    $(f.key).addEventListener('input', () => { rewards = readRewards(); showReward(); $('train').dataset.stale = 'true'; });
  }
  $('train').addEventListener('click', () => { sound.unlock(); showStage(); train(readRewards()); });
  $('mute').addEventListener('click', () => {
    const muted = $('mute').getAttribute('aria-pressed') !== 'true';
    $('mute').setAttribute('aria-pressed', String(muted)); $('mute').textContent = muted ? 'Sound off' : 'Sound on';
    sound.setMuted(muted);
    try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* storage blocked: the choice lasts this visit */ }
  });
  $('reset').addEventListener('click', () => { showStage(); reset(); });
  for (const id of ['panelToggle', 'panelTab']) $(id).addEventListener('click', () => setPanel($('play').dataset.collapsed === 'true'));
  $('copy').addEventListener('click', async () => {
    const text = shareText;
    try {
      await navigator.clipboard.writeText(text);
      $('copy').textContent = 'Copied';
      setTimeout(() => { $('copy').textContent = 'Copy'; }, 1500);
    } catch {
      const input = document.createElement('input');
      input.readOnly = true; input.value = text; input.setAttribute('aria-label', 'Share line');
      $('shareText').replaceChildren(input); input.select();
    }
  });
  document.querySelectorAll('.info-text[data-info]').forEach(p => { p.textContent = INFO[p.dataset.info]; });
  document.querySelectorAll('.info').forEach(btn => btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', String(open));
    $(btn.getAttribute('aria-controls')).hidden = !open;
  }));
}

const controls = () => [...FIELDS.map(f => $(f.key)), $('train'), $('reset')];
const enable = on => controls().forEach(c => { c.disabled = !on; });

function setupChase() {
  const btn = $('chase');
  if (!stage.ready || !motionAllowed()) {
    btn.disabled = true;
    btn.title = stage.ready ? 'Off because your device asks for reduced motion.' : 'Needs the 3D view.';
    return;
  }
  btn.addEventListener('click', () => {
    const on = btn.getAttribute('aria-pressed') !== 'true';
    btn.setAttribute('aria-pressed', String(on));
    stage.setChase(on);
  });
}

async function start() {
  $('lamp').innerHTML = SUN + MOON;
  wireLamp($('lamp'), () => {});
  build();
  if (loadMuted()) { $('mute').setAttribute('aria-pressed', 'true'); $('mute').textContent = 'Sound off'; }
  showReward();
  enable(false);
  try {
    const city = await (await fetch(new URL('./chicago.json', import.meta.url))).json();
    world = loadWorld(city); cellM = city.cellM;
    // scene.js (and three.js) load only when WebGL exists; if that import fails, chooseStage shows the no-WebGL note.
    const webgl = webglAvailable();
    const scene = webgl ? await import('./scene.js').catch(() => null) : null;
    const make3d = scene ? (el, c) => scene.createScene(el, c, { phone: scene.isPhone(), labels: $('labels'), onChaseOff: () => { $('chase').setAttribute('aria-pressed', 'false'); if (!motionAllowed()) { $('chase').disabled = true; $('chase').title = 'Off because your device asks for reduced motion.'; } } }) : null;
    stage = chooseStage($('stage'), city, { webgl, make3d });
  } catch {
    say('The map did not load. Reload the page to try again.');
    return;
  }
  enable(true);
  setupChase();
  train(rewards); // the default reward, trained and driven on load
}
start();
