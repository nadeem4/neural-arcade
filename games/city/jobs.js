// Training jobs: only the newest start counts. DOM-free and Worker-free, so Node can test it.
import { HYPER } from './presets.js';
import { analyzeRoute } from './sim.js';
import { createAgent, trainEpisodes, greedyRoute } from './train.js';

// runTrain(req, onProgress) -> Promise<result> is injected: the page passes a Worker wrapper.
// The same request (seed, episodes, rewards) always trains to the same result, so the last CACHE_MAX are kept.
const CACHE_MAX = 12;
const copyOf = (res) => ({ ...res, visits: res.visits.slice() });

export function createJobs(runTrain) {
  let current = 0;
  const cache = new Map();
  return {
    start(req, onProgress = () => {}) {
      const id = ++current;
      const live = () => id === current;
      const key = JSON.stringify([req.seed, req.episodes, req.rewards]);
      if (cache.has(key)) return Promise.resolve(copyOf(cache.get(key)));
      return runTrain(req, (p) => { if (live()) onProgress(p); })
        .then((res) => {
          if (!live()) return null;
          if (res && res.visits) {
            cache.set(key, copyOf(res));
            if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
          }
          return res;
        }, (err) => { if (live()) throw err; return null; });
    },
    cancel() { current++; },
  };
}

// Main-thread fallback (no Worker): trains in chunks, yielding between them so the page stays live.
// isStale() is checked before each chunk; a stale run stops and resolves null without reporting.
// Chunks continue agent.episodes, so the result matches one trainEpisodes call. Progress about every 5 percent.
export async function trainInChunks(world, req, onProgress = () => {}, chunk = 50, isStale = () => false) {
  const { seed, rewards, episodes } = req;
  const agent = createAgent(world, seed);
  const step = Math.max(1, Math.ceil(episodes / 20));
  let reported = 0;
  while (agent.episodes < episodes) {
    if (isStale()) return null;
    trainEpisodes(agent, rewards, Math.min(chunk, episodes - agent.episodes), HYPER);
    if (agent.episodes - reported >= step || agent.episodes === episodes) {
      reported = agent.episodes;
      onProgress({ done: agent.episodes, total: episodes, visits: agent.visits.slice() });
    }
    if (agent.episodes < episodes) {
      await new Promise((r) => setTimeout(r, 0));
      if (isStale()) return null;
    }
  }
  const route = greedyRoute(agent, rewards);
  return { route, analysis: analyzeRoute(world, route, rewards), visits: agent.visits.slice() };
}
