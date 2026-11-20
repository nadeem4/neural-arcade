import { triesHtml, wireTries } from '../../assets/concept-page.js';
import { presets, mountPlayground } from './play.js';
import { figureHtml } from './figures.js';
document.getElementById('figure').innerHTML = figureHtml() + '<figcaption>The same eight rewards at discount 1, 0.9 and 0.5, with the exact return of each</figcaption>';
document.getElementById('tries').innerHTML = triesHtml(presets);
const { apply } = mountPlayground(document.getElementById('playground'));
wireTries(document.getElementById('tries'), presets, apply);
