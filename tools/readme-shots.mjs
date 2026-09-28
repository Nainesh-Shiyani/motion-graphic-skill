// Captures the README screenshots (docs/*.jpg) from the demo pages with headless Chrome/Edge.
// Needs the dev server: node tools/serve.mjs 5178   then: node tools/readme-shots.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from '../tests/lib/browser.mjs';
import { inlineHtml } from '../skills/web-motion-graphics/scripts/motion-kit.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = path.join(ROOT, 'docs');
const BASE = process.env.BASE || 'http://localhost:5178';
fs.mkdirSync(DOCS, { recursive: true });

// gallery of every background, served from tests/.tmp
const types = ['fluid', 'orb', 'globe', 'galaxy', 'blobs', 'beams', 'tunnel', 'liquid', 'warp', 'flow', 'particles', 'aurora',
  'stars', 'grid', 'matrix', 'bokeh', 'waves', 'dots', 'snow', 'gradient'];
const gallery = `<!doctype html><html><head><meta charset="utf-8"><title>Motion Kit backgrounds</title><style>
:root{--mk-c1:#7c5cff;--mk-c2:#22d3ee;--mk-c3:#ff4fd8}body{margin:0;background:#07070c;color:#fff;font:600 15px system-ui}
.g{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;padding:10px}.c{height:210px;border-radius:14px;background:#0d0d16;display:flex;align-items:flex-end;padding:12px;overflow:hidden}
.c span{background:rgba(0,0,0,.45);padding:3px 9px;border-radius:99px;font:600 13px ui-monospace,monospace}
@media (prefers-reduced-motion: reduce){}</style></head><body><div class="g">${types.map((t) => `<div class="c" data-bg="${t}"><span>data-bg="${t}"</span></div>`).join('')}</div></body></html>`;
fs.mkdirSync(path.join(ROOT, 'tests', '.tmp', 'gallery'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'tests', '.tmp', 'gallery', 'index.html'), inlineHtml(gallery).html);

const page = await launch({ width: 1280, height: 800 });
async function shoot(url, file, { scrollTo = null, wait = 2600, height = 800, before = null } = {}) {
  await page.viewport(1280, height);
  await page.goto(url);
  await page.wait(wait);
  if (scrollTo) {
    await page.eval(`(async () => { const el = document.querySelector(${JSON.stringify(scrollTo)});
      const y = el.getBoundingClientRect().top + scrollY - 40;
      for (let k = 1; k <= 20; k++) { scrollTo(0, scrollY + (y - scrollY) * k / 20); await new Promise(r => requestAnimationFrame(r)); } })()`);
    await page.wait(1800);
  }
  if (before) await page.eval(before);
  await page.wait(400);
  await page.screenshot(path.join(DOCS, file), { jpeg: true });
  console.log('wrote docs/' + file);
}
try {
  // pointer moves feed the fluid + particle text in the hero so the screenshot shows them alive
  const stir = `(async () => { for (let i = 0; i < 90; i++) { const a = i / 90 * Math.PI * 4;
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 640 + Math.cos(a) * 420, clientY: 520 + Math.sin(a * 1.3) * 180, pointerType: 'mouse', bubbles: true }));
    await new Promise(r => setTimeout(r, 16)); } })()`;
  await shoot(`${BASE}/examples/wow/`, 'wow-hero.jpg', { wait: 3200, before: stir });
  await shoot(`${BASE}/examples/wow/`, 'wow-orb.jpg', { scrollTo: '#orb' });
  await shoot(`${BASE}/examples/wow/`, 'wow-globe.jpg', { scrollTo: '#globe', wait: 3000 });
  await shoot(`${BASE}/examples/wow/`, 'wow-stack.jpg', { scrollTo: '.stack-sec [data-stack] article:nth-child(2)' });
  await shoot(`${BASE}/examples/wow/`, 'wow-tunnel.jpg', { scrollTo: '.cta' });
  await shoot(`${BASE}/examples/showcase/`, 'showcase-hero.jpg', { wait: 3200 });
  await shoot(`${BASE}/examples/showcase/`, 'showcase-cards.jpg', { scrollTo: '#features' });
  await shoot(`${BASE}/tests/.tmp/gallery/`, 'backgrounds.jpg', { height: 920, wait: 3000 });
} finally {
  await page.close();
}
