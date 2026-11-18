// Module worker: gets the map from the page ('init'), trains the newest request; older ones stop between chunks. Logic lives in jobs.js.
import { loadWorld } from './sim.js';
import { trainInChunks } from './jobs.js';

// The page loads chicago.json once and posts it in an 'init' message; a train that arrives first waits for it.
let resolveWorld, rejectWorld;
const worldPromise = new Promise((res, rej) => { resolveWorld = res; rejectWorld = rej; });
worldPromise.catch(() => {}); // a train reports the failure; this stops an unhandled rejection

let latest = 0;
const post = (msg) => self.postMessage(msg, msg.visits ? [msg.visits.buffer] : []);

self.onmessage = async ({ data }) => {
  if (data.type === 'init') {
    try { resolveWorld(loadWorld(data.city)); } catch (err) { rejectWorld(err); }
    return;
  }
  if (data.type !== 'train') return;
  const { id, seed, rewards, episodes } = data;
  latest = id;
  const isStale = () => id !== latest;
  try {
    const world = await worldPromise;
    const res = await trainInChunks(world, { seed, rewards, episodes },
      (p) => post({ type: 'progress', id, ...p }), 50, isStale);
    if (res) post({ type: 'done', id, ...res });
  } catch (err) {
    if (!isStale()) post({ type: 'error', id, message: String(err && err.message || err) });
  }
};
