import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { convert, project, rasterise } from '../scripts/city/convert.js';

const config = JSON.parse(
  readFileSync(new URL('../scripts/city/chicago.config.json', import.meta.url), 'utf8'),
);

describe('chicago.config.json', () => {
  it('has the required keys', () => {
    for (const k of ['id', 'name', 'bbox', 'cellM', 'pickup', 'dropoff', 'landmarks', 'lightPeriod']) {
      expect(config).toHaveProperty(k);
    }
    expect(typeof config.cellM).toBe('number');
    expect(typeof config.lightPeriod).toBe('number');
    expect(Array.isArray(config.landmarks)).toBe(true);
    for (const p of [config.pickup, config.dropoff]) {
      expect(typeof p.lat).toBe('number');
      expect(typeof p.lon).toBe('number');
    }
  });

  it('has a valid bbox [south, west, north, east]', () => {
    const [south, west, north, east] = config.bbox;
    expect(south).toBeLessThan(north);
    expect(west).toBeLessThan(east);
  });

  it('keeps pickup and dropoff inside the bbox', () => {
    const [s, w, n, e] = config.bbox;
    for (const p of [config.pickup, config.dropoff]) {
      expect(p.lat).toBeGreaterThan(s);
      expect(p.lat).toBeLessThan(n);
      expect(p.lon).toBeGreaterThan(w);
      expect(p.lon).toBeLessThan(e);
    }
  });
});

// ---------------------------------------------------------------------------
// Converter, tested on tests/fixtures/city-mini.osm.json. The fixture is a 20 x 20
// grid of 12 m cells (about 239 m square); coordinates below are metres east/north
// of its south-west corner. Cell (col, row) has its centre at x = (col + 0.5) * 12,
// y = (19 - row + 0.5) * 12 (row 0 is the north edge).
//   road A  primary, two-way, east-west at y 66 (row 14)
//   road B  secondary, two-way, north-south at x 150 (col 12)
//   road C  one-way east, east-west at y 186 (row 4)
//   road D  oneway=-1 (way drawn south to north), north-south at x 54 (col 4)
//   road E  service, north-south at x 18 (col 1), y 150 up
//   park x 100..200, y 100..140; footway y 126 x 100..140; lake x 0..40, y 200..240
//   fence x 222, y 40..90; building b1 (height 30) over (12, 9), on road B inside the park
// ---------------------------------------------------------------------------
const BBOX = [41.88, -87.63, 41.88215, -87.62711];
const osm = JSON.parse(
  readFileSync(new URL('./fixtures/city-mini.osm.json', import.meta.url), 'utf8'),
);
const M_PER_DEG = (6371000 * Math.PI) / 180;
const unproject = (x, y) => ({
  lat: BBOX[0] + y / M_PER_DEG,
  lon: BBOX[1] + x / (M_PER_DEG * Math.cos((((BBOX[0] + BBOX[2]) / 2) * Math.PI) / 180)),
});
const miniConfig = (over = {}) => ({
  id: 'mini',
  name: 'Mini',
  bbox: BBOX,
  cellM: 12,
  pickup: unproject(30, 66), // (2, 14) on road A
  dropoff: unproject(150, 222), // (12, 1) on road B
  landmarks: ['Test Sculpture', 'Far Away', 'Not In The Data'],
  lightPeriod: 8,
  ...over,
});
const kindAt = (city, c, r) => city.kind[r][c];
const buildingAt = (city, x, y) =>
  city.buildings.find((b) => {
    const xs = b.ring.map((p) => p[0]);
    const ys = b.ring.map((p) => p[1]);
    return x >= Math.min(...xs) && x <= Math.max(...xs) && y >= Math.min(...ys) && y <= Math.max(...ys);
  });

