// The one list of games and categories. Pages render from this; adding a game means adding one entry here.
export const CATEGORIES = [
  { id: 'how-ai-learns', title: 'How AI learns', lead: 'The ways a brain gets better: by evolution, by copying examples, and by trial and error.' },
];

export const GAMES = [
  {
    id: 'racer', title: 'Neural Racer', category: 'how-ai-learns',
    lesson: 'Ten cars with random brains learn to lap a track by breeding. Teaches fitness, selection, mutation and overfitting.',
    learnsBy: 'Fitness, selection, mutation',
    goesWrongWhen: 'It overfits the one track it bred on',
    added: '2026-10-16', shot: 'games/racer/shot.jpg', path: 'games/racer/', writeup: 'games/racer/how-it-works/', youtube: null,
  },
  {
    id: 'teach', title: 'Teach by Driving', category: 'how-ai-learns',
    lesson: 'You drive one lap and a tiny network learns to steer like you. Teaches training data, loss, gradient descent, learning rate and distribution shift.',
    learnsBy: 'Training data, loss, gradient descent',
    goesWrongWhen: 'The road leaves what it was shown',
    added: '2026-10-16', shot: 'games/teach/shot.jpg', path: 'games/teach/', writeup: 'games/teach/how-it-works/', youtube: null,
  },
  {
    id: 'runner', title: 'Coin Runner', category: 'how-ai-learns',
    lesson: 'A hero learns a platformer level from points alone, and finds loopholes when the points are wrong. Teaches reward, exploration, policy gradients and reward hacking.',
    learnsBy: 'Reward, policy gradients',
    goesWrongWhen: 'It learns what you reward, not what you meant',
    added: '2026-10-24', shot: 'games/runner/shot.jpg', path: 'games/runner/', writeup: 'games/runner/how-it-works/', youtube: 'K1I7QxfrgIk',
  },
];

export const gameById = id => GAMES.find(g => g.id === id);

export function videoOf(game) {
  return game.youtube ? { id: game.youtube, thumb: `https://i.ytimg.com/vi/${game.youtube}/hqdefault.jpg` } : null;
}

const byNewest = (a, b) => b.added.localeCompare(a.added) || a.title.localeCompare(b.title);
const byTitle = (a, b) => a.title.localeCompare(b.title);

export const newest = games => [...games].sort(byNewest)[0];

export const categoriesWithGames = (categories, games) => categories.filter(c => games.some(g => g.category === c.id));

export const groupCategories = (categories, games, max = 4) =>
  categoriesWithGames(categories, games).map(category => ({
    category,
    games: games.filter(g => g.category === category.id).sort(byNewest).slice(0, max),
  }));

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
