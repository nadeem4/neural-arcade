// The one list of games and categories. Pages render from this; adding a game means adding one entry here.
export const CATEGORIES = [
  { id: 'how-ai-learns', title: 'How AI learns', lead: 'The ways a brain gets better: by evolution, by copying examples, and by trial and error.' },
  { id: 'physical-ai', title: 'Physical AI', lead: 'How robots learn to move, sense and act in the physical world.' },
  { id: 'reinforcement-learning', title: 'Reinforcement learning', lead: 'An agent tries things, gets a number back for each try, and learns what to do. The words, then the methods.' },
];

export const GAMES = [
  {
    id: 'racer', title: 'Neural Racer', category: 'how-ai-learns',
    lesson: 'Ten cars with random brains learn to lap a track by breeding. Teaches fitness, selection, mutation and overfitting.',
    learnsBy: 'Fitness, selection, mutation',
    goesWrongWhen: 'It overfits the one track it bred on',
    added: '2026-10-16', shot: 'games/racer/shot.jpg', path: 'games/racer/', writeup: 'games/racer/how-it-works/', youtube: 'tG00TxTB8ns', demo: null,
  },
  {
    id: 'teach', title: 'Teach by Driving', category: 'how-ai-learns',
    lesson: 'You drive one lap and a tiny network learns to steer like you. Teaches training data, loss, gradient descent, learning rate and distribution shift.',
    learnsBy: 'Training data, loss, gradient descent',
    goesWrongWhen: 'The road leaves what it was shown',
    added: '2026-10-16', shot: 'games/teach/shot.jpg', path: 'games/teach/', writeup: 'games/teach/how-it-works/', youtube: 'qfzRiq3DoJo', demo: null,
  },
  {
    id: 'runner', title: 'Coin Runner', category: 'how-ai-learns',
    lesson: 'A hero learns a platformer level from points alone, and finds loopholes when the points are wrong. Teaches reward, exploration, policy gradients and reward hacking.',
    learnsBy: 'Reward, policy gradients',
    goesWrongWhen: 'It learns what you reward, not what you meant',
    added: '2026-10-24', shot: 'games/runner/shot.jpg', path: 'games/runner/', writeup: 'games/runner/how-it-works/', youtube: 'K1I7QxfrgIk',
    demo: { net: '12 inputs, 8 hidden, 4 moves', learns: 'Learning from points only', panel: 'Its four moves, right now', alt: 'A trained hero playing the Coin Runner level on a loop' },
  },
  {
    id: 'balance', title: 'Balance', category: 'physical-ai',
    lesson: 'A cart must keep a pole upright. You, a PID controller with three dials, a PID whose dials evolution tunes and a tiny evolving network all try, and you can shove it with Push and Wind. Teaches feedback control, PID, evolution and disturbances.',
    learnsBy: 'Feedback, PID, evolution',
    goesWrongWhen: 'A steady push it never practised',
    added: '2026-11-11', shot: 'games/balance/shot.jpg', path: 'games/balance/', writeup: 'games/balance/how-it-works/', youtube: 'ui3l3xSUZ4U',
    demo: { net: '4 inputs, 6 hidden, 1 push', learns: 'Learning by evolution', panel: 'Its push, right now', alt: 'A trained brain keeping a pole upright on a cart' },
  },
  {
    id: 'maze', title: 'Treasure Maze', category: 'reinforcement-learning',
    lesson: 'A robot learns a small grid by trial and error, and you set how much far-off reward counts. Teaches reward, value, the discount and exploring.',
    learnsBy: 'Reward, value, discount',
    goesWrongWhen: 'Exploring near a cliff costs it',
    added: '2026-11-13', shot: 'games/maze/shot.jpg', path: 'games/maze/', writeup: 'games/maze/how-it-works/', youtube: null, demo: null,
  },
];

export const gameById = id => GAMES.find(g => g.id === id);

export function videoOf(game) {
  return game.youtube ? { id: game.youtube, thumb: `https://i.ytimg.com/vi/${game.youtube}/hqdefault.jpg` } : null;
}

const byNewest = (a, b) => b.added.localeCompare(a.added) || a.title.localeCompare(b.title);
const byTitle = (a, b) => a.title.localeCompare(b.title);

// a game page's "More from <category>": the other games in its category, newest first.
export const moreFrom = (game, games, max = 3) =>
  games.filter(g => g.category === game.category && g.id !== game.id).sort(byNewest).slice(0, max);
export const newest = games => [...games].sort(byNewest)[0];
// the home hero: the newest game with an explainer video and a demo (its `demo` words and games/<id>/demo.js), else the newest game with a demo, else the newest game (then the home shows no recorded run).
const heroOf = games => newest(games.filter(g => g.youtube && g.demo)) ?? newest(games.filter(g => g.demo)) ?? newest(games);

export const categoriesWithGames = (categories, games) => categories.filter(c => games.some(g => g.category === c.id));

export const groupCategories = (categories, games, max = 4) =>
  categoriesWithGames(categories, games).map(category => ({
    category,
    games: games.filter(g => g.category === category.id).sort(byNewest).slice(0, max),
  }));

// What the home page shows: the newest game with a video as the hero, then each category's newest as its big tile and the rest beside it.
export function homeModel(categories, games) {
  const hero = heroOf(games);
  const groups = categoriesWithGames(categories, games).map(category => {
    const [big, ...rest] = games.filter(g => g.category === category.id).sort(byNewest);
    return { category, big, rest, bigIsNew: big === hero };
  });
  return { hero, categories: groups, chips: groups.map(g => g.category) };
}

// What a category page shows: its games newest first, the one to start with (the oldest), and the other categories that have games.
export function categoryModel(categories, games, categoryId) {
  const category = categories.find(c => c.id === categoryId);
  if (!category) return null;
  const mine = games.filter(g => g.category === categoryId);
  return {
    category,
    games: [...mine].sort(byNewest),
    first: [...mine].sort((a, b) => a.added.localeCompare(b.added) || a.title.localeCompare(b.title))[0],
    others: categoriesWithGames(categories, games).filter(c => c.id !== categoryId),
  };
}

export function browse(games, categories, { q = '', category = '', sort = 'newest', page = 1, pageSize = 24 } = {}) {
  const needle = q.trim().toLowerCase();
  const titleOf = id => categories.find(c => c.id === id)?.title ?? '';
  const hits = games
    .filter(g => !category || g.category === category)
    .filter(g => !needle || [g.title, g.lesson, titleOf(g.category)].some(s => s.toLowerCase().includes(needle)))
    .sort(sort === 'az' ? byTitle : byNewest);
  const pages = Math.max(1, Math.ceil(hits.length / pageSize));
  const p = Math.min(Math.max(1, page), pages);
  return { items: hits.slice((p - 1) * pageSize, p * pageSize), total: hits.length, pages, page: p };
}
