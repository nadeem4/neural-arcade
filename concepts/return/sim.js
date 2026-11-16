// Return and discount: pure maths, no DOM. A row of upcoming rewards, each counted for less the further away it is.
export const REWARDS = [1, 1, 1, 1, 1, 1, 1, 10];

export const discounted = (rewards, gamma) => rewards.map((r, t) => r * gamma ** t);
export const returnOf = (rewards, gamma) => discounted(rewards, gamma).reduce((a, b) => a + b, 0);
export const setReward = (rewards, i, v) => rewards.map((r, j) => (j === i ? v : r));
