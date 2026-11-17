// What the end card shows, from the reward and the trip. Wording comes from receipt.js and words.js.
import { buildReceipt, nextStepOf } from './receipt.js';
import { isLegal } from './words.js';

export const ACTIONS = [
  { id: 'edit', label: 'Change the rates' },
  { id: 'keep', label: 'Keep in the garage' },
  { id: 'again', label: 'Watch again' },
];

export function endCardModel(rewards, analysis, goal) {
  const { lines, total } = buildReceipt(rewards, analysis);
  const legal = isLegal(analysis);
  return {
    timeLine: `${analysis.seconds} s of ${goal} s goal`,
    timeOk: legal && analysis.seconds < goal,
    legal,
    earned: total,
    lines,
    verdict: nextStepOf(rewards, analysis),
    actions: ACTIONS,
  };
}
