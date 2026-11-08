// The shared header and footer. A page holds <header data-site></header> and <footer data-site></footer>, then calls mountSite(base),
// where base is the path back to the site root ('' on the home page, '../../' from games/<id>/).
import { wireLamp } from './theme.js';

const SUN = '<svg class="ic ic-sun" aria-hidden="true" focusable="false" viewBox="0 0 256 256" fill="currentColor"><path d="M120,40V16a8,8,0,0,1,16,0V40a8,8,0,0,1-16,0Zm72,88a64,64,0,1,1-64-64A64.07,64.07,0,0,1,192,128Zm-16,0a48,48,0,1,0-48,48A48.05,48.05,0,0,0,176,128ZM58.34,69.66A8,8,0,0,0,69.66,58.34l-16-16A8,8,0,0,0,42.34,53.66Zm0,116.68-16,16a8,8,0,0,0,11.32,11.32l16-16a8,8,0,0,0-11.32-11.32ZM192,72a8,8,0,0,0,5.66-2.34l16-16a8,8,0,0,0-11.32-11.32l-16,16A8,8,0,0,0,192,72Zm5.66,114.34a8,8,0,0,0-11.32,11.32l16,16a8,8,0,0,0,11.32-11.32ZM48,128a8,8,0,0,0-8-8H16a8,8,0,0,0,0,16H40A8,8,0,0,0,48,128Zm80,80a8,8,0,0,0-8,8v24a8,8,0,0,0,16,0V216A8,8,0,0,0,128,208Zm112-88H216a8,8,0,0,0,0,16h24a8,8,0,0,0,0-16Z"/></svg>';
const MOON = '<svg class="ic ic-moon" aria-hidden="true" focusable="false" viewBox="0 0 256 256" fill="currentColor"><path d="M233.54,142.23a8,8,0,0,0-8-2,88.08,88.08,0,0,1-109.8-109.8,8,8,0,0,0-10-10,104.84,104.84,0,0,0-52.91,37A104,104,0,0,0,136,224a103.09,103.09,0,0,0,62.52-20.88,104.84,104.84,0,0,0,37-52.91A8,8,0,0,0,233.54,142.23ZM188.9,190.34A88,88,0,0,1,65.66,67.11a89,89,0,0,1,31.4-26A106,106,0,0,0,96,56,104.11,104.11,0,0,0,200,160a106,106,0,0,0,14.92-1.06A89,89,0,0,1,188.9,190.34Z"/></svg>';
const MARK = '<svg viewBox="0 0 26 26" aria-hidden="true"><rect width="26" height="26" rx="7" fill="var(--ink)"/><circle cx="8" cy="9" r="2.4" fill="var(--bg)"/><circle cx="8" cy="17" r="2.4" fill="var(--bg)"/><circle cx="18" cy="13" r="3" fill="var(--signal)"/><path d="M8 9 L18 13 L8 17" stroke="var(--bg)" stroke-width="1.4" fill="none"/></svg>';

export function headerHtml(base, current) {
  const link = (id, href, label) =>
    `<a href="${base}${href}"${current === id ? ' aria-current="page"' : ''}>${label}</a>`;
  return `<div class="wrap top">
  <a class="logo" href="${base}">${MARK}Neural Arcade</a>
  <nav aria-label="Main">${link('games', 'games/', 'Games')}${link('about', 'about/', 'About')}<button class="btn lamp" id="lamp" type="button" aria-label="Switch theme" title="Switch theme">${SUN}${MOON}</button></nav>
</div>`;
}

export function footerHtml() {
  return '<div class="wrap"><span>Built by Nadeem.</span><a href="https://www.codewithnk.com">codewithnk.com</a></div>';
}

export function mountSite(base, current = '') {
  const header = document.querySelector('header[data-site]');
  const footer = document.querySelector('footer[data-site]');
  if (header) header.innerHTML = headerHtml(base, current || header.dataset.site);
  if (footer) footer.innerHTML = footerHtml();
  const lamp = document.getElementById('lamp');
  if (lamp) wireLamp(lamp, () => {});
}
