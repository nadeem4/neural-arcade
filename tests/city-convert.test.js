import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { convert, project, rasterise, estimateHeight, solidTrees } from '../scripts/city/convert.js';

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
const ringAreaOf = (b) =>
  Math.abs(b.ring.reduce((s, p, i) => s + p[0] * b.ring[(i + 1) % b.ring.length][1] - b.ring[(i + 1) % b.ring.length][0] * p[1], 0)) / 2;
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

describe('rasterise bridges and rail', () => {
  // 5 x 3 grid, cellM 12: row 1 is y 12..24, centre y 18. A fence runs north to south through column 2 (x 30).
  const fence = [{ pts: [[30, 0], [30, 36]] }];
  const road = [[0, 18], [60, 18]];
  it('a plain road is cut by a fence, a bridge road is not', () => {
    expect(rasterise({ roads: [{ pts: road, w: 8 }], fences: fence }, 5, 3, 12)[1]).toBe('rrxrr');
    expect(rasterise({ roads: [{ pts: road, w: 8, bridge: true }], fences: fence }, 5, 3, 12)[1]).toBe('rrrrr');
  });
  it('a bridge road wins over water and rail below it, but not over a building', () => {
    const lake = [[24, 0], [36, 0], [36, 36], [24, 36], [24, 0]];
    const rail = [{ pts: [[30, 0], [30, 36]] }];
    expect(rasterise({ roads: [{ pts: road, w: 8, bridge: true }], water: [lake], rail }, 5, 3, 12)[1]).toBe('rrrrr');
    expect(rasterise({ roads: [{ pts: road, w: 8, bridge: true }], buildings: [lake] }, 5, 3, 12)[1]).toBe('rrbrr');
  });
  it('railway on the ground or in a cut is solid, a plain road over it too, a bridge road is not', () => {
    const rail = [{ pts: [[30, 0], [30, 36]] }];
    expect(rasterise({ rail }, 5, 3, 12).map((r) => r[2])).toEqual(['x', 'x', 'x']);
    expect(rasterise({ roads: [{ pts: road, w: 8 }], rail }, 5, 3, 12)[1]).toBe('rrxrr');
    expect(rasterise({ roads: [{ pts: road, w: 8, bridge: true }], rail }, 5, 3, 12)[1]).toBe('rrrrr');
  });
});

describe('rasterise footbridges', () => {
  const rail = [{ pts: [[30, 0], [30, 36]] }];
  const walk = [[0, 18], [60, 18]];
  it('a footpath over rail stays open when it is a bridge, and is cut when it is not', () => {
    expect(rasterise({ paths: [{ pts: walk, w: 2 }], rail }, 5, 3, 12)[1]).toBe('ffxff');
    expect(rasterise({ paths: [{ pts: walk, w: 2, bridge: true }], rail }, 5, 3, 12)[1]).toBe('fffff');
  });
  it('a footbridge is still stopped by a building', () => {
    const b = [[24, 0], [36, 0], [36, 36], [24, 36], [24, 0]];
    expect(rasterise({ paths: [{ pts: walk, w: 2, bridge: true }], buildings: [b] }, 5, 3, 12)[1]).toBe('ffbff');
  });
});

describe('rasterise footbridges over roads', () => {
  it('a footbridge over a street leaves the street road', () => {
    const road = { pts: [[0, 18], [60, 18]], w: 8 };
    const walk = { pts: [[30, 0], [30, 36]], w: 2, bridge: true };
    const kind = rasterise({ roads: [road], paths: [walk] }, 5, 3, 12);
    expect(kind[1]).toBe('rrrrr');
    expect(kind[0][2]).toBe('f');
  });
});

describe('convert link roads', () => {
  // Road B is two-way, north to south at x 150 (col 12). A one-way slip road runs beside it, then on its own.
  const way = (id, tags, pts) => ({ type: 'way', id, tags, geometry: pts.map(([x, y]) => unproject(x, y)) });
  const link = way(9301, { highway: 'secondary_link', oneway: 'yes' }, [[152, 20], [152, 60]]);
  const alone = way(9302, { highway: 'secondary_link', oneway: 'yes' }, [[198, 200], [198, 230]]);
  const city = convert({ elements: [...osm.elements, link, alone] }, miniConfig());
  const rowOf = (y) => city.rows - 1 - Math.floor(y / 12);
  it('a one-way link does not give a two-way road a direction', () => {
    for (const y of [30, 42, 54]) expect(city.oneway[rowOf(y)][12]).toBe('.');
  });
  it('a one-way link on its own keeps its direction', () => {
    expect(city.oneway[rowOf(210)][16]).toBe('N');
  });
});

