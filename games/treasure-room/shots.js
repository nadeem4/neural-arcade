// Capture mode (developer only, no link from the site): ?shots=1&fig=N[&size=WxH] draws one How it works image in the 3D room
// and offers it as fig-N.webp. FIGURES follows the images of how-it-works/index.html in page order (N is the image's place, not the
// figure number: Fig. 5 is two images); every image's opts come from story.json, the recorded run. The top of this file is pure
// (no three.js, no DOM); mountShots loads the scene.
import { makeGrid } from '../../assets/grid.js';
import { heatOf } from './level-value.js';

const SIZE = [1280, 800]; // 16:10
const fig = (n, level, overlays) => ({ n, file: `fig-${n}.webp`, size: SIZE, level, overlays, pose: 'default' });

export const FIGURES = [
  fig(1, 1, ['trail']),
  fig(2, 3, ['trail']),
  fig(3, 4, ['arrows', 'trail']),
  fig(4, 4, ['arrows', 'trail']),
  fig(5, 5, ['values']), // Fig. 5, after the second sweep
  fig(6, 5, ['values']), // Fig. 5, settled
  fig(7, 6, ['trail', 'ice']),
  fig(8, 6, ['trail', 'ice']),
];

// The scene.draw opts for image n.
export function figureOpts(story, n) {
  const agent = story.triples[0].state, P = story.policy, M = story.mdp, room = makeGrid(story.room);
  const sweep = sn => ({ agent, values: sn.values, heat: heatOf(sn.values, room) });
  switch (n) {
    case 1: return { agent, ghost: [agent, ...story.agent.trace.map(t => t.pos)] };
    case 2: return { agent, ghost: [story.returns.shortCells, story.returns.detourCells] };
    case 3: return { agent, policy: P.bad, ghost: P.badRun.cells };
    case 4: return { agent, policy: P.fixed, ghost: P.fixedRun.cells };
    case 5: return sweep(story.value.snapshots[1]);
    case 6: return sweep(story.value.snapshots.at(-1));
    case 7: return { agent, ghost: M.dry.cells, ice: false };
    case 8: return { agent, ghost: M.icy.cells, ice: true };
    default: throw new Error(`Unknown figure: ${n}`);
  }
}

export function parseShots(search = '') {
  const q = new URLSearchParams(search);
  if (q.get('shots') !== '1') return null;
  const f = FIGURES.find(x => x.n === Number(q.get('fig')));
  if (!f) return null;
  const m = /^(\d+)x(\d+)$/.exec(q.get('size') ?? '');
  return { fig: f.n, size: m && +m[1] > 0 && +m[2] > 0 ? [+m[1], +m[2]] : f.size };
}

const frames = n => new Promise(r => { const go = i => (i ? requestAnimationFrame(() => go(i - 1)) : r()); go(n); });

// box: an empty element. shot: parseShots' result. Draws the figure in the fixed pose and adds a Download button.
export async function mountShots(box, { fig: n, size: [w, h] }) {
  const f = FIGURES.find(x => x.n === n);
  const [{ loadKit }, { loadCharacter }, { createScene3d }] = await Promise.all([
    import('./room-kit.js'), import('./room-character.js'), import('./room-scene.js'),
  ]);
  const story = await (await fetch(new URL('./story.json', import.meta.url))).json();
  const [kit, character] = await Promise.all([loadKit(), loadCharacter()]);
  Object.assign(box.style, { width: w + 'px', height: h + 'px', position: 'relative' });
  const scene = createScene3d({ box, room: makeGrid(story.room), kit, character, reduceMotion: true, preserveDrawingBuffer: true });
  scene.setOverlays(f.overlays);
  scene.draw(figureOpts(story, n));
  await frames(3);
  const canvas = box.querySelector('canvas');
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = `Download ${f.file}`;
  btn.addEventListener('click', () => {
    const out = document.createElement('canvas'); // exactly w x h whatever the device pixel ratio
    out.width = w; out.height = h;
    out.getContext('2d').drawImage(canvas, 0, 0, w, h);
    out.toBlob(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = f.file;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, 'image/webp', 0.85);
  });
  box.after(btn);
  return { scene, button: btn };
}
