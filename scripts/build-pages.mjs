// npm run pages: write the generated pages. With --check, write nothing and exit 1 if any file differs.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPages } from '../assets/tracks/build.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const check = process.argv.includes('--check');
const files = {
  read: p => (existsSync(root + p) ? readFileSync(root + p, 'utf8') : null),
  exists: p => existsSync(root + p),
};

const pages = buildPages({ files });
const differs = [];
for (const [path, html] of Object.entries(pages)) {
  const current = files.read(path)?.replace(/\r\n/g, '\n') ?? null;
  if (current === html) continue;
  differs.push(path);
  if (!check) {
    mkdirSync(dirname(root + path), { recursive: true });
    writeFileSync(root + path, html, 'utf8');
  }
}

if (check && differs.length) {
  console.error('Out of date (run npm run pages):\n' + differs.join('\n'));
  process.exit(1);
}
console.log(check ? 'Generated pages are up to date.' : `Wrote ${differs.length} page(s), ${Object.keys(pages).length - differs.length} unchanged.`);
