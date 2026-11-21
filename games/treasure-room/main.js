// Treasure Room page: picks a level from the URL, builds the level nav, and mounts that level's panel.
import { wireLamp } from '../../assets/theme.js';
import { lessonOfLevel } from '../../assets/tracks/model.js';
import { levelFromUrl, navModel } from './levels.js';
import { warm } from './room-host.js';
import { mountLevelPlay, BUILT_LEVELS } from './level-panel.js';

const $ = id => document.getElementById(id);
const titleOf = n => lessonOfLevel('treasure-room', n).title;
let handle = null;

function mountLevel(n) {
  handle?.destroy();
  const nav = navModel(BUILT_LEVELS, n, titleOf);
  n = nav.find(x => x.current).n;
  $('levels').innerHTML = nav.map(x => `<a href="${x.href}"${x.current ? ' aria-current="true"' : ''}><b>${x.n}</b> ${x.title}</a>`).join('');
  handle = mountLevelPlay($('levelRoot'), { n, title: `Level ${n}: ${titleOf(n)}` });
}

$('levels').addEventListener('click', e => {
  const a = e.target.closest('a');
  if (!a) return;
  e.preventDefault();
  history.replaceState(null, '', a.getAttribute('href'));
  mountLevel(levelFromUrl(location.search, location.hash));
});

// Start the 3D scene and models before the first mount asks for them, and on a hover over the level nav. Every level is 3D and
// shares one download, so warming for the current level covers the one about to be opened.
warm({ n: levelFromUrl(location.search, location.hash) });
$('levels').addEventListener('pointerenter', () => warm({ n: levelFromUrl(location.search, location.hash) }), true);

wireLamp($('lamp'), () => handle?.redraw());
mountLevel(levelFromUrl(location.search, location.hash));
