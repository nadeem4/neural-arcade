// The one list of games. Pages render from this; adding a game means adding one entry here.
// Which lessons a game appears in lives in the track configs (assets/tracks/), not here.
import { tracksOfGame } from './tracks/model.js';

export const GAMES = [
  {
    id: 'racer', title: 'Neural Racer',
    lesson: 'Ten cars with random brains learn to lap a track by breeding. Teaches fitness, selection, mutation and overfitting.',
    learnsBy: 'Fitness, selection, mutation',
    goesWrongWhen: 'It overfits the one track it bred on',
    added: '2026-10-16', shot: 'games/racer/shot.jpg', path: 'games/racer/', writeup: 'games/racer/how-it-works/', youtube: 'tG00TxTB8ns', demo: null,
  },
  {
    id: 'teach', title: 'Teach by Driving',
    lesson: 'You drive one lap and a tiny network learns to steer like you. Teaches training data, loss, gradient descent, learning rate and distribution shift.',
    learnsBy: 'Training data, loss, gradient descent',
    goesWrongWhen: 'The road leaves what it was shown',
    added: '2026-10-16', shot: 'games/teach/shot.jpg', path: 'games/teach/', writeup: 'games/teach/how-it-works/', youtube: 'qfzRiq3DoJo', demo: null,
  },
  {
    id: 'runner', title: 'Coin Runner',
    lesson: 'A hero learns a platformer level from points alone, and finds loopholes when the points are wrong. Teaches reward, exploration, policy gradients and reward hacking.',
    learnsBy: 'Reward, policy gradients',
    goesWrongWhen: 'It learns what you reward, not what you meant',
    added: '2026-10-24', shot: 'games/runner/shot.jpg', path: 'games/runner/', writeup: 'games/runner/how-it-works/', youtube: 'K1I7QxfrgIk',
    demo: { net: '12 inputs, 8 hidden, 4 moves', learns: 'Learning from points only', panel: 'Its four moves, right now', alt: 'A trained hero playing the Coin Runner level on a loop' },
  },
  {
    id: 'balance', title: 'Balance',
    lesson: 'A cart must keep a pole upright. You, a PID controller with three dials, a PID whose dials evolution tunes and a tiny evolving network all try, and you can shove it with Push and Wind. Teaches feedback control, PID, evolution and disturbances.',
    learnsBy: 'Feedback, PID, evolution',
    goesWrongWhen: 'A steady push it never practised',
    added: '2026-11-11', shot: 'games/balance/shot.jpg', path: 'games/balance/', writeup: 'games/balance/how-it-works/', youtube: 'ui3l3xSUZ4U',
    demo: { net: '4 inputs, 6 hidden, 1 push', learns: 'Learning by evolution', panel: 'Its push, right now', alt: 'A trained brain keeping a pole upright on a cart' },
  },
  {
    id: 'maze', title: 'Treasure Maze',
    lesson: 'An explorer learns a small grid by trial and error, and you set how much far-off reward counts. Teaches reward, value, the discount and exploring.',
    learnsBy: 'Reward, value, discount',
    goesWrongWhen: 'Exploring near a cliff costs it',
    added: '2026-11-13', shot: 'games/maze/shot.jpg', path: 'games/maze/', writeup: 'games/maze/how-it-works/', youtube: '74Q8P1r7xeo', demo: null,
  },
  {
    id: 'city', title: 'Reward City',
    lesson: 'An AI taxi learns to cross downtown Chicago from the reward you write, and finds every loophole in it. Teaches reward design, and why an agent does what you pay it for, not what you meant.',
    learnsBy: 'Reward design, reward hacking',
    goesWrongWhen: 'The reward has a loophole',
    added: '2026-11-16', shot: 'games/city/shot.jpg', path: 'games/city/', writeup: 'games/city/how-it-works/', youtube: null, demo: null,
  },
  {
    id: 'treasure-room', title: 'Treasure Room',
    lesson: 'One small room, six ideas: an agent, state-action-reward, return, policy, value and the MDP. Teaches that the AI only ever knows what the room tells it.',
    learnsBy: 'Agent, reward, return, policy, value',
    goesWrongWhen: 'The floor turns icy and the best plan changes',
    added: '2026-11-18', shot: 'games/treasure-room/shot.jpg', path: 'games/treasure-room/', writeup: 'games/treasure-room/how-it-works/', youtube: null, demo: null,
  },
];

export const gameById = id => GAMES.find(g => g.id === id);

export function videoOf(game) {
  return game.youtube ? { id: game.youtube, thumb: `https://i.ytimg.com/vi/${game.youtube}/hqdefault.jpg` } : null;
}

const byNewest = (a, b) => b.added.localeCompare(a.added) || a.title.localeCompare(b.title);
const byTitle = (a, b) => a.title.localeCompare(b.title);

export const newest = games => [...games].sort(byNewest)[0];
// the home hero: the newest game with an explainer video and a demo (its `demo` words and games/<id>/demo.js), else the newest game with a demo, else the newest game (then the home shows no recorded run).
export const heroOf = games => newest(games.filter(g => g.youtube && g.demo)) ?? newest(games.filter(g => g.demo)) ?? newest(games);

// The games page list: filter by track (a game is in every track that names it), search title, lesson and track titles, sort, page.
export function browse(games, tracks, { q = '', track = '', sort = 'newest', page = 1, pageSize = 24 } = {}) {
  const needle = q.trim().toLowerCase();
  const trackIds = g => tracksOfGame(g.id, tracks).map(t => t.id);
  const titles = g => tracksOfGame(g.id, tracks).map(t => t.title);
  const hits = games
    .filter(g => !track || trackIds(g).includes(track))
    .filter(g => !needle || [g.title, g.lesson, ...titles(g)].some(s => s.toLowerCase().includes(needle)))
    .sort(sort === 'az' ? byTitle : byNewest);
  const pages = Math.max(1, Math.ceil(hits.length / pageSize));
  const p = Math.min(Math.max(1, page), pages);
  return { items: hits.slice((p - 1) * pageSize, p * pageSize), total: hits.length, pages, page: p };
}
