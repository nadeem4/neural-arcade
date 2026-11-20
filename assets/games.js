// The one list of games and categories. Pages render from this; adding a game means adding one entry here.
// Optional game fields: `uses` (concept ids the game teaches), `where` (concept id -> one line on where the game shows it) and
// `levels` (concept id -> the level number of that game that teaches it).
import { tracksOfGame } from './tracks/model.js';

export const CATEGORIES = [
  { id: 'how-ai-learns', title: 'How AI learns', lead: 'Two ways a brain gets better: by evolution, and by copying examples.' },
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
    id: 'runner', title: 'Coin Runner', category: 'reinforcement-learning',
    lesson: 'A hero learns a platformer level from points alone, and finds loopholes when the points are wrong. Teaches reward, exploration, policy gradients and reward hacking.',
    learnsBy: 'Reward, policy gradients',
    goesWrongWhen: 'It learns what you reward, not what you meant',
    uses: ['agent', 'state-action-reward', 'policy', 'reward-design'],
    where: {
      agent: 'The hero is the agent and the platformer level is its environment.',
      'state-action-reward': 'The hero sees the level around it, picks one of four moves, and is paid points for coins and the flag.',
      policy: 'Its brain is the policy: it turns what the hero sees into a choice among the four moves, and the points reshape it.',
      'reward-design': 'Pay more for coins than for the flag and the hero farms the coin block above the start for about 50 coins and never finishes: the best plan its points allow.',
    },
    added: '2026-10-24', shot: 'games/runner/shot.jpg', path: 'games/runner/', writeup: 'games/runner/how-it-works/', youtube: 'K1I7QxfrgIk',
    demo: { net: '12 inputs, 8 hidden, 4 moves', learns: 'Learning from points only', panel: 'Its four moves, right now', alt: 'A trained hero playing the Coin Runner level on a loop' },
  },
  {
    id: 'balance', title: 'Balance', category: 'physical-ai',
    lesson: 'A cart must keep a pole upright. You, a PID controller with three dials, a PID whose dials evolution tunes and a tiny evolving network all try, and you can shove it with Push and Wind. Teaches feedback control, PID, evolution and disturbances.',
    learnsBy: 'Feedback, PID, evolution',
    goesWrongWhen: 'A steady push it never practised',
    uses: ['pid'],
    where: { pid: 'Its "A PID with three dials" mode: tune P, I and D yourself, then let evolution tune them.' },
    added: '2026-11-11', shot: 'games/balance/shot.jpg', path: 'games/balance/', writeup: 'games/balance/how-it-works/', youtube: 'ui3l3xSUZ4U',
    demo: { net: '4 inputs, 6 hidden, 1 push', learns: 'Learning by evolution', panel: 'Its push, right now', alt: 'A trained brain keeping a pole upright on a cart' },
  },
  {
    id: 'maze', title: 'Treasure Maze', category: 'reinforcement-learning',
    lesson: 'An explorer learns a small grid by trial and error, and you set how much far-off reward counts. Teaches reward, value, the discount and exploring.',
    learnsBy: 'Reward, value, discount',
    goesWrongWhen: 'Exploring near a cliff costs it',
    uses: ['agent', 'state-action-reward', 'return', 'policy', 'value'],
    where: {
      agent: 'The explorer is the agent and the grid, with its treasure and pit, is the environment.',
      'state-action-reward': 'Each tile is a state, each step is an action, and treasure and the pit hand back the reward.',
      return: 'The Discount slider sets how much far-off reward counts, which decides whether it walks to the small or the big treasure.',
      policy: 'The arrows on the grid are its policy: the best move it has found for each tile.',
      value: 'The lightness of each tile is its value, spreading back from the treasure as it learns.',
    },
    added: '2026-11-13', shot: 'games/maze/shot.jpg', path: 'games/maze/', writeup: 'games/maze/how-it-works/', youtube: '74Q8P1r7xeo', demo: null,
  },
  {
    id: 'city', title: 'Reward City', category: 'reinforcement-learning',
    lesson: 'An AI taxi learns to cross downtown Chicago from the reward you write, and finds every loophole in it. Teaches reward design, and why an agent does what you pay it for, not what you meant.',
    learnsBy: 'Reward design, reward hacking',
    goesWrongWhen: 'The reward has a loophole',
    uses: ['agent', 'state-action-reward', 'return', 'policy', 'value', 'reward-design'],
    where: {
      agent: 'The taxi is the agent and the Chicago Loop, with its streets, lights and footpaths, is the environment. Cars and people react to the taxi, but they are not part of what it learns from.',
      'state-action-reward': 'Each map tile and light colour is a state, each move or wait is an action, and your rate card hands back the reward.',
      return: 'The fare comes only at the drop-off, so the taxi weighs the whole trip, clock and fines included, not just the next block.',
      policy: 'The route it drives is its policy: the move it has found best for each tile and light, which changes whenever you rewrite the rate card.',
      value: 'Behind each choice is a value: how much pay the taxi expects from a tile and light onward, learned from the trips it has tried.',
      'reward-design': 'The rate card is the reward design: every fine you add closes one loophole and the taxi finds the next.',
    },
    added: '2026-11-16', shot: 'games/city/shot.jpg', path: 'games/city/', writeup: 'games/city/how-it-works/', youtube: null, demo: null,
  },
  {
    id: 'treasure-room', title: 'Treasure Room', category: 'reinforcement-learning',
    lesson: 'One small room, six ideas: an agent, state-action-reward, return, policy, value and the MDP. Teaches that the AI only ever knows what the room tells it.',
    learnsBy: 'Agent, reward, return, policy, value',
    goesWrongWhen: 'The floor turns icy and the best plan changes',
    uses: ['agent', 'state-action-reward', 'return', 'policy', 'value', 'mdp'],
    where: {
      agent: 'The robot is the agent and the room is the environment: all it gets back is where it is and a reward.',
      'state-action-reward': 'Every move is logged as a state, an action and a reward, and the game is a list of these.',
      return: 'Add up the rewards on a route, and lower the discount to watch far-away treasure lose its pull.',
      policy: 'Put an arrow on every tile: that set of arrows is the policy.',
      value: 'Sweep the room and each tile gets a number for how good it is to stand there.',
      mdp: 'Turn the floor icy so moves slip, and the best plan changes.',
    },
    levels: { agent: 1, 'state-action-reward': 2, return: 3, policy: 4, value: 5, mdp: 6 },
    added: '2026-11-18', shot: 'games/treasure-room/shot.jpg', path: 'games/treasure-room/', writeup: 'games/treasure-room/how-it-works/', youtube: null, demo: null,
  },
];