describe('project', () => {
  it('puts the south-west corner at the origin and the north-east at the size', () => {
    const [s, w, n, e] = BBOX;
    expect(project(s, w, BBOX)).toEqual([0, 0]);
    const [x, y] = project(n, e, BBOX);
    expect(x).toBeCloseTo(239.3, 0);
    expect(y).toBeCloseTo(239.1, 0);
  });

  it('rounds to 0.1 m', () => {
    const [x, y] = project(41.8811111, -87.6288888, BBOX);
    expect(x).toBe(Math.round(x * 10) / 10);
    expect(y).toBe(Math.round(y * 10) / 10);
  });
});

describe('rasterise', () => {
  it('samples cell centres and paints in priority order', () => {
    const roadOnly = rasterise({ roads: [{ pts: [[0, 6], [36, 6]], w: 8 }] }, 3, 3, 12);
    expect(roadOnly).toEqual(['fff', 'fff', 'rrr']); // row 2 is the southernmost
    const square = [[0, 0], [34, 0], [34, 34], [0, 34], [0, 0]];
    const kind = rasterise(
      { parks: [square], roads: [{ pts: [[0, 6], [36, 6]], w: 8 }], buildings: [square] },
      3, 3, 12,
    );
    expect(kind).toEqual(['bbb', 'bbb', 'bbb']);
  });
});

