// The ladder: the five preset cards as five steps, ordered so each result motivates the next. Pure, no DOM.
// Cards and their numbers come from presets.js; the words here only say what to watch and what it showed.
import { PRESETS } from './presets.js';
import { RATE_KEYS } from './reward.js';

export const LADDER_KEY = 'rc-ladder-v1';

// Order: speed shows the taxi only knows the pay, walk shows a gap getting used, lights shows the cheat moving,
// mile shows a stand-in backfiring, legal is the fix.
const WORDS = [
  { id: 'speed', title: 'The taxi knows only the pay',
    watch: 'Only the clock costs money. Nothing says to stay on the road.',
    showed: 'It drove straight across the park. Nothing on the card made that cost anything.' },
  { id: 'walk', title: 'Any gap gets exploited',
    watch: 'The park and footpaths cost money now. Look for what is still free.',
    showed: 'It left the park and ran red lights instead, because nothing fined them.' },
  { id: 'lights', title: 'Patch one hole and the cheat moves',
    watch: 'Red lights cost money now. Look for what is still free.',
    showed: 'It stopped at the lights, then went the wrong way down a one-way street to save time.' },
  { id: 'mile', title: 'Paying for a stand-in backfires',
    watch: 'Every tile driven now pays. Does more driving mean a faster trip?',
    showed: 'It drove in circles for the tile pay and never dropped the passenger off. Tiles were a poor stand-in for arriving.' },
  { id: 'legal', title: 'The fix: pay for the outcome, price the side effects',
    watch: 'The fare pays for arriving and every cheat has a fine. Then judge the drive, not the pay.',
    showed: 'It drove a legal trip. Judge a taxi by its drive and the city score, not by its pay.' },
];

export const STEPS = WORDS.map((w, i) => {
  const p = PRESETS.find(x => x.id === w.id);
  return { ...w, n: i + 1, card: p.name, rewards: p.rewards };
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

// What the ladder shows for these rewards: five steps, which is loaded, which are ticked, and the note below them.
export function ladderModel(rewards, ran) {
  const current = matchStep(rewards);
  const steps = STEPS.map(s => {
    const ticked = ran.includes(s.id);
    return { id: s.id, n: s.n, title: s.title, ticked, current: s.id === current,
      label: `Step ${s.n}: ${s.title}. Card: ${s.card}.${ticked ? ' Done.' : ''}` };
  });
  if (!current) return { current, steps, note: { kind: 'own', head: 'Your own card', text: 'You changed the card. Tap a step to load one of the five.' } };
  const s = stepOf(current), done = ran.includes(current);
  return { current, steps, note: { kind: done ? 'showed' : 'watch', head: `${s.n}. ${s.title}`, text: done ? s.showed : s.watch } };
}
