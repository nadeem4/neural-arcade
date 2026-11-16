// Module worker: trains the newest request; older ones stop between chunks. Logic lives in jobs.js.
import { loadWorld } from './sim.js';
import { trainInChunks } from './jobs.js';

let worldPromise = null;
function getWorld() {
  if (!worldPromise) {
    worldPromise = fetch(new URL('./chicago.json', import.meta.url))
      .then((r) => { if (!r.ok) throw new Error(`map load failed (${r.status})`); return r.json(); })
      .then((city) => loadWorld(city))
      .catch((err) => { worldPromise = null; throw err; });
  }
  return worldPromise;
}

let latest = 0;
const post = (msg) => self.postMessage(msg, msg.visits ? [msg.visits.buffer] : []);

self.onmessage = async ({ data }) => {
  if (data.type !== 'train') return;
  const { id, seed, rewards, episodes } = data;
  latest = id;
  const isStale = () => id !== latest;
  try {
    const world = await getWorld();
    const res = await trainInChunks(world, { seed, rewards, episodes },
      (p) => post({ type: 'progress', id, ...p }), 50, isStale);
    if (res) post({ type: 'done', id, ...res });
  } catch (err) {
    if (!isStale()) post({ type: 'error', id, message: String(err && err.message || err) });
  }
};
