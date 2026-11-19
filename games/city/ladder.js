// The ladder: the five preset cards as five steps, ordered so each result motivates the next. Pure, no DOM.
// Cards and their numbers come from presets.js; the words here only say what to watch and what it showed.
import { PRESETS, checkPromise } from './presets.js';
import { RATE_KEYS } from './reward.js';
import { cheatsOf } from './receipt.js';

const card = id => PRESETS.find(p => p.id === id).rewards;

export const LADDER_KEY = 'rc-ladder-v1';

// Order: speed (the taxi only knows the pay), walk (a gap gets used), lights (the cheat moves), mile (a stand-in backfires), legal (the fix).
// Each step is named by its card; its moral is the last sentence of its `showed` note.
const WORDS = [
  { id: 'speed',
    watch: 'Only the clock costs money. Nothing says to stay on the road.',
    showed: 'Its quickest route ran along the footpaths, through red lights and the wrong way down one-way streets. Nothing on the card cost anything but time. The taxi only knows the pay.' },
  { id: 'walk',
    watch: `Each footpath tile costs ${card('walk').off} now. Look for what is still free.`,
    showed: 'It left the footpaths and ran red lights instead, because nothing fined them. Any gap gets exploited.' },
  { id: 'lights',
    watch: `Each red light costs ${card('lights').red} now. Look for what is still free.`,
    showed: 'It stopped at the lights, then went the wrong way down a one-way street to save time. Patch one hole and the cheat moves.' },
  { id: 'mile',
    watch: `Every fine is on now, wrong way ${card('mile').wrong} too, and each tile driven pays ${card('mile').perTile}. Does more driving mean a faster trip?`,
    showed: 'It drove in circles for the tile pay and never dropped the passenger off. Tiles were a poor stand-in for arriving.' },
  { id: 'legal',
    watch: 'Tile pay is off again; the fare pays for arriving and every cheat has a fine. Judge the drive, not the pay.',
    showed: 'It drove a legal trip. The fix is to pay for the outcome and put a price on its side effects. Judge a taxi by its drive and the city score, not by its pay.' },
];

export const STEPS = WORDS.map((w, i) => {
  const p = PRESETS.find(x => x.id === w.id);
  return { ...w, n: i + 1, title: p.name, card: p.name, rewards: p.rewards }; // one name per step: the card name
});

const stepOf = id => STEPS.find(s => s.id === id);

// A fresh copy of a step's rate card, ready for the steppers.
export const cardFor = id => ({ ...stepOf(id).rewards });

// The step whose card these rewards are, or null for the player's own card.
export const matchStep = rewards => STEPS.find(s => RATE_KEYS.every(k => rewards[k] === s.rewards[k]))?.id ?? null;

// The stored list of run steps: known ids only, each once. Anything unreadable gives [].
export function parseRan(text) {
  try {
    const list = JSON.parse(text);
    return Array.isArray(list) ? [...new Set(list.filter(id => typeof id === 'string' && stepOf(id)))] : [];
  } catch { return []; }
}

// The list with one more step run (unchanged for an unknown id or a repeat).
export const markRan = (ran, id) => (stepOf(id) && !ran.includes(id) ? [...ran, id] : ran);

const CHEAT_WORDS = { never: 'never arrived', circling: 'drove extra tiles for the pay', park: 'cut through the park',
  footpath: 'drove on the footpaths', red: 'ran red lights', wrong: 'went the wrong way down a one-way street' };

// What a run really did, from its analysis: "This run: never arrived, cut through the park."
export function ranLine(rewards, analysis, honest) {
  const kinds = cheatsOf(rewards, analysis, honest).map(c => CHEAT_WORDS[c.kind]).filter(Boolean);
  return `This run: ${kinds.length ? kinds.join(', ') : 'a legal trip, no fines'}.`;
}

// What the ladder shows for these rewards: five steps, which is loaded, which are ticked, and the note below them.
// runs maps a step id to its last run this page session: { analysis, honest } (honest is the honest route's analysis, or null).
export function ladderModel(rewards, ran, runs = {}) {
  const current = matchStep(rewards);
  const steps = STEPS.map(s => {
    const ticked = ran.includes(s.id);
    return { id: s.id, n: s.n, title: s.title, ticked, current: s.id === current,
      label: `Step ${s.n}: ${s.card}.${ticked ? ' Done.' : ''}` };
  });
  if (!current) return { current, steps, note: { kind: 'own', head: 'Your own card', text: 'You changed the card. Tap a step to load one of the five.' } };
  const s = stepOf(current), head = `${s.n}. ${s.title}`;
  if (!ran.includes(current)) return { current, steps, note: { kind: 'watch', head, text: s.watch } };
  const run = runs[current];
  if (run && !checkPromise(current, run.analysis, run.honest?.tiles ?? 0)) return { current, steps, note: { kind: 'ran', head, text: ranLine(s.rewards, run.analysis, run.honest) } };
  if (current === 'legal' && STEPS.every(x => ran.includes(x.id))) {
    return { current, steps, note: { kind: 'done', head, text: s.showed + ' All five steps done. Now write your own card, or race your taxis in the Garage.' } };
  }
  return { current, steps, note: { kind: 'showed', head, text: s.showed } };
}
