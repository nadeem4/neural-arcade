import neuralNetworks from './neural-networks.js';
import reinforcementLearning from './reinforcement-learning.js';
import physicalAi from './physical-ai.js';

// The three tracks, in the order they are shown.
export const TRACKS = [neuralNetworks, reinforcementLearning, physicalAi];

export const trackById = id => TRACKS.find(t => t.id === id);