describe('rasterise cuts', () => {
  it('a cut is solid even over a bridge road, so levels OSM does not join stay apart', () => {
    const road = { pts: [[0, 18], [60, 18]], w: 8, bridge: true };
    expect(rasterise({ roads: [road], cuts: [{ pts: [[30, 0], [30, 36]] }] }, 5, 3, 12)[1]).toBe('rrxrr');
  });
});

describe('convert cuts', () => {
  const way = (id, tags, pts) => ({ type: 'way', id, tags, geometry: pts.map(([x, y]) => unproject(x, y)) });
  const road = way(9201, { highway: 'secondary' }, [[0, 112], [130, 112]]);
  const cfg = miniConfig({ cuts: [{ from: unproject(78, 100), to: unproject(78, 124) }] });
  const city = convert({ elements: [...osm.elements, road] }, cfg);
  it('config cuts become solid cells', () => {
    const row = city.rows - 1 - Math.floor(112 / 12);
    expect(kindAt(city, 6, row)).toBe('x');
    expect(kindAt(city, 3, row)).toBe('r');
  });
});

describe('convert footbridges', () => {
  const way = (id, tags, pts) => ({ type: 'way', id, tags, geometry: pts.map(([x, y]) => unproject(x, y)) });
  const extra = [
    way(9101, { railway: 'rail' }, [[102, 90], [102, 160]]),
    way(9102, { highway: 'footway', bridge: 'yes' }, [[60, 112], [130, 112]]),
    way(9103, { highway: 'footway', layer: '1' }, [[60, 136], [130, 136]]),
    way(9104, { highway: 'footway' }, [[60, 124], [130, 124]]),
  ];
  const city = convert({ elements: [...osm.elements, ...extra] }, miniConfig());
  const rowOf = (y) => city.rows - 1 - Math.floor(y / 12);
  it('footbridges (bridge tag or layer 1) stay open over the rail; a ground footpath is cut', () => {
    expect(kindAt(city, 8, rowOf(112))).toBe('f');
    expect(kindAt(city, 8, rowOf(136))).toBe('f');
    expect(kindAt(city, 8, rowOf(124))).toBe('x');
  });
});

describe('convert bridges, tunnels and the rail cut', () => {
  // Own tiny map: a fence and a railway run north to south at x 78 and x 102; roads cross east to west.
  const way = (id, tags, pts) => ({ type: 'way', id, tags, geometry: pts.map(([x, y]) => unproject(x, y)) });
  const extra = [
    way(9001, { barrier: 'fence' }, [[78, 90], [78, 160]]),
    way(9002, { railway: 'rail' }, [[102, 90], [102, 160]]),
    way(9003, { highway: 'secondary', bridge: 'yes', layer: '1' }, [[60, 112], [130, 112]]), // over both
    way(9004, { highway: 'secondary' }, [[60, 124], [130, 124]]), // plain road, level with both
    way(9005, { highway: 'secondary', layer: '1' }, [[60, 136], [130, 136]]), // layer 1 alone is a bridge
    way(9006, { highway: 'secondary', tunnel: 'yes', layer: '-1' }, [[60, 148], [130, 148]]), // underneath
  ];
  const city = convert({ elements: [...osm.elements, ...extra] }, miniConfig());
  const rowOf = (y) => city.rows - 1 - Math.floor(y / 12);
  it('a bridge road stays road over a fence and a railway; a plain road is cut by them', () => {
    for (const x of [78, 102]) expect(kindAt(city, Math.floor(x / 12), rowOf(112))).toBe('r');
    expect(kindAt(city, 6, rowOf(124))).toBe('x');
    expect(kindAt(city, 8, rowOf(124))).toBe('x');
    expect(kindAt(city, 6, rowOf(136))).toBe('r'); // layer >= 1 counts as a bridge
  });
  it('a tunnel road paints nothing: the fence above it stays solid', () => {
    expect(kindAt(city, 6, rowOf(148))).toBe('x');
  });
  it('the railway cells away from any bridge are solid, whatever they were before', () => {
    expect(kindAt(city, 8, rowOf(96))).toBe('x');
  });
});

