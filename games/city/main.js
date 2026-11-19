// Reward City page: the rate card, live training, the drive with its HUD, and the end card.
// The footer is mounted by assets/game-page.js; the top bar is in the page and the lamp is wired here.
import { wireLamp } from '../../assets/theme.js';
import { SUN, MOON } from '../../assets/site.js';
import { SEED, EPISODES, GOAL_SECONDS } from './presets.js';
import { loadWorld } from './sim.js';
import { createJobs, trainInChunks } from './jobs.js';
import { INFO, goalReached, shareLine, goalLine } from './words.js';
import { goalAt } from './goal.js';
import { FIELDS, defaultRewards, createSession, recordTry } from './reward.js';
import { webglAvailable, chooseStage, noWebglFlag } from './stage.js';
import { motionAllowed, routeFrames } from './playback.js';
import { parseRecord, tripMs, recordApi, runSummary, pruneTags, cardRewards } from './record.js';
import { buildOffences } from './offences.js';
import { tripEvents, tagsFor, foldTag, layoutTags, TAG_LIFE_MS, tagPlace } from './events.js';
import { bakePeople } from './people.js';
import { driveTrack } from './drive.js';
import { overheadCuts } from './cuts.js';
import { SWOOP_MS } from './director.js';
import { meterAt, meterText, barFraction, payRange, payFraction } from './meter.js';
import { minimapModel, drawMinimap } from './minimap.js';
import { createSound } from './sound.js';
import { stepRate, rateRows } from './rates.js';
import { nextScreen, canToggleView } from './screens.js';
import { endCardModel } from './endcard.js';
import { createGarage, keep, remove, serialize, parse, validTaxi } from './garage.js';
import { nameFor, behaviourNames, uniqueName, noteFor } from './naming.js';
import { honestReward } from './honest.js';
import { renderGarage } from './garage-view.js';
import { solidRings } from './walls.js';
import { raceTracks, raceStateAt, result, togglePick, leaderBlips } from './race.js';
import { renderRaceBar, showRaceMeters, updateRaceHud, showBanner } from './race-view.js';
import { LADDER_KEY, cardFor, matchStep, parseRan, markRan, ladderModel } from './ladder.js';
import { buildLadder, updateLadder } from './ladder-view.js';

const $ = id => document.getElementById(id);
const peopleFor = events => bakePeople(world, cityData, events, { seed: SEED }); // the people of one trip, the same on every device; they only react, never change pay or training
const signed = n => (n > 0 ? '+' : '') + n;

let world = null, cityData = null, walls = null, cellM = 12, stage = null, session = createSession(), rewards = defaultRewards();
let picks = [], raceRun = null; // garage ids picked for a race; the race on screen: { race, names, ended }
let worker = null, workerOk = typeof Worker === 'function', latest = 0, msgId = 0, shareText = '';
const pending = new Map(); // message id -> { resolve, reject, onProgress }
const say = text => { $('status').textContent = text; };

// ---------- Drive HUD: live meter, floating tags, minimap, sound ----------
const MUTE_KEY = 'rc-muted';
const loadMuted = () => { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; } };
const sound = createSound({ muted: loadMuted(), reducedMotion: !motionAllowed() });
let rec = null; // record mode (?record=1): { now, tags } while frames are stepped by seek(ms)
let hud = null; // { events, route, done } while a trip is on screen

