// Generates the land mask used by data-bg="globe": a 180x90 (2 degree) bitmap of Natural Earth 110m land
// (public domain, via the world-atlas package), base64-encoded and written into modules/bg/globe.js.
// Usage: node tools/gen-land.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = path.join(ROOT, 'skills', 'web-motion-graphics', 'assets', 'src', 'modules', 'bg', 'globe.js');
const URL_ = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json';
const W = 180, H = 90;

const topo = await (await fetch(URL_)).json();
const { scale, translate } = topo.transform;
// decode delta-encoded, quantized arcs
const arcs = topo.arcs.map((arc) => {
  let x = 0, y = 0;
  return arc.map(([dx, dy]) => { x += dx; y += dy; return [x * scale[0] + translate[0], y * scale[1] + translate[1]]; });
});
function ring(indices) {
  const pts = [];
  indices.forEach((i, k) => {
    const a = i >= 0 ? arcs[i] : arcs[~i].slice().reverse();
    pts.push(...(k ? a.slice(1) : a));
  });
  return pts;
}
const rings = [];
function addGeom(g) {
  if (g.type === 'Polygon') g.arcs.forEach((r) => rings.push(ring(r)));
  else if (g.type === 'MultiPolygon') g.arcs.forEach((p) => p.forEach((r) => rings.push(ring(r))));
  else if (g.type === 'GeometryCollection') g.geometries.forEach(addGeom);
}
addGeom(topo.objects.land);

function inside(lon, lat) {
  let c = false;
  for (const r of rings) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i], [xj, yj] = r[j];
      if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) c = !c;
    }
  }
  return c;
}

const bytes = new Uint8Array(Math.ceil((W * H) / 8));
let land = 0;
for (let j = 0; j < H; j++) {
  const lat = 90 - (j + 0.5) * (180 / H);
  for (let i = 0; i < W; i++) {
    const lon = -180 + (i + 0.5) * (360 / W);
    if (lat > -60 && inside(lon, lat)) {
      const k = j * W + i;
      bytes[k >> 3] |= 1 << (k & 7);
      land++;
    }
  }
}
const b64 = Buffer.from(bytes).toString('base64');
let src = fs.readFileSync(TARGET, 'utf8');
src = src.replace(/var LAND = '[^']*';/, `var LAND = '${b64}';`);
fs.writeFileSync(TARGET, src);
console.log(`land cells: ${land}/${W * H} (${((land / (W * H)) * 100).toFixed(1)}%), ${b64.length} base64 chars -> ${path.relative(ROOT, TARGET)}`);
// ASCII preview
for (let j = 0; j < H; j += 3) {
  let row = '';
  for (let i = 0; i < W; i += 2) { const k = j * W + i; row += bytes[k >> 3] & (1 << (k & 7)) ? '#' : '.'; }
  console.log(row);
}
