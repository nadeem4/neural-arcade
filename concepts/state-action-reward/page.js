import { triesHtml, wireTries } from '../../assets/concept-page.js';
import { presets, mountPlayground } from './play.js';
import { figureHtml } from './figures.js';
document.getElementById('figure').innerHTML = figureHtml() + '<figcaption>One state, four actions, four rewards: the cell beside the pit</figcaption>';
document.getElementById('tries').innerHTML = triesHtml(presets);
const { apply } = mountPlayground(document.getElementById('playground'));
wireTries(document.getElementById('tries'), presets, apply);
