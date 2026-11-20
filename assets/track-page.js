// Track page runtime: re-renders the generated list with the saved progress.
import { mountSite } from './site.js';
import { trackById } from './tracks/index.js';
import { loadProgress } from './tracks/progress.js';
import { trackBodyHtml } from './tracks/track-view.js';

export function renderTrack(doc, track, storage) {
  const el = doc.getElementById('track');
  if (el) el.innerHTML = trackBodyHtml(track, { done: loadProgress(storage), base: '../' });
}

if (typeof document !== 'undefined') {
  mountSite('../');
  const track = trackById(document.body.dataset.track);
  if (track) {
    let storage = null;
    try { storage = localStorage; } catch { /* blocked: render with no progress */ }
    renderTrack(document, track, storage);
  }
}
