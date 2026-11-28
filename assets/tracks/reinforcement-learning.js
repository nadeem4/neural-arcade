// Track: Reinforcement learning. Lessons live only here (names, order, status).
// A wild entry says where another game shows the lesson; one for the lesson's own game is the caption under the stage.
const w = (game, says, show = false) => ({ game, says, show });

export default {
  id: 'reinforcement-learning',
  title: 'Reinforcement learning',
  blurb: 'Learning by reward, in one room that grows: from one choice to deep RL.',
  game: 'treasure-room',
  needs: [{ track: 'neural-networks', before: 'function-approximation' }],
  parts: [
    {
      title: 'What is reinforcement learning?',
      lessons: [
        { id: 'learning-by-reward', title: 'Learning by reward', level: 'learning-by-reward', video: null, status: 'soon',
          says: 'Nobody shows the robot the right move. It tries moves, gets rewards, and does more of what paid.' },
        { id: 'loop', title: 'The loop', level: 'loop', video: null, status: 'live',
          says: 'The agent picks an action. The environment answers with a reward and a new situation. Then it repeats.',
          wild: [
            w('maze', 'The explorer is the agent and the grid, with its treasure and pit, is the environment.'),
            w('runner', 'The hero is the agent and the platformer level is its environment.'),
            w('city', 'The taxi is the agent and the Chicago Loop, with its streets, lights and footpaths, is the environment. Cars and people react to the taxi, but they are not part of what it learns from.'),
            w('treasure-room', 'The robot is the agent. The room is the environment: its walls, pit and treasure.'),
          ] },
      ],
    },
    {
      title: 'One decision',
      lessons: [
        { id: 'bandit', title: 'Which chest pays best', level: 'bandit', video: null, status: 'soon',
          says: 'One payout is luck. The value of a chest is the average of what it has paid you, corrected after every open.' },
        { id: 'exploration', title: 'Explore or exploit', level: 'exploration', video: null, status: 'soon',
          says: 'Always taking the best so far locks in early luck. Take the best most of the time and a random one sometimes.' },
      ],
    },
    {
      title: 'A chain of decisions',
      lessons: [
        { id: 'state', title: 'State', level: 'state', video: null, status: 'live',
          says: 'The state is what the agent knows about where it is. The best action depends on the state, and every action changes the state.',
          wild: [
            w('maze', 'Each tile is a state, each step is an action, and treasure and the pit hand back the reward.'),
            w('runner', 'The hero sees the level around it, picks one of four moves, and is paid points for coins and the flag.'),
            w('city', 'Each map tile and light colour is a state, each move or wait is an action, and your rate card hands back the reward.'),
            w('treasure-room', 'The state is where the robot stands. The action is an arrow. The reward is the number the room hands back.'),
          ] },
        { id: 'return', title: 'Return', level: 'return', video: null, status: 'live',
          says: 'The return is every reward still to come, added up. The discount makes rewards further away count a little less.',
          wild: [
            w('maze', 'The Discount slider sets how much far-off reward counts, which decides whether it walks to the small or the big treasure.'),
            w('city', 'The fare comes only at the drop-off, so the taxi weighs the whole trip, clock and fines included, not just the next block.'),
            w('treasure-room', 'From the start there are three routes: a coin 2 steps away, a chest 6 steps away, and a longer way round to the same chest, 8 steps. Every step costs 1.'),
          ] },
        { id: 'policy', title: 'Policy', level: 'policy', video: null, status: 'live',
          says: 'A policy is one action for every state: an arrow on every tile. A better policy earns more return.',
          wild: [
            w('maze', 'The arrows on the grid are its policy: the best move it has found for each tile.'),
            w('runner', 'Its brain is the policy: it turns what the hero sees into a choice among the four moves, and the points reshape it.'),
            w('city', 'The route it drives is its policy: the move it has found best for each tile and light, which changes whenever you rewrite the rate card.'),
            w('treasure-room', 'The policy is the arrow on each tile. The robot only follows the arrows.'),
          ] },
        { id: 'value', title: 'Value', level: 'value', video: null, status: 'live',
          says: "A state's value is the return you expect from there if you follow the policy. Store it on the tile and you never recount.",
          wild: [
            w('maze', 'The lightness of each tile is its value, spreading back from the treasure as it learns.'),
            w('city', 'Behind each choice is a value: how much pay the taxi expects from a tile and light onward, learned from the trips it has tried.'),
            w('treasure-room', 'The value is the number that appears on each tile.'),
          ] },
        { id: 'mdp', title: 'When moves slip: the MDP', level: 'mdp', video: null, status: 'live',
          says: 'An action now has odds, so a value is an average over what might happen. States, actions, rewards and odds together are called an MDP.',
          wild: [
            w('treasure-room', 'The icy floor makes moves slip: 8 in 10 go as meant.'),
          ] },
      ],
    },
    {
      title: 'Planning with the rulebook',
      lessons: [
        { id: 'bellman-equation', title: 'One step ahead: the Bellman equation', level: 'bellman-equation', video: null, status: 'soon',
          says: 'A tile is worth its reward plus the discounted worth of the tile it leads to. One step ahead is enough.' },
        { id: 'value-iteration', title: 'Value iteration', level: 'value-iteration', video: null, status: 'soon',
          says: "Apply the one-step rule to every tile, again and again. The chest's worth spreads one tile per sweep until the numbers stop moving." },
        { id: 'policy-iteration', title: 'Policy iteration', level: 'policy-iteration', video: null, status: 'soon',
          says: 'Score the current plan, turn each arrow to its best neighbour, and repeat until no arrow changes.' },
      ],
    },
    {
      title: 'Learning without the rulebook',
      lessons: [
        { id: 'monte-carlo', title: 'Monte Carlo', level: 'monte-carlo', video: null, status: 'soon',
          says: 'Play whole episodes and, for each tile you passed, average the returns you actually got from there.' },
        { id: 'td-learning', title: 'TD learning', level: 'td-learning', video: null, status: 'soon',
          says: "After every step, nudge this tile's value toward the reward plus the next tile's value." },
        { id: 'action-values', title: 'The value of a move: Q', level: 'action-values', video: null, status: 'soon',
          says: 'Give every move on every tile its own value, called Q. To act, take the move with the biggest Q.' },
        { id: 'q-learning', title: 'Q-learning', level: 'q-learning', video: null, status: 'soon',
          says: 'Update each move toward the reward plus the best move available next, whatever the robot does next.',
          wild: [
            w('maze', 'The explorer learns the best move for each tile by trying them.', true),
          ] },
        { id: 'sarsa', title: 'SARSA: the safe path', level: 'sarsa', video: null, status: 'soon',
          says: 'Update each move toward the move the robot really takes next. It learns the path that is best for a learner that still slips.' },
      ],
    },
    {
      title: 'Too big for a table',
      lessons: [
        { id: 'function-approximation', title: 'Function approximation', game: 'balance', video: null, status: 'soon',
          says: 'Replace the table with a network that takes the state and guesses the values. What it learns on one tile helps on tiles like it.' },
        { id: 'dqn', title: 'DQN', game: 'balance', video: null, status: 'soon',
          says: 'Learn from a shuffled memory of old moves, and aim at a frozen copy of the network that is refreshed only now and then.' },
      ],
    },
    {
      title: 'Learning the policy directly',
      lessons: [
        { id: 'policy-gradient', title: 'Policy gradient', game: 'balance', video: null, status: 'soon',
          says: 'Let the policy give odds for each move. After an episode, raise the odds of the moves taken in proportion to the return.',
          wild: [
            w('runner', 'Its brain is a policy the points reshape.', true),
          ] },
        { id: 'actor-critic', title: 'Actor-critic', game: 'balance', video: null, status: 'soon',
          says: 'A critic learns what to expect from each state. The actor is rewarded only for doing better than expected.' },
        { id: 'ppo', title: 'PPO', game: 'balance', video: null, status: 'soon',
          says: 'Limit how far the new odds may move from the old ones in one update.' },
      ],
    },
    {
      title: 'Planning meets learning',
      lessons: [
        { id: 'model-based', title: 'Learn the rulebook', level: 'model-based', video: null, status: 'soon',
          says: 'Record what each move did and you have your own rulebook. Between real steps, practise with it, as in Part 4.' },
        { id: 'search', title: 'Think before you move', level: 'search', video: null, status: 'soon',
          says: 'From where it stands, imagine many futures a few moves deep, guided by its learned values, and take the move that did best.' },
      ],
    },
    {
      title: 'In the real world',
      lessons: [
        { id: 'reward-design', title: 'Reward design', game: 'city', video: null, status: 'live',
          shareAlt: 'Reward design: a taxi that learns to cut across the park',
          says: 'The agent maximises the reward you wrote, not the goal you had in mind. Every loophole in the numbers becomes a behaviour.',
          wild: [
            w('runner', 'Pay more for coins than for the flag and the hero farms the coin block above the start for about 50 coins and never finishes: the best plan its points allow.'),
            w('city', 'The rate card is the reward design: every fine you add closes one loophole and the taxi finds the next.'),
          ] },
        { id: 'map-of-rl', title: 'The map of reinforcement learning', game: 'city', video: null, status: 'soon',
          says: 'Every method answers three questions: do you have the rulebook, does a table fit, and do you learn values or the policy. Answer them and the method picks itself.' },
      ],
    },
  ],
};
