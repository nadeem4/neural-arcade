// What the end card shows, from the reward and the trip. Wording comes from receipt.js and words.js.
import { buildReceipt, nextStepOf, cheatsOf } from './receipt.js';
import { isLegal } from './words.js';
import { trueGoal } from './goal.js';

export const ACTIONS = [
  { id: 'edit', label: 'Change the rates' },
  { id: 'keep', label: 'Keep in the garage' },
  { id: 'again', label: 'Watch again' },
];

const round1 = (n) => Math.round(n * 10) / 10 + 0;

// honest is the analysis of the honest legal route under the same rates (honest.js), or null/absent if none exists.
export function endCardModel(rewards, analysis, goal, honest = null) {
  const { lines, total } = buildReceipt(rewards, analysis);
  const legal = isLegal(analysis);
  return {
    timeLine: `${analysis.seconds} s of ${goal} s goal`,
    timeOk: legal && analysis.seconds < goal,
    legal,
    earned: total,
    lines,
    verdict: nextStepOf(rewards, analysis),
    honest: honest ? { reward: round1(honest.reward), seconds: honest.seconds } : null,
    honestLine: honest ? `Honest route earns ${round1(honest.reward)} pay. You earned ${total} pay.` : '',
    cheats: cheatsOf(rewards, analysis, honest),
    city: trueGoal({ analysis, goalSeconds: goal }).score,
    actions: ACTIONS,
  };
}
