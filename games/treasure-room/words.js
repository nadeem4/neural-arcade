// Treasure Room words: the page lesson, the (i) texts and the lines the game prints.
import { REWARD } from './sim.js';

export const LESSON = 'Six small ideas, one room: the AI only ever knows what the room tells it.';

export const INFO = {
  room: 'The room is a small grid with a treasure, a pit and a few walls.',
  reward: 'Every step costs 1, the treasure pays 10 and the pit costs 10.',
  log: 'Each line is one step: the state you were in, the action you took and the reward you got.',
  gamma: 'The discount shrinks rewards that are further away, so a low one makes the AI want things now.',
  route: 'A route is the list of moves from the start; its return is the rewards added up.',
  arrows: 'Tap a tile to turn its arrow, which is what the robot will do when it stands there.',
  sweep: 'One sweep updates every tile once from the tiles next to it, so value spreads outward.',
  values: 'The number on a tile is how good it is to stand there, counting what comes after.',
  ice: 'On ice a move works 80% of the time and slips to each side 10% of the time.',
  tags: 'These five parts, states, actions, rewards, slip chance and discount, are what makes the room an MDP.',
  learn: 'The score of a try is every reward it collected added up. A short try can score worst: the pit ends it, and the pit costs 10.',
  restart: 'Restart puts the robot back on the start tile and clears the score.',
  ai: 'The AI sees only its position and the last reward, nothing else about the room.',
};

// The cards on the labels over level 1's room (room-markers.js lists the labels).
export const MARKER_INFO = {
  agent: { title: 'The agent', text: 'This is the learner: the one that acts. Each move, it picks an action, and the room answers with where it is now and a reward. That is all it ever gets.' },
  treasure: { title: 'The treasure', text: `The goal. Reaching it ends the round with +${REWARD.treasure}.` },
  pit: { title: 'The pit', text: `A trap. Falling in ends the round with −${-REWARD.pit}.` },
};

const ARROWS = '↑↓←→';
export const actionArrow = a => ARROWS[a];

const signed = r => (r > 0 ? `+${r}` : r < 0 ? `−${-r}` : '0');

export const logLine = ({ pos, action, reward }) =>
  `state (${pos.x},${pos.y}) · action ${actionArrow(action)} · reward ${signed(reward)}`;

export function outcomeNote(outcome, total) {
  if (outcome === 'treasure') return `Found the treasure. Score ${total}.`;
  if (outcome === 'pit') return `Fell in the pit. Score ${total}.`;
  return 'Ran out of steps.';
}

export function gammaHint(gamma) {
  if (gamma < 0.4) return 'Only the next step or two matter. The treasure is hardly worth the walk.';
  if (gamma < 0.8) return 'Far-away rewards are worth much less, so short trips look best.';
  if (gamma < 0.95) return 'Far rewards still count, a little less for each step away.';
  return 'Almost no shrinking: the AI will plan a long way ahead.';
}

export function slipHint(slip) {
  if (slip <= 0) return 'The floor is dry: every move goes where you point it.';
  const ok = Math.round((1 - 2 * slip) * 100);
  return `The floor is icy: a move works ${ok}% of the time and slips sideways otherwise.`;
}
