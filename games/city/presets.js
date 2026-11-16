// Pay-slip values. A new game starts with only the fare and the clock on.
export const DEFAULT_REWARDS = { fare: 100, time: 1, off: 0, red: 0, wrong: 0, perTile: 0 };

// Provisional training values; RC0.5 tunes them on the real map.
export const STEP_CAP = 400;
export const HYPER = { alpha: 0.5, gamma: 0.99, eps0: 1, eps1: 0.05, decayEpisodes: 1000 };