function showMeter(on) { showRaceMeters(false); $('meter').hidden = !on; $('meterGoal').hidden = !on; $('minimap').hidden = !on; }
const setText = (el, t) => { if (el.textContent !== t) el.textContent = t; } // only touch the DOM when the text changes
$('mapGoal').textContent = goalLine();
const setBar = (el, x) => { if (el._x !== x) { el._x = x; el.style.transform = `scaleX(${x})`; } } // only write the style when the fraction changes
// Put a tag by the taxi at `at`: kept on screen, clamped sideways, and below the meters on a phone.
function placeTag(span, at, slot) {
  const lab = $('labels').getBoundingClientRect();
  const pos = tagPlace(at, slot, { width: lab.width, tagW: span.offsetWidth, tagH: span.offsetHeight, phone: matchMedia('(max-width: 720px)').matches, meterBottom: $('meterGoal').getBoundingClientRect().bottom - lab.top, height: lab.height });
  span.style.left = pos.left + 'px'; span.style.top = pos.top + 'px';
}
// A tag that repeats on the next step grows a count (x2, x3) on the same bubble instead of stacking another.
function popTag(tag, at, i) {
  const prev = hud.lastTag?.[tag.text];
  const run = foldTag(prev, tag, i, !!prev?.span.isConnected);
  let span = run.count > 1 ? prev.span : null;
  let slot = span ? prev.slot : undefined;
  if (!span) { // a new bubble takes the lowest free slot above the taxi, so live tags never overlap
    span = document.createElement('span'); $('labels').append(span);
    const live = Object.values(hud.lastTag ?? {}).filter((t) => t.span.isConnected).map((t) => ({ slot: t.slot }));
    slot = layoutTags([...live, {}]).at(-1).slot;
    for (const t of Object.values(hud.lastTag ?? {})) if (t.slot === slot && t.span.isConnected) { t.span.remove(); if (rec) rec.tags = rec.tags.filter((x) => x.span !== t.span); } // all slots busy: the oldest tag gives way
  }
  const others = { ...hud.lastTag }; delete others[tag.text]; // re-added last, so "oldest" means least recently refreshed
  hud.lastTag = { ...others, [tag.text]: { ...run, span, slot } };
  span.className = `tag ${tag.kind}`; span.textContent = run.label;
  span._slot = slot; placeTag(span, at, slot);
  span.style.animation = 'none'; void span.offsetWidth; span.style.animation = ''; // replay the pop
  if (run.count > 1) span.style.animationDelay = `-${TAG_LIFE_MS * 0.05}ms`; // a folded tag restarts already opaque (past the 5% fade-in), so a run of offences does not blink
  if (rec) { rec.tags = rec.tags.filter(t => t.span !== span); rec.tags.push({ span, born: rec.now }); return; } // expiry follows seek time, not the wall clock
  clearTimeout(span._t); span._t = setTimeout(() => span.remove(), TAG_LIFE_MS);
}
// One frame of the drive: the meter and minimap follow the taxi; each tile it finishes can fire tags and a blip.
function hudFrame(state, at, overhead) {
  if (!hud) return;
  if (overhead && at) for (const span of $('labels').querySelectorAll('.tag')) if (span._slot !== undefined) placeTag(span, at, span._slot); // every live tag, folded or not; the overhead shot moves with the taxi, so live tags stay beside it
  const m = meterAt(hud.events, state.progress);
  setText($('meterTotal'), meterText(m.total));
  setText($('meterCounts'), `${m.seconds} s · ${m.counts.tiles} tiles · off ${m.counts.off} · red ${m.counts.red} · wrong ${m.counts.wrong}`);
  setBar($('meterBar'), payFraction(m.total, hud.range));
  const g = goalAt(hud.events, hud.people.scaresAt(Math.floor(state.progress)), state.progress, GOAL_SECONDS);
  setText($('meterGoalTotal'), String(g));
  setBar($('meterGoalBar'), barFraction(g));
  const c = $('minimap');
  drawMinimap(c.getContext('2d'), minimapModel(world, hud.route, state.progress, hud.events), c.width);
  for (; hud.done < Math.min(state.stepIndex, hud.events.steps.length); hud.done++) {
    if (!at || hud.skipped) continue; // the end jump under reduced motion, or Skip: no tags, no sound
    const step = hud.events.steps[hud.done];
    const tags = tagsFor(step, hud.rewards, hud.people.scares.filter(s => s.tick === hud.done).length);
    tags.forEach((t) => popTag(t, at, hud.done));
    if (!rec) sound.play(step.red ? 'red' : step.done ? 'fare' : step.off || step.wrong ? 'fine' : step.moved ? 'tick' : null);
  }
}
function startHud(events, route, rewards_, people) {
  hud = { events, route, people, rewards: { ...rewards_ }, done: 0, range: payRange(events) };
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
      worker.postMessage({ type: 'init', city: cityData });
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

// ---------- Screens: map (rate card), training, driving, done (end card) ----------
let screen = 'map', trip = null; // trip: { rewards, analysis, events, route, track, people, ended } for the trip on screen
let toastTimer = 0;
function toast(text) {
  const t = $('toast');
  t.textContent = text; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}
function go(event) {
  screen = nextScreen(screen, event);
  $('play').dataset.screen = screen;
  const busy = screen === 'training';
  $('endcard').hidden = screen !== 'done';
  $('barDrive').hidden = !canToggleView(screen);
  $('skip').hidden = !(screen === 'driving' || screen === 'racing');
  $('driveProgress').hidden = !(screen === 'driving' || screen === 'racing');
  $('raceBanner').hidden = screen !== 'raced';
  $('train').disabled = busy || !stage;
  $('train').textContent = busy ? 'TRAINING…' : 'TRAIN & DRIVE';
  if (busy) showGarage(false);
  showRates();
  updateInset();
}
// On a phone the map screen has a rate card sheet over the stage's lower part; the stage keeps the map centre above it.
function updateInset() {
  const sheet = $('rateCard');
  const phone = screen === 'map' && $('garageDrawer').hidden && matchMedia('(max-width: 720px)').matches; // the Garage hides the card, so its offsetTop is 0
  const top = Math.max(0, document.querySelector('.topright').getBoundingClientRect().bottom - $('play').getBoundingClientRect().top) + 8; // the top buttons, plus a margin
  stage?.setInset(phone ? $('play').clientHeight - sheet.offsetTop : 0, top);
}
addEventListener('resize', updateInset);
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(updateInset).observe($('rateCard')); // the card grows and shrinks with its content

// Back to the map from the end card or race result: the route, meters and trip are cleared, then the screen event runs.
function toMap(event) {
  jobs.cancel(); latest++; raceRun = null; stage.clearRoute(); hud = null; trip = null; showMeter(false); say('');
  $('announce').textContent = '';
  go(event);
}

// ---------- The ladder: five steps, each loads a rate card; the steps the player has run are ticked ----------
let ran = [], ladderButtons = null;
const ladderRuns = {}; // step id -> { analysis, honest } of its last run this page session
const loadRan = () => { try { ran = parseRan(localStorage.getItem(LADDER_KEY)); } catch { /* storage blocked: ticks last this visit */ } };
const saveRan = () => { try { localStorage.setItem(LADDER_KEY, JSON.stringify(ran)); } catch { /* storage blocked */ } };
function pickStep(id) {
  if (screen === 'training') return;
  rewards = cardFor(id); $('train').dataset.stale = 'true';
  showRates();
}

// ---------- The rate card ----------
function showRates() {
  if (ladderButtons) updateLadder(ladderButtons, { head: $('ladderHead'), text: $('ladderText') }, ladderModel(rewards, ran, ladderRuns), screen === 'training');
  for (const r of rateRows(rewards)) {
    const out = $(r.key + 'Out');
    out.textContent = r.text; out.className = `num tone-${r.tone}`;
    $(r.key + 'Dec').disabled = !r.canDec || screen === 'training';
    $(r.key + 'Inc').disabled = !r.canInc || screen === 'training';
  }
}
function nudge(key, dir) {
  rewards = { ...rewards, [key]: stepRate(key, rewards[key], dir) };
  $('train').dataset.stale = 'true';
  showRates();
}

// A press of Train brings the map back if the player had scrolled down to the brief.
function showStage() {
  const r = $('play').getBoundingClientRect();
  if (r.top < -40 || r.top > innerHeight * 0.2) $('play').scrollIntoView({ behavior: motionAllowed() ? 'smooth' : 'auto', block: 'start' });
}

// ---------- The end card ----------
function showEnd(t) {
  const m = endCardModel(t.rewards, t.analysis, GOAL_SECONDS, honestReward(world, t.rewards), t.people.scares.length);
  $('endTitle').textContent = `TRIP DONE · TRY ${t.tries}`;
  const flag = $('endFlag');
  flag.textContent = m.timeOk ? 'Legal and on time' : m.legal ? 'Legal, but slow' : 'Not legal';
  flag.className = 'end-flag' + (m.timeOk ? ' ok' : '');
  $('endTime').textContent = `${t.analysis.seconds} s`;
  $('endTime').className = 'big ' + (m.timeOk ? 'pay' : 'fine');
  $('endGoal').textContent = m.timeLine;
  $('endEarned').textContent = signed(m.earned);
  $('endEarned').className = 'big ' + (m.earned >= 0 ? 'pay' : 'fine');
  const row = (cls, left, right) => {
    const d = document.createElement('div'); d.className = cls;
    for (const x of [left, right]) { const s = document.createElement('span'); s.textContent = x; d.append(s); }
    return d;
  };
  $('receipt').replaceChildren(
    ...m.lines.map(l => row('row', l.detail ? `${l.label}: ${l.detail}` : l.label, signed(l.amount))),
    row('row total', 'Total', signed(m.earned)));
  $('endVerdict').textContent = m.verdict;
  $('endHonest').hidden = !m.honest;
  $('endHonestLine').textContent = m.honestLine;
  $('endCity').textContent = `What the city wanted: ${m.city} out of 100`;
  $('endScared').textContent = m.scaredLine; $('endScared').hidden = !m.scaredLine;
  $('endCheats').replaceChildren(...m.cheats.map(c => { const li = document.createElement('li'); li.textContent = c.reason; return li; }));
  const fixed = goalReached(t.analysis);
  shareText = fixed ? shareLine(t.tries, t.analysis) : '';
  $('shareText').textContent = shareText; $('share').hidden = !fixed;
  $('announce').textContent = `Trip done. ${m.timeLine}. ${m.verdict}` + (fixed ? ' Fixed.' : '');
}
// The end of a drive, reached by arriving or by Skip; the first of the two wins.
function finish(t, event) {
  if (t.ended || t !== trip) return;
  t.ended = true;
  go(event); showEnd(t);
  $('endEdit').focus({ preventScroll: true });
}

// ---------- One drive, and one training run ----------
function drive(t) {
  hud = null; raceRun = null;
  $('viewToggle').setAttribute('aria-pressed', 'false'); stage.setMapView(false);
  $('driveProgress').value = 0;
  startHud(t.events, t.route, t.rewards, t.people);
  t.ended = false;
  stage.playTrip({ track: t.track, events: t.events, people: t.people, offences: t.offences, onFrame: (st, at, overhead) => { $('driveProgress').value = Math.round(100 * st.progress / Math.max(1, t.events.steps.length)); hudFrame(st, at, overhead); }, onHonk() { if (!rec && !hud?.skipped) sound.play('horn'); }, onDone() { finish(t, 'arrived'); } });
}
async function train(req) {
  const progress = $('progress');
  if (!stage || screen === 'training') return;
  go('train');
  progress.value = 0; progress.hidden = false; $('train').dataset.stale = 'false'; say('Training the taxi…');
  $('announce').textContent = '';
  raceRun = null; stage.clearRoute(); hud = null; trip = null; showMeter(false);
  try {
    const res = await jobs.start({ seed: SEED, rewards: req, episodes: EPISODES },
      p => { progress.value = Math.round(100 * p.done / p.total); if (p.visits) stage.setHeat(p.visits); });
    if (!res) return; // a newer run took over
    progress.hidden = true; say('');
    session = recordTry(session, res.analysis);
    const step = matchStep(req);
    if (step && !rec) { ran = markRan(ran, step); saveRan(); ladderRuns[step] = { analysis: res.analysis, honest: honestReward(world, req) }; } // the step counts only if the card was not edited
    stage.setHeat(res.visits);
    const events = tripEvents(world, req, res.route);
    const track = driveTrack(routeFrames(world, cellM, res.route), events, { walls });
    trip = { tries: session.tries, rewards: { ...req }, analysis: res.analysis, events, route: res.route, track, people: peopleFor(events), offences: buildOffences(events, req, track, { world }), ended: false };
    go('trained');
    drive(trip);
  } catch {
    progress.hidden = true; go('failed');
    say('Training failed. Reload the page and try again.');
  }
}

// ---------- The garage: kept taxis in localStorage (in memory only if storage is blocked) ----------
const GARAGE_KEY = 'rc-garage-v1';
let garage = createGarage();
// Read once the map is loaded, so a stored route can be checked against it.
function loadGarage() {
  try {
    garage = parse(localStorage.getItem(GARAGE_KEY), { cellCount: world.cols * world.rows });
    garage = { ...garage, taxis: behaviourNames(garage.taxis) }; // older garages carry rate-card names
  } catch { /* storage blocked: the garage lasts this visit */ }
}
const saveGarage = () => { try { localStorage.setItem(GARAGE_KEY, serialize(garage)); } catch { /* storage blocked */ } };
// Focus goes to the first DRIVE (or Close when empty) on open, and to the Garage button when the player closes it; auto-closes leave focus alone.
const driveButtons = () => [...$('garageList').querySelectorAll('.go')];
function closeGarage() { showGarage(false); $('garage').focus(); }
// The drawer never opens over the end card or the race result: those leave for the map first.
function openGarage() { if (screen === 'done' || screen === 'raced') toMap('garage'); showGarage(true, 0); }
function showGarage(open, focusIndex) {
  $('garageDrawer').hidden = !open;
  $('play').dataset.garage = String(open); // the open Garage hides the rate card so every Race button fits
  updateInset();
  $('garage').setAttribute('aria-expanded', String(open));
  $('garageCount').textContent = garage.taxis.length;
  $('garageEmpty').hidden = garage.taxis.length > 0;
  picks = picks.filter(id => garage.taxis.some(t => t.id === id));
  renderGarage($('garageList'), garage, {
    canDrive: screen !== 'training',
    onDrive: driveKept,
    onRemove: (taxi, i) => { garage = remove(garage, taxi.id); saveGarage(); showGarage(true, i); },
    picks, canRace: !!stage?.ready && screen !== 'training', raceTitle: stage?.ready ? '' : 'Racing needs the 3D view.',
    onPick: (taxi, i) => { picks = togglePick(picks, taxi.id); showGarage(true); $('garageList').querySelectorAll('.bay-race')[i]?.focus(); },
  });
  renderRaceBar(picks.map(id => garage.taxis.find(t => t.id === id).name));
  if (open && focusIndex !== undefined) (driveButtons()[focusIndex] ?? driveButtons().pop() ?? $('garageClose')).focus();
}
function keepTrip(t) {
  const name = uniqueName(nameFor(t.analysis), garage.taxis.map(x => x.name));
  garage = keep(garage, {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, tries: t.tries,
    rewards: { ...t.rewards }, route: t.route, analysis: t.analysis,
    bestSeconds: t.analysis.seconds, note: noteFor(t.analysis), keptAt: Date.now(),
  });
  saveGarage(); openGarage();
  toast(`Kept as ${garage.taxis[0].name}`);
}
// DRIVE from a bay: its rates go into the rate card, then the stored route plays through the same path as a fresh trip, with no training.
function driveKept(taxi) {
  if (!stage || screen === 'training' || !validTaxi(taxi, world.cols * world.rows)) return;
  showGarage(false);
  jobs.cancel(); latest++; sound.unlock();
  rewards = { ...taxi.rewards };
  const events = tripEvents(world, taxi.rewards, taxi.route);
  const track = driveTrack(routeFrames(world, cellM, taxi.route), events, { walls });
  trip = { tries: taxi.tries, rewards: { ...taxi.rewards }, analysis: taxi.analysis, events, route: taxi.route, track, people: peopleFor(events), offences: buildOffences(events, taxi.rewards, track, { world }), ended: false };
  raceRun = null; stage.clearRoute(); $('train').dataset.stale = 'false'; $('announce').textContent = '';
  go('replay');
  drive(trip);
}

// RACE from the garage: both picked taxis are checked first, then they drive the same trip on the same lights, side by side.
function startRace() {
  const cells = world.cols * world.rows;
  const chosen = picks.map(id => garage.taxis.find(t => t.id === id));
  if (!stage?.ready || screen === 'training' || chosen.length !== 2 || !chosen.every(t => validTaxi(t, cells))) return;
  let race;
  try { race = raceTracks(world, cellM, chosen, walls); } catch { toast('Those two taxis start from different places.'); return; }
  showGarage(false);
  jobs.cancel(); latest++; sound.unlock();
  raceRun = null; hud = null; trip = null; stage.clearRoute();
  $('viewToggle').setAttribute('aria-pressed', 'false'); stage.setMapView(false);
  $('train').dataset.stale = 'false'; $('announce').textContent = ''; $('driveProgress').value = 0;
  const run = raceRun = { race, names: chosen.map(t => t.name), ended: false, done: [0, 0], skipped: false };
  go('race');
  showRaceMeters(true, run.names); updateRaceHud(world, race, raceStateAt(race, 0));
  stage.playRace({
    race,
    onFrame: rs => {
      $('driveProgress').value = Math.round(100 * Math.max(...rs.cars.map((c, i) => c.state.progress / Math.max(1, race.cars[i].events.steps.length))));
      updateRaceHud(world, race, rs);
      const b = leaderBlips(race, rs, run.done); run.done = b.done;
      if (!run.skipped) for (const step of b.steps) sound.play(step.red ? 'red' : step.done ? 'fare' : step.off || step.wrong ? 'fine' : step.moved ? 'tick' : null);
    },
    onDone: () => finishRace(run, 'finished'),
  });
}
// The end of a race, by both cars arriving or by Skip; the first of the two wins. The banner gets focus.
function finishRace(run, event) {
  if (run.ended || run !== raceRun) return;
  run.ended = true;
  go(event);
  updateRaceHud(world, run.race, raceStateAt(run.race, run.race.total));
  $('announce').textContent = `Race done. ${showBanner(run.race, result(run.race), run.names)}`;
}

// ---------- Wiring ----------
function build() {
  loadRan(); ladderButtons = buildLadder($('ladderSteps'), pickStep);
  for (const f of FIELDS) {
    $(f.key + 'Dec').addEventListener('click', () => nudge(f.key, -1));
    $(f.key + 'Inc').addEventListener('click', () => nudge(f.key, 1));
  }
  $('train').addEventListener('click', () => { sound.unlock(); showStage(); train({ ...rewards }); });
  $('reset').addEventListener('click', () => { rewards = defaultRewards(); $('train').dataset.stale = 'true'; showRates(); });
  $('skip').addEventListener('click', () => {
    if (raceRun) { raceRun.skipped = true; stage.skipTrip(); finishRace(raceRun, 'skip'); return; }
    if (!trip || !hud) return; hud.skipped = true; stage.skipTrip(); finish(trip, 'skip');
  });
  $('startRace').addEventListener('click', startRace);
  $('raceAgain').addEventListener('click', startRace);
  $('raceBack').addEventListener('click', () => {
    raceRun = null; stage.clearRoute(); showMeter(false);
    go('edit'); showGarage(true, 0);
  });
  $('viewToggle').addEventListener('click', () => {
    const on = $('viewToggle').getAttribute('aria-pressed') !== 'true';
    $('viewToggle').setAttribute('aria-pressed', String(on));
    stage.setMapView(on);
  });
  $('endEdit').addEventListener('click', () => { toMap('edit'); $('fareInc').focus({ preventScroll: true }); });
  $('endKeep').addEventListener('click', () => { if (trip) keepTrip(trip); });
  $('garage').addEventListener('click', () => { if ($('garageDrawer').hidden) openGarage(); else closeGarage(); });
  $('garageClose').addEventListener('click', closeGarage);
  $('garageDrawer').addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); closeGarage(); } });
  $('endAgain').addEventListener('click', () => {
    if (!trip) return;
    go('again'); sound.unlock(); drive(trip);
  });
  $('mute').addEventListener('click', () => {
    const muted = $('mute').getAttribute('aria-pressed') !== 'true';
    $('mute').setAttribute('aria-pressed', String(muted)); $('mute').textContent = muted ? 'Sound off' : 'Sound on';
    sound.setMuted(muted);
    try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* storage blocked: the choice lasts this visit */ }
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

const controls = () => [...FIELDS.flatMap(f => [$(f.key + 'Dec'), $(f.key + 'Inc')]), $('train'), $('reset'), ...ladderButtons.values()];
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

// Record mode: ?record=1&card=<id>&fps=<n>. The stage is frame-stepped through window.__rc.seek(ms).
async function startRecord(cfg) {
  const rc = window.__rc;
  if (!stage.ready) return;
  rewards = cardRewards(cfg.card); showRates();
  await train({ ...rewards });
  if (!trip) { rc.failure = 'training failed'; return; }
  rc.summary = runSummary({ card: cfg.card, rewards: trip.rewards, analysis: trip.analysis, scared: trip.people.scares.length, offences: trip.offences, goalSeconds: GOAL_SECONDS });
  if (cfg.cam === 'map') stage.setCuts([{ from: SWOOP_MS, to: SWOOP_MS + trip.track.total }]); // one overhead cut for the whole drive, after train()
  if (cfg.cam === 'auto') stage.setCuts(overheadCuts(trip.offences, { introMs: SWOOP_MS, driveMs: trip.track.total }));
  rc.totalMs = tripMs(trip.track.total);
}

async function start() {
  let recCfg = null;
  try { recCfg = parseRecord(location.search); } catch (e) { window.__rc = { ready: false, error: e.message, totalMs: 0, fps: 0, seek() {} }; }
  if (recCfg) { document.body.classList.add('rc-record'); rec = { now: 0, tags: [] }; }
  $('lamp').innerHTML = SUN + MOON;
  wireLamp($('lamp'), () => {});
  build();
  if (loadMuted()) { $('mute').setAttribute('aria-pressed', 'true'); $('mute').textContent = 'Sound off'; }
  go('none');
  enable(false);
  try {
    const city = await (await fetch(new URL('./chicago.json', import.meta.url))).json();
    cityData = city; walls = solidRings(city); world = loadWorld(city); cellM = city.cellM; // the one map load: the worker gets it by message
    // scene.js (and three.js) load only when WebGL exists; if that import fails, chooseStage shows the no-WebGL note.
    const webgl = !noWebglFlag(location.search) && webglAvailable();
    const scene = webgl ? await import('./scene.js').catch(() => null) : null;
    const make3d = scene ? (el, c) => scene.createScene(el, c, { phone: scene.isPhone(), labels: $('labels'), manualClock: !!recCfg, onChaseOff: () => { $('chase').setAttribute('aria-pressed', 'false'); if (!motionAllowed()) { $('chase').disabled = true; $('chase').title = 'Off because your device asks for reduced motion.'; } } }) : null;
    stage = chooseStage($('stage'), city, { webgl, make3d });
    if (recCfg) {
      const frameStage = { ready: stage.ready, renderAt(ms) { rec.now = ms; stage.renderAt(ms); const keep = pruneTags(rec.tags, ms); rec.tags.filter(t => !keep.includes(t)).forEach(t => t.span.remove()); rec.tags = keep; } };
      window.__rc = recordApi({ stage: frameStage, fps: recCfg.fps });
    }
  } catch {
    if (recCfg) window.__rc = { ready: false, error: 'map did not load', totalMs: 0, fps: recCfg.fps, seek() {} };
    say('The map did not load. Reload the page to try again.');
    return;
  }
  loadGarage();
  enable(true);
  setupChase();
  go('none'); // the map screen: the rate card and TRAIN & DRIVE
  showGarage(false);
  if (recCfg) await startRecord(recCfg);
}
start();
