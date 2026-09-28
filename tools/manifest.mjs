// Helpers to edit the Motion Kit manifest while keeping its one-module-per-line layout.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'web-motion-graphics', 'assets', 'src', 'manifest.json');
export function load() { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
export function save(m) {
  const lines = m.modules.map((x) => '    ' + JSON.stringify(x));
  const vals = Object.entries(m.values).map(([k, v]) => '    ' + JSON.stringify(k) + ': ' + JSON.stringify(v));
  fs.writeFileSync(FILE, '{\n  "name": "motion-kit",\n  "version": "' + m.version + '",\n  "modules": [\n' + lines.join(',\n') +
    '\n  ],\n  "values": {\n' + vals.join(',\n') + '\n  }\n}\n');
}
// upsert: replace a module with the same name, or insert after `after`
export function upsert(m, mod, after) {
  const i = m.modules.findIndex((x) => x.name === mod.name);
  if (i >= 0) { m.modules[i] = mod; return; }
  const j = after ? m.modules.findIndex((x) => x.name === after) : -1;
  if (j >= 0) m.modules.splice(j + 1, 0, mod); else m.modules.push(mod);
}
