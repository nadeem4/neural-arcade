// Reads the CSS colour tokens for canvas drawing, and wires the light/dark lamp button.
const KEYS = ['ground', 'tray', 'road', 'edge', 'ink', 'muted', 'rule', 'car', 'amber', 'amber-ink', 'red'];

export function readTheme() {
  const cs = getComputedStyle(document.documentElement);
  const t = { body: cs.getPropertyValue('--body').trim() };
  for (const k of KEYS) t[k] = cs.getPropertyValue('--' + k).trim();
  return t;
}

function isDark() {
  const set = document.documentElement.dataset.theme;
  return set ? set === 'dark' : !matchMedia('(prefers-color-scheme: light)').matches;
}

export function wireLamp(button, onChange) {
  const label = () => {
    const next = isDark() ? 'light' : 'dark';
    button.dataset.next = next;
    button.setAttribute('aria-label', `Switch to ${next} theme`);
    button.title = `Switch to ${next} theme`;
  };
  label();
  button.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('na-theme', next); } catch {}
    label(); onChange();
  });
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { label(); onChange(); });
}
