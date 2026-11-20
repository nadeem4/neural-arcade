import { triesHtml, wireTries } from '../../assets/concept-page.js';
import { presets, mountPlayground } from './play.js';
import { figureHtml } from './figures.js';
document.getElementById('figure').innerHTML = figureHtml() + '<figcaption>The same grid at two discounts: each number is a cell\'s value</figcaption>';
document.getElementById('tries').innerHTML = triesHtml(presets);
const { apply } = mountPlayground(document.getElementById('playground'));
wireTries(document.getElementById('tries'), presets, apply);
