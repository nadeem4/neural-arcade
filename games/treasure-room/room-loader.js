// The loading and failure panel that sits over the room box. Plain DOM, no 3D library imports: the host tells it what happened.
export const REASONS = {
  'no-webgl': 'This browser or device has no WebGL.',
  load: 'The 3D files did not load. Check your connection.',
  scene: 'The 3D view could not start.',
  lost: 'The 3D view was interrupted.',
};

export function createLoader(box, { title, onRetry, doc = document, reduceMotion = false }) {
  let root = null, fill, reason, retryBtn, timer = null;

  const make = (tag, cls, text) => {
    const n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };

  function build() {
    root = make('div', 'room-loader');
    root.setAttribute('aria-live', 'polite');
    const line = make('p', 'room-loader-line', 'Entering the room…');
    const bar = make('div', 'room-loader-bar');
    fill = make('div', 'room-loader-fill');
    bar.append(fill);
    const failure = make('div', 'room-loader-failure');
    reason = make('p', 'room-loader-reason');
    retryBtn = make('button', 'btn primary', 'Try again');
    retryBtn.setAttribute('type', 'button');
    retryBtn.addEventListener('click', () => onRetry());
    failure.append(make('h3', '', 'This room needs 3D graphics'), reason, retryBtn);
    root.append(make('p', 'room-loader-title', title), line, bar, failure);
    box.append(root);
  }

  const alive = () => root !== null;
  const stopTimer = () => { clearTimeout(timer); timer = null; };

  function loading() {
    stopTimer();
    if (!alive()) build();
    root.dataset.state = 'loading';
    root.setAttribute('role', 'status');
    progress(0);
  }

  function progress(f) {
    if (!alive()) return;
    fill.style.setProperty('--p', Math.round(Math.min(1, Math.max(0, f)) * 100) / 100);
  }

  function fail(why) {
    stopTimer();
    const hadFocus = box.contains(doc.activeElement);
    if (!alive()) build();
    root.dataset.state = 'failed';
    root.setAttribute('role', 'alert');
    reason.textContent = REASONS[why] ?? REASONS.scene;
    if (hadFocus) retryBtn.focus();
  }

  function destroy() {
    stopTimer();
    root?.remove();
    root = null;
  }

  function done() {
    if (!alive()) return;
    root.dataset.state = 'done';
    root.setAttribute('role', 'presentation');
    stopTimer();
    if (reduceMotion) destroy();
    else timer = setTimeout(destroy, 300);
  }

  build();
  loading();
  return { progress, loading, fail, done, destroy };
}
