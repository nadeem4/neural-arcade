// Page words and the goal check for Reward City.
import { GOAL_SECONDS } from './presets.js';

export const LESSON = 'The reward is the only thing the taxi wants: it does what you pay it for, not what you meant.';

export const INFO = {
  reward: 'The reward is everything the taxi cares about. Each slider is money it earns or loses on a trip, and it learns to make the total as big as it can.',
  goal: `Fix the taxi: write a reward that gets a legal trip under ${GOAL_SECONDS} seconds. Legal means no park, no red lights, no wrong way.`,
  meters: 'Pay is what the taxi earns under your reward. What the city wanted is the real goal: 60 for arriving, 20 for being on time, 20 for a clean trip, minus 5 for each person scared. When the two drift apart, the taxi is doing what you paid for, not what you meant.',
  map: 'The map is a few blocks of the real Chicago Loop, from OpenStreetMap. The taxi drives on streets, and cuts across parks if it pays.',
};

// Shown on the map screen, before any training.
export const goalLine = () => `Goal: arrive in ${GOAL_SECONDS} s, legally`;

export const isLegal = (a) => a.arrived && a.offTiles === 0 && a.redRuns === 0 && a.wrongWays === 0;

export const goalReached = (a) => isLegal(a) && a.seconds < GOAL_SECONDS;

export function shareLine(tries, a) {
  return `I fixed the taxi in ${tries} ${tries === 1 ? 'try' : 'tries'}: ${a.seconds} s, no fines.`;
}
