// What the end card shows, from the reward and the trip. Wording comes from receipt.js and words.js.
import { buildReceipt, hintOf, nextStepOf, cheatsOf, signed } from './receipt.js';
import { isLegal } from './words.js';
import { trueGoal, SCARE_COST, SCARE_MAX } from './goal.js';
import { STEPS, matchStep } from './ladder.js';

export const ACTIONS = [
  { id: 'edit', label: 'Change the rates' },
  { id: 'keep', label: 'Keep in the garage' },
  { id: 'again', label: 'Watch again' },
];

const round1 = (n) => Math.round(n * 10) / 10 + 0;

// On a ladder step 1 to 4: the step after it, "Next: step N". Step 5 and the player's own cards have none.
function nextOf(rewards) {
  const i = STEPS.findIndex(s => s.id === matchStep(rewards));
  return i >= 0 && i < STEPS.length - 1 ? { id: STEPS[i + 1].id, label: `Next: step ${STEPS[i + 1].n}` } : null;
}

// honest is the analysis of the honest legal route under the same rates (honest.js), or null/absent if none exists.
// scared is the number of people the taxi frightened (people.js); it comes off the city's score (goal.js).
export function endCardModel(rewards, analysis, goal, honest = null, scared = 0) {
  const { lines, total } = buildReceipt(rewards, analysis);
  const legal = isLegal(analysis);
  const onLadder = matchStep(rewards) !== null; // a ladder card is one lesson at a time: name only the first cheat, as its step note does
  const timeOk = legal && analysis.seconds < goal;
  return {
    timeLine: `Goal: legal and under ${goal} s`,
    timeOk,
    timeTone: legal ? (timeOk ? 'pay' : 'fine') : '', // green on time, orange when legal but slow, neutral when a cheat made the time
    legal,
    earned: total,
    lines,
    verdict: onLadder ? nextStepOf(rewards, analysis) : hintOf(rewards, analysis),
    honest: honest ? { reward: round1(honest.reward), seconds: honest.seconds } : null,
    honestLine: honest ? (legal && round1(honest.reward) === total
      ? `This taxi drove the legal route: ${signed(total)}.`
      : `The legal route pays ${signed(round1(honest.reward))}. This taxi earned ${signed(total)}.`) : '',
    cheats: cheatsOf(rewards, analysis, honest),
    city: trueGoal({ analysis, scares: scared, goalSeconds: goal }).score,
    scared,
    scaredLine: scared ? `It scared ${scared} ${scared === 1 ? 'person' : 'people'} on the footpath (−${Math.min(SCARE_MAX, SCARE_COST * scared)} city score).` : '',
    next: nextOf(rewards),
    actions: ACTIONS,
  };
}
