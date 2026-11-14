// How it works pages: fills the shared header and footer. The page's own story.js wires the theme button.
import { headerHtml, footerHtml } from './site.js';

const base = '../../../';
const header = document.querySelector('header[data-site]'), footer = document.querySelector('footer[data-site]');
if (header) header.innerHTML = headerHtml(base, header.dataset.site);
if (footer) footer.innerHTML = footerHtml(base);
