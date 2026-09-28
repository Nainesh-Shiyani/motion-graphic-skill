// Builds everything shipped inside the skill:
//   assets/min/**      esbuild-minified copy of every module (used by the CLI for small inline bundles)
//   assets/dist/*      prebuilt full bundles: motion-kit.{js,css} (readable) + motion-kit.min.{js,css}
// Usage: node tools/build.mjs          (needs the esbuild dev dependency: npm install)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = path.join(ROOT, 'skills', 'web-motion-graphics', 'assets');
const SRC = path.join(ASSETS, 'src');
const MIN = path.join(ASSETS, 'min');
export const DIST = path.join(ASSETS, 'dist');

async function minifyModules() {
  let esbuild;
  try { esbuild = await import('esbuild'); } catch (e) {
    console.warn('esbuild not installed (npm install) - keeping existing assets/min');
    return false;
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8'));
  fs.rmSync(MIN, { recursive: true, force: true });
  for (const m of manifest.modules) {
    for (const kind of ['js', 'css']) {
      if (!m[kind]) continue;
      const code = fs.readFileSync(path.join(SRC, m[kind]), 'utf8');
      const out = esbuild.transformSync(code, kind === 'js'
        ? { loader: 'js', minify: true, target: 'es2018', legalComments: 'none' }
        : { loader: 'css', minify: true, legalComments: 'none' });
      const dest = path.join(MIN, m[kind]);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, out.code);
    }
  }
  return true;
}

export async function buildDist() {
  await minifyModules();
  // import after minifying so the CLI sees fresh files
  const { build } = await import('../skills/web-motion-graphics/scripts/motion-kit.mjs');
  fs.mkdirSync(DIST, { recursive: true });
  const full = build(['all'], { min: false });
  const min = build(['all'], { min: true });
  fs.writeFileSync(path.join(DIST, 'motion-kit.css'), full.css);
  fs.writeFileSync(path.join(DIST, 'motion-kit.js'), full.js);
  fs.writeFileSync(path.join(DIST, 'motion-kit.min.css'), min.css);
  fs.writeFileSync(path.join(DIST, 'motion-kit.min.js'), min.js);
  return { js: full.js.length, css: full.css.length, minJs: min.js.length, minCss: min.css.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const s = await buildDist();
  const kb = (n) => (n / 1024).toFixed(1) + ' KB';
  console.log(`dist: motion-kit.js ${kb(s.js)} + .css ${kb(s.css)} | min: ${kb(s.minJs)} + ${kb(s.minCss)}`);
}
