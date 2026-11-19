// Page words and the goal check for Reward City.
import { GOAL_SECONDS } from './presets.js';
import { ARRIVE_POINTS, ON_TIME_POINTS, CLEAN_POINTS, SCARE_COST } from './goal.js';

export const LESSON = 'The taxi does what you paid for, not what you meant.';

export const INFO = {
  reward: 'The taxi only maximises the pay written on this card. Each line is money it earns or loses on a trip, and it keeps the trips that add up to the most.',
  ladder: 'Five ready-made rate cards. Each shows one way a reward goes wrong, and step 5 fixes it. Tap a step, then Train and drive.',
  goal: `Fix the taxi: write a reward that gets a legal trip under ${GOAL_SECONDS} seconds. Legal means staying off the footpaths, stopping at red lights and not going the wrong way.`,
  meters: `Pay is what the taxi earns from your card. What the city wanted is the real goal, out of 100: ${ARRIVE_POINTS} for arriving, ${ON_TIME_POINTS} for a legal, on-time trip, ${CLEAN_POINTS} for no cheats, minus ${SCARE_COST} for each person it scares. It only falls during the drive. When the two disagree, the taxi is doing what you paid for, not what you meant.`,
  map: 'The map is a few blocks of the real Chicago Loop, from OpenStreetMap. The taxi drives on streets, and crosses parks and footpaths when the card leaves that free. Cars and people react to the taxi, but they are not in the reward, so it does not care about them.',
};

// Shown on the map screen, before any training.
export const goalLine = () => 'Get the passenger from pickup to drop-off, on time, by the rules.';

export const isLegal = (a) => a.arrived && a.offTiles === 0 && a.redRuns === 0 && a.wrongWays === 0;

export const goalReached = (a) => isLegal(a) && a.seconds < GOAL_SECONDS;

// The page's canonical address, without the scheme (tests check it against the canonical link in index.html).
export const SHARE_ADDRESS = 'arcade.codewithnk.com/games/city/';

export function shareLine(tries, a) {
  return `I fixed the taxi in Reward City: a legal trip in ${a.seconds} s, after ${tries} ${tries === 1 ? 'try' : 'tries'}. ${SHARE_ADDRESS}`;
}
