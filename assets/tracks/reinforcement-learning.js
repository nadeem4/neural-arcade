// Track: Reinforcement learning. Lessons live only here (names, order, status).
// A wild entry says where another game shows the lesson; one for the lesson's own game is the caption under the stage.
const w = (game, says, show = false) => ({ game, says, show });

export default {
  id: 'reinforcement-learning',
  title: 'Reinforcement learning',
  blurb: 'Learning by reward, in one room that grows: from a single agent to deep RL.',
  game: 'treasure-room',
  needs: [{ track: 'neural-networks', before: 'function-approximation' }],
  parts: [
    {
      title: 'The problem',
      lessons: [
        { id: 'agent', title: 'Agent', level: 1, video: null, status: 'live',
          says: 'The agent is the learner that acts; the environment is everything it acts on, and it answers each move with a new situation and a reward.',
          wild: [
            w('maze', 'The explorer is the agent and the grid, with its treasure and pit, is the environment.'),
            w('runner', 'The hero is the agent and the platformer level is its environment.'),
            w('city', 'The taxi is the agent and the Chicago Loop, with its streets, lights and footpaths, is the environment. Cars and people react to the taxi, but they are not part of what it learns from.'),
            w('treasure-room', 'The robot is the agent and the room is the environment: all it gets back is where it is and a reward.'),
          ] },
        { id: 'state-action-reward', title: 'State, action, reward', level: 2, video: null, status: 'live',
          says: 'A state is where things stand now, an action is a move the agent can make, and a reward is the number the world hands back for that move.',
          wild: [
            w('maze', 'Each tile is a state, each step is an action, and treasure and the pit hand back the reward.'),
            w('runner', 'The hero sees the level around it, picks one of four moves, and is paid points for coins and the flag.'),
            w('city', 'Each map tile and light colour is a state, each move or wait is an action, and your rate card hands back the reward.'),
            w('treasure-room', 'Every move is logged as a state, an action and a reward, and the game is a list of these.'),
          ] },
        { id: 'return', title: 'Return', level: 3, video: null, status: 'live',
          says: 'The return is all the reward still to come, with far-off reward counted for less by the discount.',
          wild: [
            w('maze', 'The Discount slider sets how much far-off reward counts, which decides whether it walks to the small or the big treasure.'),
            w('city', 'The fare comes only at the drop-off, so the taxi weighs the whole trip, clock and fines included, not just the next block.'),
            w('treasure-room', 'Add up the rewards on a route, and lower the discount to watch far-away treasure lose its pull.'),
          ] },
        { id: 'policy', title: 'Policy', level: 4, video: null, status: 'live',
          says: "A policy is the agent's rulebook: in each state, which action to take.",
          wild: [
            w('maze', 'The arrows on the grid are its policy: the best move it has found for each tile.'),
            w('runner', 'Its brain is the policy: it turns what the hero sees into a choice among the four moves, and the points reshape it.'),
            w('city', 'The route it drives is its policy: the move it has found best for each tile and light, which changes whenever you rewrite the rate card.'),
            w('treasure-room', 'Put an arrow on every tile: that set of arrows is the policy.'),
          ] },
        { id: 'value', title: 'Value', level: 5, video: null, status: 'live',
          says: "A state's value is how much reward the agent can expect from there on, if it keeps following its policy.",
          wild: [
            w('maze', 'The lightness of each tile is its value, spreading back from the treasure as it learns.'),
            w('city', 'Behind each choice is a value: how much pay the taxi expects from a tile and light onward, learned from the trips it has tried.'),
            w('treasure-room', 'Sweep the room and each tile gets a number for how good it is to stand there.'),
          ] },
        { id: 'mdp', title: 'MDP', level: 6, video: null, status: 'live',
          says: 'An MDP is the whole game written down: states, actions, rewards and where each move leads, where only the present state matters, not how you got there.',
          wild: [
            w('treasure-room', 'Turn the floor icy so moves slip, and the best plan changes.'),
          ] },
      ],
    },
    {
      title: 'Planning with a map',
      lessons: [
        { id: 'bellman-equation', title: 'Bellman equation', level: 7, video: null, status: 'soon',
          says: 'A state is worth its reward plus the discounted worth of where it leads.' },
        { id: 'policy-iteration', title: 'Policy iteration', level: 8, video: null, status: 'soon',
          says: 'Score the current plan, improve it, and repeat until it stops changing.' },
      ],
    },
    {
      title: 'Learning without a map',
      lessons: [
        { id: 'exploration', title: 'Exploration', level: 9, video: null, status: 'soon',
          says: 'Sometimes try something new, or you never find what is better.' },
        { id: 'monte-carlo', title: 'Monte Carlo', level: 10, video: null, status: 'soon',
          says: 'Play whole episodes and learn from the rewards you actually got.' },
        { id: 'td-learning', title: 'TD learning', level: 11, video: null, status: 'soon',
          says: 'Learn after every step, from your own next guess.' },
        { id: 'sarsa', title: 'SARSA', level: 12, video: null, status: 'soon',
          says: 'Learn the value of the moves you really make, exploring included.' },
        { id: 'q-learning', title: 'Q-learning', level: 13, video: null, status: 'soon',
          says: 'Learn the best plan while exploring.',
          wild: [
            w('maze', 'The explorer learns the best move for each tile by trying them.', true),
          ] },
      ],
    },
    {
      title: 'Too big for a table',
      lessons: [
        { id: 'function-approximation', title: 'Function approximation', level: 14, video: null, status: 'soon',
          says: 'When there are too many states for a table, a network guesses the value instead.' },
        { id: 'dqn', title: 'DQN', level: 15, video: null, status: 'soon',
          says: 'Q-learning with a neural network, kept steady by replaying old moves.' },
      ],
    },
    {
      title: 'Learning the policy',
      lessons: [
        { id: 'policy-gradient', title: 'Policy gradient', level: 16, video: null, status: 'soon',
          says: 'Nudge the policy itself toward the moves that paid well.',
          wild: [
            w('runner', 'Its brain is a policy the points reshape.', true),
          ] },
        { id: 'actor-critic', title: 'Actor-critic', level: 17, video: null, status: 'soon',
          says: 'One part picks the moves, another judges them, and both learn.' },
        { id: 'ppo', title: 'PPO', level: 18, video: null, status: 'soon',
          says: 'Improve the policy in small safe steps so one bad update cannot ruin it.' },
      ],
    },
    {
      title: 'Getting the reward right',
      lessons: [
        { id: 'reward-design', title: 'Reward design', game: 'city', video: null, status: 'live',
          shareAlt: 'Reward design: a taxi that learns to cut across the park',
          says: 'Reward design is choosing the numbers an agent is paid and fined; it does exactly what they pay for, so every loophole in them becomes a behaviour.',
          wild: [
            w('runner', 'Pay more for coins than for the flag and the hero farms the coin block above the start for about 50 coins and never finishes: the best plan its points allow.'),
            w('city', 'The rate card is the reward design: every fine you add closes one loophole and the taxi finds the next.'),
          ] },
      ],
    },
  ],
};