describe('convert', () => {
  const city = convert(osm, miniConfig());

  it('is deterministic, with keys in a fixed order', () => {
    const again = convert(osm, miniConfig());
    expect(JSON.stringify(again)).toBe(JSON.stringify(city));
    expect(Object.keys(city)).toEqual([
      'id', 'name', 'bbox', 'cellM', 'cols', 'rows', 'kind', 'oneway', 'signals', 'pickup',
      'dropoff', 'buildings', 'roads', 'parks', 'paths', 'water', 'landmarks', 'size',
    ]);
  });

  it('sizes the grid from the bbox, one string of cols chars per row', () => {
    expect(city.cols).toBe(20);
    expect(city.rows).toBe(20);
    expect(city.kind).toHaveLength(20);
    expect(city.oneway).toHaveLength(20);
    for (const row of [...city.kind, ...city.oneway]) expect(row).toHaveLength(20);
    expect(city.size[0]).toBeCloseTo(239.3, 0);
    expect(city.size[1]).toBeCloseTo(239.1, 0);
  });

  it('tags roads, footpaths, parks, buildings, water and fences', () => {
    expect(kindAt(city, 8, 14)).toBe('r'); // road A
    expect(kindAt(city, 9, 10)).toBe('p'); // park only
    expect(kindAt(city, 9, 9)).toBe('f'); // footway
    expect(kindAt(city, 6, 17)).toBe('b'); // building b3
    expect(kindAt(city, 0, 0)).toBe('w'); // lake
    expect(kindAt(city, 18, 14)).toBe('x'); // fence
    expect(new Set(city.kind.join(''))).toEqual(new Set(['r', 'f', 'p', 'b', 'w', 'x']));
  });

  it('building beats road beats park in a shared cell', () => {
    expect(kindAt(city, 12, 9)).toBe('b'); // building + road + park
    expect(kindAt(city, 12, 10)).toBe('r'); // road + park
  });

  it('water beats road, fence beats road, footpath beats park', () => {
    expect(kindAt(city, 1, 1)).toBe('w'); // road E runs into the lake
    expect(kindAt(city, 1, 5)).toBe('r');
    expect(kindAt(city, 18, 14)).toBe('x'); // road A crosses the fence
    expect(kindAt(city, 17, 14)).toBe('r');
    expect(kindAt(city, 10, 9)).toBe('f'); // footway over the park
  });

  it('gives buildings a height: height tag, else levels * 3.5, else 12 m', () => {
    expect(buildingAt(city, 150, 126).h).toBe(30);
    expect(buildingAt(city, 215, 170).h).toBe(14); // 4 levels
    expect(buildingAt(city, 80, 30).h).toBe(12); // neither tag
  });

  it('closes unclosed rings and turns multipolygon outer rings into buildings', () => {
    for (const ring of [...city.buildings.map((b) => b.ring), ...city.parks, ...city.water]) {
      expect(ring[0]).toEqual(ring[ring.length - 1]);
    }
    const unclosed = buildingAt(city, 175, 30);
    expect(unclosed.ring).toHaveLength(5);
    const multi = buildingAt(city, 112, 207);
    expect(multi.h).toBe(12);
    expect(city.buildings).toHaveLength(5); // the inner ring is not a building
  });

  it('keeps roads and footpaths as vector geometry', () => {
    expect(city.roads).toHaveLength(5); // the highway=proposed way is ignored
    expect(city.roads.map((r) => r.oneway).sort()).toEqual([-1, 0, 0, 0, 1]);
    expect(city.paths).toHaveLength(1);
    expect(city.parks).toHaveLength(1);
    expect(city.water).toHaveLength(1);
  });

  it('one-way road cells carry their direction, including oneway=-1 reversed', () => {
    expect(city.oneway[4][8]).toBe('E'); // road C, oneway=yes drawn west to east
    expect(city.oneway[9][4]).toBe('S'); // road D, oneway=-1 drawn south to north
    expect(city.oneway[14][8]).toBe('.'); // two-way road A
  });

  it('oneway is "." on every non-road cell', () => {
    for (let r = 0; r < city.rows; r++) {
      for (let c = 0; c < city.cols; c++) {
        if (city.kind[r][c] !== 'r') expect(city.oneway[r][c]).toBe('.');
      }
    }
  });

  it('traffic signals snap to the nearest road cell', () => {
    // one signal sits off the roads at (180, 100), the other already on road B
    expect(city.signals).toEqual([[12, 11], [12, 14]]);
    for (const [c, r] of city.signals) expect(kindAt(city, c, r)).toBe('r');
  });

  it('pickup and dropoff cells are road cells', () => {
    expect(city.pickup).toEqual([2, 14]);
    expect(city.dropoff).toEqual([12, 1]);
    expect(kindAt(city, ...city.pickup)).toBe('r');
    expect(kindAt(city, ...city.dropoff)).toBe('r');
  });

  it('throws a clear error when pickup or dropoff is not on a road', () => {
    expect(() => convert(osm, miniConfig({ pickup: unproject(150, 126) }))).toThrow(/pickup.*road/i);
    expect(() => convert(osm, miniConfig({ dropoff: unproject(80, 30) }))).toThrow(/dropoff.*road/i);
    expect(() => convert(osm, miniConfig({ pickup: { lat: 0, lon: 0 } }))).toThrow(/pickup/i);
  });

  it('keeps only landmarks named in the config and inside the bbox', () => {
    expect(city.landmarks).toHaveLength(1); // Far Away is outside, the third name is not in the data
    const [l] = city.landmarks;
    expect(l.name).toBe('Test Sculpture');
    expect(l.x).toBeCloseTo(30, 0);
    expect(l.y).toBeCloseTo(100, 0);
  });

  it('the road network is connected from pickup to dropoff through road cells only', () => {
    const seen = new Set([city.pickup.join(',')]);
    const queue = [city.pickup];
    while (queue.length) {
      const [c, r] = queue.shift();
      for (const [dc, dr] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const [nc, nr] = [c + dc, r + dr];
        const key = `${nc},${nr}`;
        if (city.kind[nr]?.[nc] === 'r' && !seen.has(key)) {
          seen.add(key);
          queue.push([nc, nr]);
        }
      }
    }
    expect(seen.has(city.dropoff.join(','))).toBe(true);
  });
});

describe('committed chicago.json', () => {
  const file = new URL('../games/city/chicago.json', import.meta.url);
  // Skipped (not failed) until RC0.5 generates games/city/chicago.json.
  it.skipIf(!existsSync(file))(
    'chicago.json is under 300 KB and parses (skipped until RC0.5 generates it)',
    () => {
      expect(statSync(file).size).toBeLessThan(300 * 1024);
      const city = JSON.parse(readFileSync(file, 'utf8'));
      expect(city.kind).toHaveLength(city.rows);
    },
  );
});