describe('convert', () => {
  const city = convert(osm, miniConfig());

  it('is deterministic, with keys in a fixed order', () => {
    const again = convert(osm, miniConfig());
    expect(JSON.stringify(again)).toBe(JSON.stringify(city));
    expect(Object.keys(city)).toEqual([
      'id', 'name', 'bbox', 'cellM', 'lightPeriod', 'cols', 'rows', 'kind', 'oneway', 'signals', 'pickup',
      'dropoff', 'buildings', 'roads', 'sidewalks', 'crossings', 'signalHeads', 'lamps', 'trees', 'rail',
      'parks', 'paths', 'water', 'landmarks', 'size',
    ]);
  });

  it('carries the config light period into the city', () => {
    expect(city.lightPeriod).toBe(8);
    expect(convert(osm, miniConfig({ lightPeriod: 6 })).lightPeriod).toBe(6);
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

  it('estimates height from height, levels, then footprint', () => {
    expect(estimateHeight({ height: '30' }, 100)).toBe(30);
    expect(estimateHeight({ height: '12.5 m' }, 100)).toBe(12.5);
    expect(estimateHeight({ 'building:levels': '4' }, 5000)).toBe(14);
    expect(estimateHeight({}, 100)).toBe(12);
    expect(estimateHeight({}, 800)).toBe(20);
    expect(estimateHeight({}, 5000)).toBe(32);
    expect(buildingAt(city, 150, 126).h).toBe(30);
    expect(buildingAt(city, 215, 170).h).toBe(14); // 4 levels
    expect(buildingAt(city, 80, 30).h).toBe(estimateHeight({}, ringAreaOf(buildingAt(city, 80, 30))));
  });

  it('reads heights in feet as metres', () => {
    expect(estimateHeight({ height: '120 ft' }, 100)).toBe(36.6);
    expect(estimateHeight({ height: "120'" }, 100)).toBe(36.6);
    expect(estimateHeight({ height: "10'6\"" }, 100)).toBe(3.2);
    expect(estimateHeight({ height: '12.5 m' }, 100)).toBe(12.5);
  });

  it('keeps building tags and marks parts', () => {
    const b2 = buildingAt(city, 215, 170);
    expect(b2).toMatchObject({ levels: 4, roof: 'gabled', part: false, minH: 0, colour: null, material: null });
    expect(Object.keys(b2)).toEqual(['ring', 'h', 'minH', 'levels', 'part', 'hasParts', 'roof', 'colour', 'material']);
    const part = city.buildings.find((b) => b.part);
    expect(part).toMatchObject({
      h: 20, minH: 10, levels: null, part: true, roof: 'hipped', colour: '#aa5533', material: 'brick',
    });
    expect(city.buildings.filter((b) => b.part)).toHaveLength(2);
    // a way tagged building and building:part is a part, and feet become metres
    const both = city.buildings.find((b) => b.part && b.h === 36.6);
    expect(both).toMatchObject({ part: true, hasParts: false });
    expect(buildingAt(city, 80, 30)).toMatchObject({ roof: 'flat', part: false });
  });

  it('marks outlines that contain a part, and only those', () => {
    expect(buildingAt(city, 150, 126).hasParts).toBe(true); // b1 holds the hipped part
    expect(buildingAt(city, 215, 170).hasParts).toBe(false);
    expect(buildingAt(city, 80, 30).hasParts).toBe(false);
    expect(city.buildings.filter((b) => b.hasParts)).toHaveLength(1);
  });

  it('a way tagged building and building:part still paints the grid', () => {
    expect(kindAt(city, 12, 6)).toBe('b'); // cell centre (150, 162) is inside the ring at x 149 to 157, y 155 to 167
  });

  it('parts do not change the grid', () => {
    expect(kindAt(city, 12, 9)).toBe('b');
    expect(kindAt(city, 12, 10)).toBe('r');
  });

  it('roads carry lanes class and name', () => {
    const named = city.roads.find((r) => r.name === 'Test Ave');
    expect(named).toMatchObject({ cls: 'primary', lanes: null, w: 14 });
    expect(Object.keys(named)).toEqual(['pts', 'w', 'oneway', 'lanes', 'cls', 'name']);
    const lane = city.roads.find((r) => r.name === 'Back Lane');
    expect(lane).toMatchObject({ cls: 'residential', lanes: 2, w: 7, oneway: -1 });
    expect(city.roads.find((r) => r.cls === 'service')).toMatchObject({ name: null });
  });

  it('emits sidewalks as lines with a width', () => {
    expect(city.sidewalks).toHaveLength(1);
    expect(city.sidewalks[0]).toMatchObject({ w: 2 });
    expect(city.sidewalks[0].pts).toHaveLength(2);
  });

  it('emits crossings from ways and nodes: centre, angle across the road, length', () => {
    expect(city.crossings).toHaveLength(2);
    const [fromWay, fromNode] = city.crossings;
    expect(fromWay.x).toBeCloseTo(100, 0);
    expect(fromWay.y).toBeCloseTo(66, 0);
    expect(fromWay.angle).toBe(0); // runs north-south
    expect(fromWay.w).toBeCloseTo(12, 0);
    expect(fromNode.x).toBeCloseTo(150, 0);
    expect(fromNode.y).toBeCloseTo(40, 0);
    expect(fromNode.angle).toBe(90); // road B runs north-south, so the crossing runs east-west
    expect(fromNode.w).toBe(12);
  });

  it('signal heads carry the bearing of the nearest road', () => {
    expect(city.signalHeads).toHaveLength(2);
    for (const h of city.signalHeads) expect(Object.keys(h)).toEqual(['x', 'y', 'dir']);
    expect(city.signalHeads[0].dir).toBe(0); // off-road signal nearest road B (north-south)
  });

  it('lamps and trees keep only points on the map', () => {
    expect(city.lamps).toEqual([[60, 110]]);
    expect(city.trees).toEqual([[80, 120], [82, 125]]);
  });

  it('rail keeps surface, elevated rail and the elevated subway L, skips tunnels', () => {
    expect(city.rail).toHaveLength(3);
    expect(city.rail[0]).toMatchObject({ h: 8, elevated: true });
    expect(city.rail[0].pts).toHaveLength(3);
    expect(city.rail[1]).toMatchObject({ h: 0, elevated: false });
    expect(city.rail[2]).toMatchObject({ h: 8, elevated: true }); // railway=subway, bridge=yes, layer=2
    expect(Object.keys(city.rail[2])).toEqual(['pts', 'h', 'elevated']);
  });

  it('closes unclosed rings and turns multipolygon outer rings into buildings', () => {
    for (const ring of [...city.buildings.map((b) => b.ring), ...city.parks, ...city.water]) {
      expect(ring[0]).toEqual(ring[ring.length - 1]);
    }
    const unclosed = buildingAt(city, 175, 30);
    expect(unclosed.ring).toHaveLength(5);
    const multi = buildingAt(city, 112, 207);
    expect(multi.h).toBe(estimateHeight({}, ringAreaOf(multi)));
    expect(city.buildings.filter((b) => !b.part)).toHaveLength(5); // the inner ring is not a building
  });

  it('keeps roads and footpaths as vector geometry', () => {
    expect(city.roads).toHaveLength(5); // the highway=proposed way is ignored
    expect(city.roads.map((r) => r.oneway).sort()).toEqual([-1, 0, 0, 0, 1]);
    expect(city.paths).toHaveLength(1);
    expect(city.parks).toHaveLength(1);
    expect(city.water).toHaveLength(1);
  });

  it('ignores tunnels and negative layers: no cells, no emitted roads', () => {
    // fixture: tunnel=yes road at y 230 (row 0, cols 5..11) and a layer=-1 service road at y 210 (row 2, cols 13..19)
    for (let c = 5; c <= 11; c++) expect(kindAt(city, c, 0)).not.toBe('r');
    for (let c = 13; c <= 19; c++) expect(kindAt(city, c, 2)).not.toBe('r');
    expect(city.roads).toHaveLength(5);
  });

  it('thin fences leave a parallel road beside them intact', () => {
    // fixture: fence at y 74, x 70..100, 8 m north of road A (row 14)
    expect(kindAt(city, 6, 13)).toBe('x');
    expect(kindAt(city, 6, 14)).toBe('r');
    expect(kindAt(city, 7, 14)).toBe('r');
  });

  it('sidewalks are rasterised but not emitted as paths', () => {
    // fixture: footway=sidewalk at y 102 over the park, cells (8..9, 11)
    expect(kindAt(city, 9, 11)).toBe('f');
    expect(city.paths).toHaveLength(1);
  });

  it('does not emit parks or paths smaller than one cell (they still shape the grid)', () => {
    // fixture: an 8 m square park and a 6 m footway, both under the 12 m cell
    expect(city.parks).toHaveLength(1);
    expect(city.paths).toHaveLength(1);
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
  it('chicago.json is under 500 KB, parses and keeps the config light period', () => {
    expect(statSync(file).size).toBeLessThan(500 * 1024);
    const city = JSON.parse(readFileSync(file, 'utf8'));
    expect(city.kind).toHaveLength(city.rows);
    expect(city.lightPeriod).toBe(config.lightPeriod);
  });
});

describe('fetch-overpass buildQuery', () => {
  it('asks for building parts, rail, lamps, trees, crossings and sidewalks', async () => {
    const { buildQuery } = await import('../scripts/city/fetch-overpass.mjs');
    const q = buildQuery([1, 2, 3, 4]);
    for (const part of [
      'way["building:part"]', 'way[railway~"^(rail|light_rail|subway)$"]', 'node[highway=street_lamp]', 'node[natural=tree]',
      'node[highway=crossing]', 'way[highway]', // way[highway] already covers sidewalks and crossings
    ]) expect(q).toContain(part);
    expect(q).not.toContain('way[railway]');
    expect(q).not.toContain('way[footway=');
    expect(q).toContain('(1,2,3,4)');
  });
});

describe('solidTrees', () => {
  // 3 x 1 strip, cellM 10, rows 1: cell c has x in [10c, 10c+10], y in [0, 10].
  const trees3 = [[1, 1], [2, 2], [3, 3]];
  it('a cell with 3 trees becomes x, with 2 trees it is unchanged', () => {
    expect(solidTrees(['fpf'], [...trees3, [11, 1], [12, 2]], 3, 1, 10, 3)).toEqual(['xpf']);
  });
  it('road cells never turn solid, and so do buildings and water stay as they are', () => {
    expect(solidTrees(['rbw'], [...trees3, ...trees3.map(([x, y]) => [x + 10, y]), ...trees3.map(([x, y]) => [x + 20, y])], 3, 1, 10, 3)).toEqual(['rbw']);
  });
  it('counts the 3 trees in the cell, not 3 trees in the map', () => {
    expect(solidTrees(['fff'], [[1, 1], [11, 1], [21, 1]], 3, 1, 10, 3)).toEqual(['fff']);
  });
});

describe('the real map', () => {
  const real = JSON.parse(readFileSync(new URL('../games/city/chicago.json', import.meta.url), 'utf8'));
  it('no footpath or park cell holds 3 or more trees, and the trees are all kept', () => {
    const n = new Map();
    for (const [x, y] of real.trees) {
      const k = (real.rows - 1 - Math.floor(y / real.cellM)) * real.cols + Math.floor(x / real.cellM);
      n.set(k, (n.get(k) ?? 0) + 1);
    }
    for (const [k, count] of n) {
      if (count >= 3) expect(['f', 'p']).not.toContain(real.kind[Math.floor(k / real.cols)][k % real.cols]);
    }
    expect(real.trees.length).toBe(4128);
  });
});

describe('the real map: footbridges and slip roads', () => {
  const real = JSON.parse(readFileSync(new URL('../games/city/chicago.json', import.meta.url), 'utf8'));
  it('streets under footbridges stay road (North Wabash, Ida B. Wells)', () => {
    for (let r = 30; r <= 39; r++) expect(real.kind[r][12]).toBe('r');
    expect(real.kind[93][39]).toBe('r');
  });
  it('the Ida B. Wells slip road (OSM way 59667610) leaves two-way Columbus Drive two-way', () => {
    for (const [c, r] of [[51, 91], [50, 92]]) expect(real.oneway[r][c]).toBe('.');
  });
});
