import { TRACKS } from '../../assets/tracks/index.js';
import { lessonById, lessonLabel, lessonHref } from '../../assets/tracks/model.js';

// The six Treasure Room levels: one idea each, keyed by the id of its lesson; `assumes` lists the lesson ids a level builds on. Level names live in the track config, not here.
export const LEVELS = [
  { id: 'loop',
    brief: "Drive the robot to the treasure. Then cut the room's answer and watch the robot get lost, and turn it back on to watch each turn.",
    lesson: 'The AI only knows what the room tells it.',
    info: 'The robot sends an action to the room, and the room sends back a position and a reward.' },
  { id: 'state', assumes: ['loop'],
    brief: 'Every move is written down as a state, an action and a reward. Play and watch the list grow.',
    lesson: 'The game is a list of these: state, action, reward.',
    info: 'Each line of the log is one state, the action taken there and the reward that came back.' },
  { id: 'return', assumes: ['state'],
    brief: 'Coin or chest? Add up each route, then turn the discount and watch the robot change its mind.',
    lesson: 'A low discount makes the robot near-sighted: it grabs what is close.',
    info: 'The return is the sum of rewards on a route, with each later step counted for less by the discount.' },
  { id: 'policy', assumes: ['return'],
    brief: 'Put an arrow on every tile, then press Go. Let the AI fix the arrows that lead it wrong.',
    lesson: 'A policy is: on this tile, do this.',
    info: 'A policy is one arrow per tile: whatever tile the robot is on, it does what that arrow says.' },
  { id: 'value', assumes: ['policy'],
    brief: 'Sweep to spread worth outward from the treasure, then walk uphill to it.',
    lesson: 'Value is how good it is to stand here.',
    info: 'The number on a tile is the return the robot can expect if it starts there and plays well.' },
  { id: 'mdp', assumes: ['value'],
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

export const levelById = id => LEVELS.find(l => l.id === id);

// ?level= (a lesson id) beats #hash; anything that is not a built level is the first built one.
export function levelFromUrl(search = '', hash = '', built) {
  const q = new URLSearchParams(search).get('level'), h = hash.replace(/^#/, '');
  return built.find(id => id === q) ?? built.find(id => id === h) ?? built[0];
}

// The level nav: only levels that are built, numbered in order, with the current one marked (an unbuilt current falls back to the first built).
export function navModel(built, current, titleOf) {
  const now = built.includes(current) ? current : built[0];
  return built.map((id, i) => ({ id, n: i + 1, href: `?level=${id}`, title: titleOf(id), current: id === now }));
}
