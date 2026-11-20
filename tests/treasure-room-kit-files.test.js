import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const MODEL_FILES_EXPECTED = ['floor_tile_large', 'floor_tile_large_rocks', 'floor_tile_big_spikes', 'wall', 'wall_corner', 'chest_gold', 'coin_stack_medium', 'torch_lit'];
const kitSource = read('games/treasure-room/room-kit.js');

describe('the model kit', () => {
  it('ships eight real glb files under 600 KB in all', () => {
    expect(MODEL_FILES_EXPECTED).toHaveLength(8);
    let total = 0;
    for (const n of MODEL_FILES_EXPECTED) {
      const p = `../games/treasure-room/models/${n}.glb`;
      expect(readFileSync(new URL(p, import.meta.url)).subarray(0, 4).toString(), n).toBe('glTF');
      total += statSync(new URL(p, import.meta.url)).size;
    }
    expect(total).toBeLessThan(600 * 1024);
  });
  it('ships its CC0 licence beside the models', () => {
    expect(read('games/treasure-room/models/LICENSE-kaykit.txt')).toMatch(/CC0|Creative Commons/i);
  });
  it('loads relative to the module, from the local files only', () => {
    expect(kitSource).toMatch(/new URL\('\.\/models\/', import\.meta\.url\)/);
    expect(kitSource).not.toMatch(/https?:/);
  });
  it('MODEL_FILES is the one list of those eight', () => {
    const names = kitSource.match(/MODEL_FILES\s*=\s*\[([^\]]+)\]/)[1].match(/'[^']+'/g).map(s => s.slice(1, -1));
    expect([...names].sort()).toEqual([...MODEL_FILES_EXPECTED].sort());
  });
});
