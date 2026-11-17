// The garage drawer: one card per kept taxi, dashed empty bays for the rest. Thin DOM code; the logic is in garage.js and naming.js.
import { stripeFor, rateChips } from './naming.js';

const SVG = 'http://www.w3.org/2000/svg';

// A small yellow taxi, drawn here so the cards need no image file.
function taxiIcon() {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 80 40'); svg.setAttribute('width', '72'); svg.setAttribute('height', '36'); svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = '<rect x="6" y="18" width="68" height="14" rx="5" fill="#F5B820"/><path d="M20 18 L27 7 H52 L61 18 Z" fill="#F5B820"/><path d="M26 17 L31 9 H40 V17 Z M43 17 V9 H51 L57 17 Z" fill="#0E1A2B"/><rect x="33" y="3" width="14" height="4" rx="1" fill="#0E1A2B"/><circle cx="22" cy="32" r="6" fill="#0E1A2B"/><circle cx="58" cy="32" r="6" fill="#0E1A2B"/>';
  return svg;
}

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

function card(taxi, i, { onDrive, onRemove, onPick, canDrive, picks = [], canRace = false, raceTitle = '' }) {
  const picked = picks.includes(taxi.id);
  const li = el('li', picked ? 'bay picked' : 'bay');
  const stripe = el('span', 'bay-stripe'); stripe.style.background = stripeFor(taxi.name);
  const head = el('div', 'bay-head');
  head.append(taxiIcon(), el('span', 'bay-name', taxi.name), el('span', 'bay-try', `Try ${taxi.tries}`));
  const chips = el('div', 'bay-chips');
  chips.append(...rateChips(taxi.rewards).map(c => el('span', 'chip-rate', c)));
  const drive = el('button', 'go small', 'DRIVE');
  drive.type = 'button'; drive.disabled = !canDrive;
  drive.setAttribute('aria-label', `Drive ${taxi.name}`);
  drive.addEventListener('click', () => onDrive(taxi));
  const del = el('button', 'btn bay-remove', 'Remove');
  del.type = 'button'; del.setAttribute('aria-label', `Remove ${taxi.name}`);
  del.addEventListener('click', () => onRemove(taxi, i));
  const race = el('button', 'btn bay-race', picked ? 'In race' : 'Race');
  race.type = 'button'; race.disabled = !canRace; race.setAttribute('aria-pressed', String(picked));
  race.setAttribute('aria-label', `Race ${taxi.name}`);
  race.addEventListener('click', () => onPick(taxi, i));
  // A disabled button shows no tooltip, so the span carries the title.
  const raceWrap = el('span', 'bay-race-wrap');
  if (!canRace) raceWrap.title = raceTitle;
  raceWrap.append(race);
  const actions = el('div', 'bay-actions'); actions.append(drive, raceWrap, del);
  const earned = Math.round(taxi.analysis.reward * 10) / 10 + 0;
  const stats = el('div', 'bay-stats');
  stats.append(el('span', 'bay-time', `${taxi.bestSeconds} s`), el('span', `bay-earned ${earned >= 0 ? 'pay' : 'fine'}`, `${earned > 0 ? '+' : ''}${earned}`));
  li.append(stripe, head, chips, stats, el('span', 'bay-note', taxi.note), actions);
  return li;
}

// Fills the list from the garage. handlers: { onDrive(taxi), onRemove(taxi), onPick(taxi), canDrive, picks (ids), canRace, raceTitle }.
export function renderGarage(list, garage, handlers) {
  const bays = garage.taxis.map((t, i) => card(t, i, handlers));
  for (let i = garage.taxis.length; i < garage.max; i++) {
    const li = el('li', 'bay empty'); li.append(el('span', 'bay-name', 'Empty bay'));
    bays.push(li);
  }
  list.replaceChildren(...bays);
}
