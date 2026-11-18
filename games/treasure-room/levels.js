// The six Treasure Room levels: one idea each, each tied to one concept page.
export const LEVELS = [
  { n: 1, slug: 'agent', concept: 'agent', title: 'The agent and the room',
    brief: 'Drive the robot to the treasure, then hand over to the AI. All it ever gets back from the room is where it is and a reward.',
    lesson: 'The AI only knows what the room tells it.',
    info: 'The robot sends an action to the room, and the room sends back a position and a reward.' },
  { n: 2, slug: 'triples', concept: 'state-action-reward', title: 'State, action, reward',
    brief: 'Every move is written down as a state, an action and a reward. Play and watch the list grow.',
    lesson: 'The game is a list of these: state, action, reward.',
    info: 'Each line of the log is one state, the action taken there and the reward that came back.' },
  { n: 3, slug: 'return', concept: 'return', title: 'Return and discount',
    brief: 'Pick a route and add up its rewards. Lower the discount and far-away rewards shrink.',
    lesson: 'Shorter paths win, and a low discount makes the AI greedy for now.',
    info: 'The return is the sum of rewards on a route, with later rewards shrunk by the discount.' },
  { n: 4, slug: 'policy', concept: 'policy', title: 'Policy',
    brief: 'Put an arrow on every tile, then press Go. Let the AI fix the arrows that lead it wrong.',
    lesson: 'A policy is: on this tile, do this.',
    info: 'A policy is one arrow per tile: whatever tile the robot is on, it does what that arrow says.' },
  { n: 5, slug: 'value', concept: 'value', title: 'Value',
    brief: 'Sweep to spread worth outward from the treasure, then walk uphill to it.',
    lesson: 'Value is how good it is to stand here.',
    info: 'The number on a tile is the return the robot can expect if it starts there and plays well.' },
  { n: 6, slug: 'mdp', concept: 'mdp', title: 'The icy floor',
    brief: 'Make the floor icy so moves sometimes slip, and watch the best plan change.',
    lesson: 'The best plan changes once moves are uncertain.',
    info: 'On ice a move works 80% of the time and slips to each side 10% of the time.' },
];

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
