// What the end card shows, from the reward and the trip. Wording comes from receipt.js and words.js.
import { buildReceipt, hintOf, cheatsOf } from './receipt.js';
import { isLegal } from './words.js';
import { trueGoal } from './goal.js';

export const ACTIONS = [
  { id: 'edit', label: 'Change the rates' },
  { id: 'keep', label: 'Keep in the garage' },
  { id: 'again', label: 'Watch again' },
];

const round1 = (n) => Math.round(n * 10) / 10 + 0;

// honest is the analysis of the honest legal route under the same rates (honest.js), or null/absent if none exists.
// scared is the number of people the taxi frightened (people.js); it comes off the city's score (goal.js).
export function endCardModel(rewards, analysis, goal, honest = null, scared = 0) {
  const { lines, total } = buildReceipt(rewards, analysis);
  const legal = isLegal(analysis);
  return {
    timeLine: `${analysis.seconds} s of ${goal} s goal`,
    timeOk: legal && analysis.seconds < goal,
    legal,
    earned: total,
    lines,
    verdict: hintOf(rewards, analysis),
    honest: honest ? { reward: round1(honest.reward), seconds: honest.seconds } : null,
    honestLine: honest ? `Honest route earns ${round1(honest.reward)} pay. You earned ${total} pay.` : '',
    cheats: cheatsOf(rewards, analysis, honest),
    city: trueGoal({ analysis, scares: scared, goalSeconds: goal }).score,
    scared,
    scaredLine: scared ? `Scared ${scared} ${scared === 1 ? 'person' : 'people'}` : '',
    actions: ACTIONS,
  };
}
