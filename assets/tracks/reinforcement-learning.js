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
        { id: 'agent', title: 'Agent and environment', level: 'agent', video: null, status: 'live',
          says: 'The agent picks an action. The environment answers. That loop is all of reinforcement learning.',
          wild: [
            w('maze', 'The explorer is the agent and the grid, with its treasure and pit, is the environment.'),
            w('runner', 'The hero is the agent and the platformer level is its environment.'),
            w('city', 'The taxi is the agent and the Chicago Loop, with its streets, lights and footpaths, is the environment. Cars and people react to the taxi, but they are not part of what it learns from.'),
            w('treasure-room', 'The robot is the agent. The room is the environment: its walls, pit and treasure.'),
          ] },
        { id: 'state-action-reward', title: 'State, action, reward', level: 'state-action-reward', video: null, status: 'live',
          says: 'Every step is three things: the state you are in, the action you take, the reward you get back.',
          wild: [
            w('maze', 'Each tile is a state, each step is an action, and treasure and the pit hand back the reward.'),
            w('runner', 'The hero sees the level around it, picks one of four moves, and is paid points for coins and the flag.'),
            w('city', 'Each map tile and light colour is a state, each move or wait is an action, and your rate card hands back the reward.'),
            w('treasure-room', 'The state is where the robot stands. The action is an arrow. The reward is the number the room hands back.'),
          ] },
        { id: 'return', title: 'Return', level: 'return', video: null, status: 'live',
          says: 'The return is every reward still to come, added up. The discount makes rewards further away count less.',
          wild: [
            w('maze', 'The Discount slider sets how much far-off reward counts, which decides whether it walks to the small or the big treasure.'),
            w('city', 'The fare comes only at the drop-off, so the taxi weighs the whole trip, clock and fines included, not just the next block.'),
            w('treasure-room', 'From the start there are three routes: a coin 2 steps away, a chest 6 steps away, and a longer way round to the same chest, 8 steps. Every step costs 1.'),
          ] },
        { id: 'policy', title: 'Policy', level: 'policy', video: null, status: 'live',
          says: 'A policy is a rulebook: one action for every state. A better policy earns more return.',
          wild: [
            w('maze', 'The arrows on the grid are its policy: the best move it has found for each tile.'),
            w('runner', 'Its brain is the policy: it turns what the hero sees into a choice among the four moves, and the points reshape it.'),
            w('city', 'The route it drives is its policy: the move it has found best for each tile and light, which changes whenever you rewrite the rate card.'),
            w('treasure-room', 'The policy is the arrow on each tile. The robot only follows the arrows.'),
          ] },
        { id: 'value', title: 'Value', level: 'value', video: null, status: 'live',
          says: "A state's value is the return you can expect from there. It spreads back from the treasure.",
          wild: [
            w('maze', 'The lightness of each tile is its value, spreading back from the treasure as it learns.'),
            w('city', 'Behind each choice is a value: how much pay the taxi expects from a tile and light onward, learned from the trips it has tried.'),
            w('treasure-room', 'The value is the number that appears on each tile.'),
          ] },
        { id: 'mdp', title: 'MDP', level: 'mdp', video: null, status: 'live',
          says: 'An MDP is the game written down: states, actions, rewards, and the probability of where each action lands.',
          wild: [
            w('treasure-room', 'The icy floor makes moves slip: 8 in 10 go as meant.'),
          ] },
      ],
    },
    {
      title: 'Planning with a map',
      lessons: [
        { id: 'bellman-equation', title: 'Bellman equation', level: 'bellman-equation', video: null, status: 'soon',
          says: 'A state is worth its reward plus the discounted worth of where it leads.' },
        { id: 'policy-iteration', title: 'Policy iteration', level: 'policy-iteration', video: null, status: 'soon',
          says: 'Score the current plan, improve it, and repeat until it stops changing.' },
      ],
    },
    {
      title: 'Learning without a map',
      lessons: [
        { id: 'exploration', title: 'Exploration', level: 'exploration', video: null, status: 'soon',
          says: 'Sometimes try something new, or you never find what is better.' },
        { id: 'monte-carlo', title: 'Monte Carlo', level: 'monte-carlo', video: null, status: 'soon',
          says: 'Play whole episodes and learn from the rewards you actually got.' },
        { id: 'td-learning', title: 'TD learning', level: 'td-learning', video: null, status: 'soon',
          says: 'Learn after every step, from your own next guess.' },
        { id: 'sarsa', title: 'SARSA', level: 'sarsa', video: null, status: 'soon',
          says: 'Learn the value of the moves you really make, exploring included.' },
        { id: 'q-learning', title: 'Q-learning', level: 'q-learning', video: null, status: 'soon',
          says: 'Learn the best plan while exploring.',
          wild: [
            w('maze', 'The explorer learns the best move for each tile by trying them.', true),
          ] },
      ],
    },
    {
      title: 'Too big for a table',
      lessons: [
        { id: 'function-approximation', title: 'Function approximation', level: 'function-approximation', video: null, status: 'soon',
          says: 'When there are too many states for a table, a network guesses the value instead.' },
        { id: 'dqn', title: 'DQN', level: 'dqn', video: null, status: 'soon',
          says: 'Q-learning with a neural network, kept steady by replaying old moves.' },
      ],
    },
    {
      title: 'Learning the policy',
      lessons: [
        { id: 'policy-gradient', title: 'Policy gradient', level: 'policy-gradient', video: null, status: 'soon',
          says: 'Nudge the policy itself toward the moves that paid well.',
          wild: [
            w('runner', 'Its brain is a policy the points reshape.', true),
          ] },
        { id: 'actor-critic', title: 'Actor-critic', level: 'actor-critic', video: null, status: 'soon',
          says: 'One part picks the moves, another judges them, and both learn.' },
        { id: 'ppo', title: 'PPO', level: 'ppo', video: null, status: 'soon',
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
