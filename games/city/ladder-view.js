// The ladder's buttons and note. Built once, then updated in place so a tapped step keeps focus.
import { STEPS } from './ladder.js';

export function buildLadder(list, onPick) {
  const buttons = new Map();
  list.replaceChildren(...STEPS.map(s => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'step'; b.textContent = s.n; b.title = s.card;
    b.addEventListener('click', () => onPick(s.id));
    li.append(b); buttons.set(s.id, b);
    return li;
  }));
  return buttons;
}

// model is ladderModel's result; busy disables the steps while the taxi trains.
export function updateLadder(buttons, els, model, busy) {
  for (const s of model.steps) {
    const b = buttons.get(s.id);
    b.classList.toggle('ticked', s.ticked);
    b.setAttribute('aria-label', s.label);
    if (s.current) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    b.disabled = busy;
  }
  els.head.textContent = model.note.head;
  els.text.textContent = model.note.text;
}
