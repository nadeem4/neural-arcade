// Reward City values, tuned by scripts/city/spike.mjs on the real map. Later slices use these, never their own.

// Pay-slip values. A new game starts with only the fare and the clock on.
export const DEFAULT_REWARDS = { fare: 100, time: 1, off: 0, red: 0, wrong: 0, perTile: 0 };

// Slider range per pay-slip line.
export const RANGES = {
  fare: { min: 0, max: 200, step: 10 },
  time: { min: 0, max: 3, step: 0.5 },
  off: { min: 0, max: 40, step: 5 },
  red: { min: 0, max: 40, step: 5 },
  wrong: { min: 0, max: 40, step: 5 },
  perTile: { min: 0, max: 5, step: 0.5 },
};

// Training values. SEED is the fixed seed the game page and the write-up's recorded story train with.
export const SEED = 1;
export const EPISODES = 60000;
export const STEP_CAP = 250;
export const HYPER = { alpha: 0.9, gamma: 0.99, eps0: 1, eps1: 0.05, decayEpisodes: 40000 };

// "Fix the taxi: a legal trip under GOAL_SECONDS s": the honest route's seconds plus 10%, up to a multiple of 5.
export const GOAL_SECONDS = 155;

const FINES = { off: 20, red: 30, wrong: 30 };
export const PRESETS = [
  { id: 'speed', name: 'Pay it for speed', text: 'Only the clock costs money. What could go wrong?',
    rewards: { ...DEFAULT_REWARDS } },
  { id: 'walk', name: 'Fine the park and footpaths', text: `Driving on grass or footpaths now costs ${FINES.off}.`,
    rewards: { ...DEFAULT_REWARDS, off: FINES.off } },
  { id: 'lights', name: 'Fine red lights too', text: `Each red light run costs ${FINES.red} as well.`,
    rewards: { ...DEFAULT_REWARDS, off: FINES.off, red: FINES.red } },
  { id: 'legal', name: 'Fine everything', text: `Going the wrong way down a one-way street costs ${FINES.wrong} too.`,
    rewards: { ...DEFAULT_REWARDS, ...FINES } },
  { id: 'mile', name: 'Pay it by the mile', text: 'Every tile driven now pays 3. More driving, more money. Surely it hurries?',
    rewards: { ...DEFAULT_REWARDS, ...FINES, perTile: 3 } },
];

// Does a trained route show what its card promises? legalTiles is the tile count of card 4's route.
export function checkPromise(id, a, legalTiles) {
  const clean = a.offTiles === 0 && a.redRuns === 0 && a.wrongWays === 0;
  switch (id) {
    case 'speed': return a.arrived && a.offTiles > 0;
    case 'walk': return a.arrived && a.offTiles === 0 && a.redRuns > 0;
    case 'lights': return a.arrived && a.offTiles === 0 && a.redRuns === 0 && a.wrongWays > 0;
    case 'legal': return a.arrived && clean;
    case 'mile': return !a.arrived && a.tiles > legalTiles;
    default: return false;
  }
}
