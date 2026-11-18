// What the city actually wanted from the trip, as a score out of 100. Pure, no DOM.
// The taxi is paid by the reward you write; this score is the real goal, so the two can drift apart.
export const ARRIVE_POINTS = 60;   // it got there
export const ON_TIME_POINTS = 20;  // and under the goal time, legally
export const CLEAN_POINTS = 20;    // no park, red-light or wrong-way moves
export const SCARE_COST = 5;       // per scared person (pedestrians arrive in a later slice)

const clamp0 = (n) => Math.max(0, n);
const countOf = (s) => (Array.isArray(s) ? s.length : s | 0);

function score({ arrived, seconds, off, red, wrong, scares, goalSeconds }) {
  const clean = off + red + wrong === 0;
  const onTime = arrived && clean && seconds < goalSeconds; // the goal is a legal trip under the time
  const parts = {
    arrive: arrived ? ARRIVE_POINTS : 0,
    onTime: onTime ? ON_TIME_POINTS : 0,
    clean: clean ? CLEAN_POINTS : 0,
    scared: scares ? -SCARE_COST * scares : 0,
  };
  return { arrived, onTime, violations: { off, red, wrong }, scared: scares, score: clamp0(parts.arrive + parts.onTime + parts.clean + parts.scared), parts };
}

// The end value, from the trip's analysis (analyzeRoute / tripEvents totals) and the people it scared.
export function trueGoal({ analysis, scares = [], goalSeconds }) {
  const a = analysis;
  return score({ arrived: a.arrived, seconds: a.seconds, off: a.offTiles, red: a.redRuns, wrong: a.wrongWays, scares: countOf(scares), goalSeconds });
}

// The live value, `f` steps into the drive: only whole steps count, and at the last step it equals trueGoal's.
export function goalAt(events, scaresSoFar, f, goalSeconds) {
  const whole = Math.min(events.steps.length, Math.max(0, Math.floor(f)));
  let off = 0, red = 0, wrong = 0, arrived = false;
  for (let i = 0; i < whole; i++) {
    const s = events.steps[i];
    if (s.off) off++;
    if (s.red) red++;
    if (s.wrong) wrong++;
    if (s.done) arrived = true;
  }
  return score({ arrived, seconds: whole, off, red, wrong, scares: countOf(scaresSoFar), goalSeconds }).score;
}
