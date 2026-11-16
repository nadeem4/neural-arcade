// Module worker: trains one request at a time off the main thread. Logic lives in jobs.js.
import { loadWorld } from './sim.js';
import { trainInChunks } from './jobs.js';

let worldPromise = null;
const getWorld = () => (worldPromise ||= fetch(new URL('./chicago.json', import.meta.url))
  .then((r) => r.json()).then((city) => loadWorld(city)));

self.onmessage = async ({ data }) => {
  if (data.type !== 'train') return;
  const { id, seed, rewards, episodes } = data;
  try {
    const world = await getWorld();
    const res = await trainInChunks(world, { seed, rewards, episodes },
      (p) => self.postMessage({ type: 'progress', id, ...p }));
    self.postMessage({ type: 'done', id, ...res });
  } catch (err) {
    self.postMessage({ type: 'error', id, message: String(err && err.message || err) });
  }
};
