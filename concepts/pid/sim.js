// A drone that must hold a height against gravity. Pure logic, no DOM.
export const G = 9.8, DT = 1 / 60, SPAN = 8;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function createSim() {
  return { y: 1, v: 0, tgt: 5, integ: 0, prevE: 4, terms: [0, 0, 0], hist: [] };
}

export function stepSim(s, k) {
  const e = s.tgt - s.y;
  s.integ = clamp(s.integ + e * DT, -20, 20);
  const de = (e - s.prevE) / DT; s.prevE = e;
  const P = k.p * e, I = k.i * s.integ, D = k.d * de;
  s.terms = [P, I, D];
  s.thrust = clamp(P + I + D, -40, 40);
  s.v += (s.thrust - G * 0.5) * DT; // gravity pull the controller must beat
  s.v *= 0.999;
  s.y += s.v * DT;
  if (s.y < 0) { s.y = 0; s.v = Math.max(0, s.v); }
  if (s.y > 10) { s.y = 10; s.v = Math.min(0, s.v); }
  s.hist.push(e);
  if (s.hist.length > SPAN / DT) s.hist.shift();
}

export function gust(s) { s.v -= 6; }
export function setTarget(s, y) { s.tgt = clamp(y, 1, 9); }
