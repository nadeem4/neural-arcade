// Page head and shell builders for the generated pages. Pure strings, no DOM.
export const SITE_URL = 'https://arcade.codewithnk.com/';

export const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// The canonical, og:* and twitter:* lines every page hard-codes. `path` like "neural-networks/", `image` a site-root path.
export function shareTagsHtml({ title, description, path, image = 'assets/share.png', imageAlt }) {
  const url = SITE_URL + path;
  const img = SITE_URL + image;
  return `<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Neural Arcade">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${img}">
<meta property="og:image:width" content="1280">
<meta property="og:image:height" content="720">
<meta property="og:image:alt" content="${esc(imageAlt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${img}">`;
}

// Pages that load GLTFLoader or OrbitControls need this: they import the bare specifier `three`.
export const IMPORT_MAP_HTML = '<script type="importmap">{"imports":{"three":"/assets/vendor/three/three.module.min.js"}}</script>';

// A whole document. `depth` is the number of folders below the site root.
export function pageHtml({ title, description, path, depth, styles = [], siteKey, mainHtml, scripts = [],
  bodyAttrs = '', headHtml = '', mainAttrs = 'class="wrap"', image = 'assets/share.png', imageAlt }) {
  const base = '../'.repeat(depth);
  const css = ['assets/studio.css', ...styles].map(h => `<link rel="stylesheet" href="${base}${h}">`).join('\n');
  const js = scripts.map(s => `<script type="module" src="${s.startsWith('./') ? s : base + s}"></script>`).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${shareTagsHtml({ title, description, path, image, imageAlt })}
${headHtml ? headHtml + '\n' : ''}<link rel="icon" href="${base}assets/icon.svg" type="image/svg+xml">
${css}
<script>try { const t = localStorage.getItem('na-theme'); if (t) document.documentElement.dataset.theme = t; } catch {}</script>
</head>
<body${bodyAttrs ? ' ' + bodyAttrs : ''}>
<header data-site="${siteKey}"></header>

<main ${mainAttrs}>
${mainHtml}
</main>

<footer data-site></footer>

${js}
</body>
</html>
`;
}