export const gameById = id => GAMES.find(g => g.id === id);

// The words the games share. A game lists the ones it uses in `uses`, with one sentence per word in `where` saying where it shows up in that game. A concept has `related` (ids of neighbouring concepts), may get a `youtube` id for a short explainer and its own page at concepts/<id>/.
export const CONCEPTS = [
  { id: 'agent', title: 'Agent and environment', youtube: null, related: ['state-action-reward', 'policy'], definition: 'The agent is the learner that acts; the environment is everything it acts on, and it answers each move with a new situation and a reward.' },
  { id: 'state-action-reward', title: 'State, action, reward', youtube: null, related: ['agent', 'return'], definition: 'A state is where things stand now, an action is a move the agent can make, and a reward is the number the world hands back for that move.' },
  { id: 'return', title: 'Return and discount', youtube: null, related: ['state-action-reward', 'value'], definition: 'The return is all the reward still to come, with far-off reward counted for less by the discount.' },
  { id: 'policy', title: 'Policy', youtube: null, related: ['agent', 'value', 'pid'], definition: "A policy is the agent's rulebook: in each state, which action to take." },
  { id: 'value', title: 'Value', youtube: null, related: ['return', 'policy', 'mdp'], definition: "A state's value is how much reward the agent can expect from there on, if it keeps following its policy." },
  { id: 'mdp', title: 'Markov decision process', youtube: null, related: ['value', 'state-action-reward'], definition: 'An MDP is the whole game written down: states, actions, rewards and where each move leads, where only the present state matters, not how you got there.' },
  { id: 'pid', title: 'PID control', youtube: 'drtqgVse4jo', related: ['policy'], definition: 'A PID controller steers by mixing three looks at the error: how big it is now, how long it has lasted, and how fast it is changing.' },
  { id: 'reward-design', title: 'Reward design', youtube: null, related: ['state-action-reward', 'return', 'policy'], definition: 'Reward design is choosing the numbers an agent is paid and fined; it does exactly what they pay for, so every loophole in them becomes a behaviour.' },
];

export const conceptById = id => CONCEPTS.find(c => c.id === id);

// Where a concept chip links: its own page.
export const conceptHref = (c, base) => `${base}concepts/${c.id}/`;

// A game page's "Words this game uses": one chip per concept in game.uses, each linking to conceptHref. Empty when there are none.
export const usesHtml = (game, base) =>
  (game.uses ?? []).map(conceptById).filter(Boolean)
    .map(c => `<a class="chip" href="${conceptHref(c, base)}">${c.title}</a>`).join('');

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
export const heroOf = games => newest(games.filter(g => g.youtube && g.demo)) ?? newest(games.filter(g => g.demo)) ?? newest(games);

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
