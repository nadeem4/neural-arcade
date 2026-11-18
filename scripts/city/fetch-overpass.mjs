// Usage: node scripts/city/fetch-overpass.mjs <config.json> <out.json>
// Fetches the raw OpenStreetMap data for the config's bbox from Overpass.
// The export (scripts/city/data/) is over 3 MB, so it is git-ignored; rerun this to recreate it.
// Last fetched 2026-11-18 with the query built by buildQuery() below, for bbox [41.874,-87.628,41.886,-87.617]:
//   buildings and building:part ways, building relations, every highway way (so sidewalks and crossings), parks,
//   water, waterways, fences and walls, grass, area:highway footways, railway ways, and the nodes for traffic
//   signals, street lamps, trees and crossings, plus named artwork, towers and fountains; out geom.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

const SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

export function buildQuery([s, w, n, e]) {
  const b = `${s},${w},${n},${e}`;
  return `[out:json][timeout:90];
(
  way[building](${b});
  way["building:part"](${b});
  relation[building](${b});
  way[highway](${b});
  way[leisure~"^(park|garden|pitch)$"](${b});
  way[natural=water](${b});
  way[waterway](${b});
  way[barrier~"^(fence|wall)$"](${b});
  way[landuse=grass](${b});
  way["area:highway"=footway](${b});
  node[highway=traffic_signals](${b});
  node[highway=street_lamp](${b});
  node[natural=tree](${b});
  node[highway=crossing](${b});
  way[footway=sidewalk](${b});
  way[footway=crossing](${b});
  way[railway](${b});
  nwr[tourism=artwork][name](${b});
  nwr[man_made=tower][name](${b});
  nwr[amenity=fountain](${b});
);
out geom;`;
}

function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]));
  }
  return v;
}

async function post(url, query) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'User-Agent': 'neural-arcade-map-fetch', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(query),
  });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

export async function fetchOverpass(query) {
  let lastErr;
  for (const url of [SERVERS[0], SERVERS[0], SERVERS[1]]) {
    try {
      return await post(url, query);
    } catch (err) {
      lastErr = err;
      console.error(String(err));
    }
  }
  throw lastErr;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [configPath, outPath] = process.argv.slice(2);
  if (!configPath || !outPath) {
    console.error('usage: fetch-overpass.mjs <config> <out>');
    process.exit(1);
  }
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  const data = await fetchOverpass(buildQuery(config.bbox));
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(sortKeys(data), null, 2) + '\n');
  console.error(`wrote ${outPath} (${data.elements.length} elements)`);
}
