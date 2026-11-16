// Reward City page: pay slip sliders, Try cards, live training, receipt, verdict and the goal.
// The site header and footer are mounted here because assets/game-page.js skips games not yet listed.
import { mountSite } from '../../assets/site.js';
import { PRESETS, SEED, EPISODES, GOAL_SECONDS } from './presets.js';
import { loadWorld } from './sim.js';
import { createJobs, trainInChunks } from './jobs.js';
import { buildReceipt, verdictOf } from './receipt.js';
import { INFO, goalReached, shareLine } from './words.js';
import { FIELDS, cardMatching, createSession, recordTry } from './payslip.js';
import { webglAvailable, chooseStage } from './stage.js';
import { motionAllowed } from './playback.js';

const $ = id => document.getElementById(id);
const signed = n => (n > 0 ? '+' : '') + n;

let world = null, stage = null, session = createSession(), rewards = { ...PRESETS[0].rewards };
let shown = 0, worker = null, workerOk = typeof Worker === 'function', latest = 0, msgId = 0, shareText = '';
const pending = new Map(); // message id -> { resolve, reject, onProgress }
const say = text => { $('status').textContent = text; };

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

// ---------- Pay slip ----------
const readRewards = () => Object.fromEntries(FIELDS.map(f => [f.key, Number($(f.key).value)]));
function showSlip() {
  for (const f of FIELDS) { $(f.key).value = rewards[f.key]; $(f.key + 'Out').textContent = String(rewards[f.key]); }
  const card = cardMatching(rewards);
  for (const b of $('cards').children) b.setAttribute('aria-pressed', String(b.dataset.id === card));
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
  $('verdict').textContent = verdictOf(rewards, a);
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
  progress.value = 0; $('train').dataset.stale = 'false'; say('');
  const run = ++shown; // a drive that is interrupted must not show its receipt
  stage.clearRoute();
  try {
    const res = await jobs.start({ seed: SEED, rewards: req, episodes: EPISODES },
      p => { progress.value = Math.round(100 * p.done / p.total); if (p.visits) stage.setHeat(p.visits); });
    if (!res) return; // a newer run took over
    progress.value = 100;
    rewards = req;
    session = recordTry(session, res.analysis);
    stage.setHeat(res.visits);
    stage.showRoute(res.route, res.analysis, { onDone() { if (run === shown) { showReceipt(res.analysis); showGoal(res.analysis); } } });
  } catch {
    progress.value = 0;
    say('Training failed. Reload the page and try again.');
  }
}
function pick(id) {
  rewards = { ...PRESETS.find(p => p.id === id).rewards };
  showSlip();
  train(rewards);
}

// ---------- Wiring ----------
function build() {
  for (const p of PRESETS) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'card-btn'; b.dataset.id = p.id; b.setAttribute('aria-pressed', 'false');
    const name = document.createElement('b'), text = document.createElement('span');
    name.textContent = p.name; text.textContent = p.text;
    b.append(name, text);
    b.addEventListener('click', () => pick(p.id));
    $('cards').append(b);
  }
  for (const f of FIELDS) {
    $(f.key).addEventListener('input', () => { rewards = readRewards(); showSlip(); $('train').dataset.stale = 'true'; });
  }
  $('train').addEventListener('click', () => train(readRewards()));
  $('reset').addEventListener('click', () => {
    jobs.cancel(); latest++; killWorker();
    session = createSession();
    for (const id of ['receipt', 'verdict', 'goal']) $(id).textContent = '';
    $('share').hidden = true; say('');
    pick(PRESETS[0].id);
  });
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

const controls = () => [...$('cards').children, ...FIELDS.map(f => $(f.key)), $('train'), $('reset')];
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
  mountSite('../../');
  $('crumb').innerHTML = '<a href="../">Games</a> / Reward City';
  build();
  showSlip();
  enable(false);
  try {
    const city = await (await fetch(new URL('./chicago.json', import.meta.url))).json();
    world = loadWorld(city);
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
  pick(PRESETS[0].id);
}
start();
