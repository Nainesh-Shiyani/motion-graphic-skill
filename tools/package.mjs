// Packages skills/web-motion-graphics into dist/web-motion-graphics.zip - the file you upload to
// Claude.ai (Settings > Capabilities > Skills) or ChatGPT (Skills > Upload). The zip contains the skill folder
// at its root, is deflate-compressed and byte-for-byte reproducible (fixed timestamps, sorted entries).
// Usage: node tools/package.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NAME = 'web-motion-graphics';
const SKILL = path.join(ROOT, 'skills', NAME);
export const ZIP = path.join(ROOT, 'dist', NAME + '.zip');

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  if (zlib.crc32) return zlib.crc32(buf) >>> 0;
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function walk(dir, rel = '') {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (e.name === '.DS_Store' || e.name === 'Thumbs.db') continue;
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) { out.push({ name: r + '/', dir: true }); out.push(...walk(path.join(dir, e.name), r)); }
    else out.push({ name: r, file: path.join(dir, e.name) });
  }
  return out;
}

export function packageSkill() {
  // DOS time/date for 2026-01-01 00:00:00 (reproducible)
  const dosTime = 0, dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;
  const entries = [{ name: NAME + '/', dir: true }, ...walk(SKILL).map((e) => ({ ...e, name: NAME + '/' + e.name }))];
  const locals = [], centrals = [];
  let offset = 0;
  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, 'utf8');
    const raw = e.dir ? Buffer.alloc(0) : fs.readFileSync(e.file);
    const data = e.dir ? raw : zlib.deflateRawSync(raw, { level: 9 });
    const method = e.dir ? 0 : 8;
    const crc = e.dir ? 0 : crc32(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE((3 << 8) | 20, 4); // made by: unix, v2.0
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(e.dir ? ((0o40755 << 16) | 0x10) >>> 0 : (0o100644 << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  fs.mkdirSync(path.dirname(ZIP), { recursive: true });
  fs.writeFileSync(ZIP, Buffer.concat([...locals, cd, end]));
  return { zip: ZIP, entries: entries.length, bytes: fs.statSync(ZIP).size };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = packageSkill();
  console.log(`wrote ${path.relative(ROOT, r.zip)} (${r.entries} entries, ${(r.bytes / 1024).toFixed(1)} KB)`);
}
