import { TRACKS } from '../../assets/tracks/index.js';
import { lessonById, lessonLabel, lessonHref } from '../../assets/tracks/model.js';

// The six Treasure Room levels: one idea each, each tied to one concept page; `assumes` lists the lesson ids a level builds on. Level names live in the track config, not here.
export const LEVELS = [
  { n: 1, slug: 'agent', concept: 'agent',
    brief: 'Drive the robot to the treasure, then hand over to the AI. All it ever gets back from the room is where it is and a reward.',
    lesson: 'The AI only knows what the room tells it.',
    info: 'The robot sends an action to the room, and the room sends back a position and a reward.' },
  { n: 2, slug: 'triples', concept: 'state-action-reward', assumes: ['agent'],
    brief: 'Every move is written down as a state, an action and a reward. Play and watch the list grow.',
    lesson: 'The game is a list of these: state, action, reward.',
    info: 'Each line of the log is one state, the action taken there and the reward that came back.' },
  { n: 3, slug: 'return', concept: 'return', assumes: ['state-action-reward'],
    brief: 'Coin or chest? Add up each route, then turn the discount and watch the robot change its mind.',
    lesson: 'A low discount makes the robot near-sighted: it grabs what is close.',
    info: 'The return is the sum of rewards on a route, with each later step counted for less by the discount.' },
  { n: 4, slug: 'policy', concept: 'policy', assumes: ['return'],
    brief: 'Put an arrow on every tile, then press Go. Let the AI fix the arrows that lead it wrong.',
    lesson: 'A policy is: on this tile, do this.',
    info: 'A policy is one arrow per tile: whatever tile the robot is on, it does what that arrow says.' },
  { n: 5, slug: 'value', concept: 'value', assumes: ['policy'],
    brief: 'Sweep to spread worth outward from the treasure, then walk uphill to it.',
    lesson: 'Value is how good it is to stand here.',
    info: 'The number on a tile is the return the robot can expect if it starts there and plays well.' },
  { n: 6, slug: 'mdp', concept: 'mdp', assumes: ['value'],
    brief: 'Make the floor icy so moves sometimes slip, and watch the best plan change.',
    lesson: 'The best plan changes once moves are uncertain.',
    info: 'On ice a move works 80% of the time and slips to each side 10% of the time.' },
];

// The "Builds on" line under a level's brief: links to the live lessons it assumes. Pages sit two folders deep, so base is ../../.
export function assumesHtml(level, tracks = TRACKS, base = '../../') {
  const links = (level.assumes ?? []).map(id => lessonById(id, tracks)).filter(l => l?.status === 'live')
    .map(l => `<a href="${lessonHref(l, base)}">${lessonLabel(l)}</a>`);
  return links.length ? `<p class="assumes">Builds on ${links.join(', ')}</p>` : '';
}

export const levelByN = n => LEVELS[n - 1];

function parse(raw) {
  if (!raw) return null;
  if (/^\d+$/.test(raw)) {
    const n = Number(raw);
    return n >= 1 && n <= LEVELS.length ? n : null;
  }
  const l = LEVELS.find(x => x.slug === raw || x.concept === raw);
  return l ? l.n : null;
}

// ?level= (number, slug or concept id) beats #hash; anything invalid is level 1.
export function levelFromUrl(search = '', hash = '') {
  const q = new URLSearchParams(search).get('level');
  return parse(q) ?? parse(hash.replace(/^#/, '')) ?? 1;
}

// The level nav: only levels that are built, with the current one marked (an unbuilt current falls back to the first built).
export function navModel(built, current, titleOf) {
  const now = built.includes(current) ? current : built[0];
  return built.map(n => ({ n, href: `?level=${n}`, title: titleOf(n), current: n === now }));
}
