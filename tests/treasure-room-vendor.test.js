import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { IMPORT_MAP_HTML } from '../assets/tracks/shell.js';
import { buildPages } from '../assets/tracks/build.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const exists = p => existsSync(new URL('../' + p, import.meta.url));
const CITY_FILES = ['facade.js', 'glow.js', 'scene-furniture.js', 'scene-highlights.js', 'scene-look.js', 'scene-people.js', 'scene-taxi.js', 'scene-traffic.js', 'scene.js'];
const LOADERS = ['assets/vendor/three/loaders/GLTFLoader.js', 'assets/vendor/three/utils/BufferGeometryUtils.js', 'assets/vendor/three/controls/OrbitControls.js'];
const files = { read: p => (exists(p) ? read(p) : null), exists };

describe('shared three.js folder', () => {
  it('holds three and the loaders; the city folder no longer has a vendor', () => {
    for (const f of ['three.module.min.js', 'LICENSE-three.txt', 'loaders/GLTFLoader.js', 'utils/BufferGeometryUtils.js', 'controls/OrbitControls.js']) expect(exists('assets/vendor/three/' + f), f).toBe(true);
    expect(exists('games/city/vendor')).toBe(false);
    expect(read('assets/vendor/three/LICENSE-three.txt')).toMatch(/MIT/);
  });
  it('city files import it by path', () => {
    for (const f of CITY_FILES) {
      expect(read('games/city/' + f), f).toContain("from '../../assets/vendor/three/three.module.min.js'");
      expect(read('games/city/' + f), f).not.toContain('./vendor/');
    }
  });
  it('the loaders import only the bare specifier the map covers', () => {
    const bare = src => [...src.matchAll(/^[^/\n]*\bfrom\s+'([^./][^']*)'/gm)].map(m => m[1]);
    for (const f of LOADERS) expect([...new Set(bare(read(f)))], f).toEqual(['three']);
  });
});

describe('import map', () => {
  it('points three at the shared file', () => {
    expect(JSON.parse(IMPORT_MAP_HTML.match(/>(.*)</)[1]).imports.three).toBe('/assets/vendor/three/three.module.min.js');
  });
  it('is in the game page before any module script', () => {
    const html = read('games/treasure-room/index.html');
    expect(html).toContain(IMPORT_MAP_HTML);
    expect(html.indexOf('importmap')).toBeLessThan(html.indexOf('type="module"'));
  });
  it('is on the seven level lesson pages and not on a whole-game one', () => {
    const out = buildPages({ files });
    for (const id of ['learning-by-reward', 'loop', 'state', 'return', 'policy', 'value', 'mdp']) expect(out[`concepts/${id}/index.html`], id).toContain(IMPORT_MAP_HTML);
    expect(out['concepts/pid/index.html']).not.toContain('importmap');
  });
});
