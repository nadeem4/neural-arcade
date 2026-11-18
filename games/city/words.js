// Page words and the goal check for Reward City.
import { GOAL_SECONDS } from './presets.js';
import { ARRIVE_POINTS, ON_TIME_POINTS, CLEAN_POINTS } from './goal.js';

export const LESSON = 'The taxi does what you paid for, not what you meant.';

export const INFO = {
  reward: 'The taxi only maximises the pay written on this card. Each line is money it earns or loses on a trip, and it keeps the trips that add up to the most.',
  ladder: 'Five rate cards, one tap each. Each one shows a way a reward goes wrong, and the last shows the fix. Tap a step to load its card, then train. You can edit the card after. Any order works.',
  goal: `Fix the taxi: write a reward that gets a legal trip under ${GOAL_SECONDS} seconds. Legal means no park or footpath driving, no red lights and no wrong-way moves.`,
  meters: `Pay is what the taxi earns under your card. What the city wanted is the real goal: ${ARRIVE_POINTS} for arriving, ${ON_TIME_POINTS} for a legal trip under the goal time, ${CLEAN_POINTS} for a clean trip that arrives. During the drive it shows the best score still possible, so it only falls. When the two drift apart, the taxi is doing what you paid for, not what you meant.`,
  map: 'The map is a few blocks of the real Chicago Loop, from OpenStreetMap. The taxi drives on streets, and crosses parks and footpaths when the card leaves that free.',
};

// Shown on the map screen, before any training.
export const goalLine = () => 'Get the passenger from pickup to drop-off, on time, by the rules.';

export const isLegal = (a) => a.arrived && a.offTiles === 0 && a.redRuns === 0 && a.wrongWays === 0;

export const goalReached = (a) => isLegal(a) && a.seconds < GOAL_SECONDS;

export function shareLine(tries, a) {
  return `I fixed the taxi in ${tries} ${tries === 1 ? 'try' : 'tries'}: ${a.seconds} s, no fines.`;
}
