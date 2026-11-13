// What the Treasure Maze page says, in plain words. No DOM.
import { ACTIONS, tileKind, greedyWalk } from './sim.js';

export const LESSON = 'Value spreads backward from the reward, one step at a time.';

const FIXED = { wall: 'Wall.', big: 'Big treasure, +10.', small: 'Small treasure, +3.', pit: 'Pit, -10.' };

// One sentence about a tile for screen readers and captions. action is an index into ACTIONS, or null.
export function describeTile(map, s, value, action) {
  const where = `Row ${Math.floor(s / map.nCols) + 1}, column ${(s % map.nCols) + 1}.`;
  const kind = tileKind(map, s);
  if (kind !== 'floor') return `${where} ${FIXED[kind]}`;
  const best = action === null ? 'No best move yet.' : `Best move: ${ACTIONS[action].name}.`;
  return `${where}${s === map.start ? ' Start.' : ''} Value ${value.toFixed(1)}. ${best}`;
}

export function gammaHint(gamma) {
  if (gamma < 0.3) return 'Almost only the next step counts: the robot grabs whatever is closest.';
  if (gamma < 0.7) return 'Near rewards count much more than far ones.';
  if (gamma < 0.9) return 'Far rewards still count, a little less for each step.';
  return 'Far rewards count almost as much as near ones: worth the walk.';
}

export function epsilonHint(epsilon) {
  if (epsilon === 0) return 'No exploring: it only repeats what it knows.';
  if (epsilon === 1) return 'Pure exploring: every move is random.';
  if (epsilon < 0.1) return 'Rarely tries anything new: it mostly repeats what it knows.';
  if (epsilon < 0.4) return 'Mostly repeats what it knows, with a fair share of random moves.';
  return 'Lots of random moves: it finds new things, but wastes steps.';
}

const OUTCOME = { big: 'Found the big treasure.', small: 'Took the small treasure.', pit: 'Fell in the pit.', cap: 'Ran out of steps.' };

export const episodeNote = ep => `${OUTCOME[ep.outcome]} ${ep.steps} steps, reward ${ep.reward.toFixed(1)}.`;

const WALK = { big: 'walks to the big treasure', small: 'walks to the small treasure', pit: 'falls in the pit', cap: 'wanders without finishing' };

export function learnedNote(agent) {
  const n = agent.episodes;
  return `${n} episode${n === 1 ? '' : 's'} so far. Without exploring it now ${WALK[greedyWalk(agent).outcome]}.`;
}

export const INFO = {
  discount: 'Discount is how much far-off reward counts: low, and the robot only cares about what is close; high, and a big treasure far away is worth the walk.',
  exploration: 'Exploring means trying a random move instead of the best one it knows; more of it finds new things but costs mistakes.',
  speed: 'Speed is how many episodes the robot learns from each second.',
  map: 'The map is the world the robot learns in: Near or far has two treasures, Cliff edge has a pit beside the short path.',
  reset: 'Reset wipes what the robot has learned, so it starts again knowing nothing.',
  values: 'Each tile is shaded by its value, how much reward the robot expects from there on; the arrow is the move it thinks is best.',
  curve: 'The curve shows the average reward over the last 20 episodes: it climbs as the robot learns, and it can go below zero when the robot keeps falling in the pit.',
  fourValues: 'Four values shows what the robot thinks each move is worth on every tile: up, down, left and right.',
};
