// Screenshot a page at several scroll depths + smoke-check it (console errors, hidden content, motion stats).
// Usage: node tests/screens.mjs <file-or-url> <outDir> [--width 1280] [--height 800] [--shots 6] [--reduced] [--mobile]
// Prints a JSON report; used for visual review and for grading skill evals.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch } from './lib/browser.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const target = args[0];
const out = args[1] || 'tests/.tmp/shots';
const width = Number(opt('width', args.includes('--mobile') ? 390 : 1280));
const height = Number(opt('height', args.includes('--mobile') ? 844 : 800));
const shots = Number(opt('shots', 6));
const reduced = args.includes('--reduced');
fs.mkdirSync(out, { recursive: true });
const url = /^https?:|^file:/.test(target) ? target : pathToFileURL(path.resolve(target)).href;

const page = await launch({ width, height });
await page.reducedMotion(reduced);
await page.goto(url);
await page.wait(2600);

const report = { url, width, height, reduced, shots: [] };
const total = await page.eval('document.documentElement.scrollHeight');
const stops = Math.max(1, shots);
for (let i = 0; i < stops; i++) {
  const y = Math.round((total - height) * (stops === 1 ? 0 : i / (stops - 1)));
  // scroll gradually so scroll-linked effects and observers see every position
  await page.eval(`(async () => { const to = ${y}; const from = scrollY; const n = 12;
    for (let k = 1; k <= n; k++) { scrollTo(0, from + (to - from) * k / n); await new Promise(r => requestAnimationFrame(r)); } })()`);
  await page.wait(1300);
  const file = path.join(out, `shot-${String(i).padStart(2, '0')}.png`);
  await page.screenshot(file);
  report.shots.push(file);
}
// after scrolling everything: anything still invisible that should be visible?
report.metrics = await page.eval(`(() => {
  const vis = (el) => { const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden'; };
  const textEls = [...document.querySelectorAll('h1,h2,h3,h4,p,li,a,button,img,span')].filter(vis)
    .filter((el) => el.getBoundingClientRect().height > 0 && !el.closest('[aria-hidden="true"],.mk-sr,[data-loader],.mk-marquee-track > [inert]'));
  const stuck = textEls.filter((el) => {
    let o = 1; for (let n = el; n && n.nodeType === 1; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity);
    return o < 0.1;
  }).map((el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + ' "' + (el.textContent || '').trim().slice(0, 40) + '"');
  const anims = document.getAnimations();
  return {
    motionKit: !!window.MotionKit, kitModules: window.MotionKit ? window.MotionKit.stats() : null,
    stuckInvisible: stuck.slice(0, 15), stuckCount: stuck.length,
    canvases: document.querySelectorAll('canvas').length,
    runningAnimations: anims.filter((a) => a.playState === 'running').length,
    infiniteAnimations: anims.filter((a) => a.effect && a.effect.getTiming().iterations === Infinity && a.playState === 'running').length,
    keyframeRules: [...document.styleSheets].reduce((n, s) => { try { return n + [...s.cssRules].filter((r) => r.type === 7).length; } catch (e) { return n; } }, 0),
    usesIntersectionObserver: /IntersectionObserver/.test(document.documentElement.outerHTML),
    reducedMotionCss: /prefers-reduced-motion/.test([...document.querySelectorAll('style')].map((s) => s.textContent).join('')),
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 2,
    pageHeight: document.documentElement.scrollHeight
  };
})()`);
report.console = page.console.filter((m) => ['error', 'exception', 'log-error', 'warning'].includes(m.type))
  .filter((m) => !/favicon\.ico|fonts\.g(oogleapis|static)\.com/.test(m.text));
await page.close();
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
