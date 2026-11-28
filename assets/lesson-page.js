// Lesson page runtime. The generator bakes in everything from config; this mounts the level and runs Mark as done.
// Importing video.js wires the click-to-play facade already on the page.
import './video.js';
import { mountSite } from './site.js';
import { lessonById } from './tracks/model.js';
import { loadProgress, saveProgress, toggleDone } from './tracks/progress.js';
import { markDoneLabel } from './tracks/lesson-view.js';
import { mountLevelPlay } from '../games/treasure-room/level-panel.js';

// Returns the mounted level (for the lamp to redraw), or null when there is nothing to mount.
export function mountLessonPage({ id, doc = document, storage = globalThis.localStorage, mountLevel = mountLevelPlay }) {
  const lesson = lessonById(id);
  if (!lesson || lesson.status !== 'live') return null;
  const level = lesson.level != null ? mountLevel(doc.getElementById('levelRoot'), { id: lesson.level, showTitle: false }) : null;

  let done = loadProgress(storage).includes(lesson.id);
  const button = doc.getElementById('markDone');
  const render = () => {
    button.setAttribute('aria-pressed', String(done));
    button.innerHTML = markDoneLabel(done);
  };
  if (button) {
    render();
    button.addEventListener('click', () => {
      done = !done;
      saveProgress(toggleDone(loadProgress(storage), lesson.id, done), storage); // blocked storage: the visit still toggles
      render();
    });
  }
  return level;
}

if (typeof document !== 'undefined') {
  let level = null;
  mountSite('../../', () => level?.redraw?.());
  level = mountLessonPage({ id: document.body.dataset.lesson });
}
