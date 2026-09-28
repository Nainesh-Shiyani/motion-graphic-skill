// Runs the Motion Kit browser suite in headless Chrome/Edge:
//   3 builds (linked readable dist, inline minified full, inline tree-shaken) x 2 modes (normal, reduced motion)
//   + loader and page-transition flows.
// Usage: node tests/run-kit-tests.mjs [--quick]
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch } from './lib/browser.mjs';
import { inlineHtml, linkHtml, reactModule } from '../skills/web-motion-graphics/scripts/motion-kit.mjs';
import { buildDist } from '../tools/build.mjs';

await buildDist();

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(HERE, 'fixtures');
const TMP = path.join(HERE, '.tmp');
const DIST = path.resolve(HERE, '..', 'skills', 'web-motion-graphics', 'assets', 'dist');
fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

const quick = process.argv.includes('--quick');
let failures = 0;
const log = (...a) => console.log(...a);

function variant(name, file, how, edit) {
  let src = fs.readFileSync(path.join(FIX, file), 'utf8');
  if (edit) src = edit(src);
  const dir = path.join(TMP, name);
  fs.mkdirSync(dir, { recursive: true });
  let html;
  if (how === 'link') html = linkHtml(src, path.relative(dir, DIST));
  else if (how === 'inline-all') html = inlineHtml(src, { all: true, min: true }).html;
  else html = inlineHtml(src, { min: true }).html;
  const out = path.join(dir, file);
  fs.writeFileSync(out, html);
  return pathToFileURL(out).href;
}

async function suite(page, url, reduced) {
  page.console.length = 0;
  await page.reducedMotion(reduced);
  await page.goto(url);
  let res = null;
  for (let i = 0; i < 240 && !res; i++) {
    await page.wait(250);
    res = await page.eval('window.__results || null');
  }
  if (!res) { log('   no results (timeout)'); return 1; }
  const errs = page.console.filter((m) => m.type === 'exception' || m.type === 'error' || m.type === 'log-error');
  res.results.filter((r) => !r.ok).forEach((r) => log(`   FAIL ${r.name} -> ${r.err}`));
  errs.forEach((e) => log(`   CONSOLE ${e.type}: ${e.text}`));
  const bad = res.failed + errs.length;
  log(`   ${bad ? 'FAILED' : 'passed'} ${res.total - res.failed}/${res.total} tests, ${errs.length} console errors`);
  return bad;
}

const page = await launch({ width: 1280, height: 800, initScript: 'window.MotionKitConfig = { finePointer: true };' });
try {
  const builds = quick ? ['link'] : ['link', 'inline-all', 'inline-detected'];
  for (const b of builds) for (const suiteFile of ['kit-suite.html', 'fx-suite.html']) {
    const url = variant(b, suiteFile, b);
    for (const reduced of [false, true]) {
      log(`\n== ${suiteFile} | ${b} | ${reduced ? 'reduced motion' : 'normal motion'}`);
      failures += await suite(page, url, reduced);
    }
  }

  // ---- loader flow
  for (const [type, reduced] of [['curtain', false], ['columns', false], ['curtain', true]]) {
    log(`\n== loader ${type} | ${reduced ? 'reduced' : 'normal'}`);
    await page.reducedMotion(reduced);
    page.console.length = 0;
    await page.goto(variant('loader-' + type, 'loader.html', 'inline-detected', (h) => h.replace('data-loader="curtain"', `data-loader="${type}"`)));
    const early = await page.eval(`({ loading: document.documentElement.classList.contains('mk-loading'),
      loader: !!document.querySelector('[data-loader]'), revealed: document.getElementById('h').classList.contains('mk-in') })`);
    let done = null;
    for (let i = 0; i < 40 && !done; i++) {
      await page.wait(150);
      done = await page.eval(`(!document.querySelector('[data-loader]') && !document.documentElement.classList.contains('mk-loading') &&
        document.getElementById('h').classList.contains('mk-in')) ? { ready: window.__log.length } : null`);
    }
    const ok = reduced
      ? (!early.loader && done)
      : (early.loading && early.loader && !early.revealed && done && done.ready === 1);
    log(`   early=${JSON.stringify(early)} done=${JSON.stringify(done)} -> ${ok ? 'passed' : 'FAILED'}`);
    if (!ok) failures++;
  }

  // ---- snippets from references/advanced.md (GSAP, Three.js, custom defineBg) with the kit inlined and linked
  for (const how of ['inline-detected', 'link']) {
    log(`\n== advanced.md snippets | ${how}`);
    await page.reducedMotion(false);
    page.console.length = 0;
    await page.goto(variant('adv-' + how, 'advanced.html', how));
    await page.wait(1500);
    await page.eval(`(async () => { document.getElementById('rings').scrollIntoView(); await new Promise(r => setTimeout(r, 600)); })()`);
    const r = await page.eval(`({ words: window.__splitWords, three: window.__threeFrames, rings: window.__ringsFrames || 0,
      layer: !!document.querySelector('#rings > .mk-bg canvas'), pinned: !!document.querySelector('.pin-spacer'),
      plasma: !!document.querySelector('#plasma > .mk-bg canvas') && !document.querySelector('#plasma .mk-aurora-blob') })`);
    const errs = page.console.filter((m) => ['exception', 'error', 'log-error', 'warning'].includes(m.type));
    const ok = r.words === 3 && r.three > 5 && r.rings > 5 && r.layer && r.pinned && r.plasma && !errs.length;
    log(`   ${JSON.stringify(r)} console: ${errs.map((e) => e.text).join(' | ') || 'clean'} -> ${ok ? 'passed' : 'FAILED'}`);
    if (!ok) failures++;
  }

  // ---- React integration (generated useMotionKit hook + client-side "routing")
  {
    log('\n== react hook');
    await page.reducedMotion(false);
    const mod = reactModule(['reveal', 'text', 'counter', 'bg-aurora'])
      .replace("import { useEffect } from 'react';", 'const { useEffect } = React;')
      .replace(/^export default .*$/m, '')
      .replace(/^export /gm, '');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>react</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
</head><body><div id="root"></div><script>
${mod}
const h = React.createElement;
function Home() { return h('div', null, h('h1', { id: 'rh', 'data-text': 'reveal' }, 'Hello React world'),
  h('div', { id: 'rm', 'data-motion': 'fade-up', 'data-motion-duration': '200' }, 'Reveal me'),
  h('span', { id: 'rc', 'data-count-to': '42', 'data-count-duration': '200' }, '42')); }
function About() { return h('div', null, h('h2', { id: 'ra', 'data-motion': 'zoom-in' }, 'About page'),
  h('div', { id: 'rb', 'data-bg': 'aurora', style: { height: '100px' } })); }
function App() { useMotionKit(); const [p, setP] = React.useState('home'); window.__go = setP;
  return h('main', null, p === 'home' ? h(Home) : h(About)); }
ReactDOM.createRoot(document.getElementById('root')).render(h(App));
</script></body></html>`;
    const f = path.join(TMP, 'react.html');
    fs.writeFileSync(f, html);
    page.console.length = 0;
    await page.goto(pathToFileURL(f).href);
    const res = await page.eval(`(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const until = async (fn, ms = 3000) => { const t = Date.now(); while (Date.now() - t < ms) { try { if (fn()) return true; } catch (e) {} await sleep(40); } return false; };
      const $ = (s) => document.querySelector(s);
      const out = {};
      out.kit = await until(() => window.MotionKit);
      out.home = await until(() => $('#rh').classList.contains('mk-in') && $('#rm').classList.contains('mk-in') && $('#rc').textContent === '42');
      const before = MotionKit.stats().reveal;
      window.__go('about');
      out.about = await until(() => $('#ra') && $('#ra').classList.contains('mk-in') && $('#rb .mk-aurora-blob'));
      await sleep(150);
      out.cleaned = MotionKit.stats().reveal === 1 && before === 1;
      window.__go('home');
      out.back = await until(() => $('#rh') && $('#rh').classList.contains('mk-in'));
      out.cssOnce = document.querySelectorAll('#motion-kit-css').length === 1;
      return out;
    })()`);
    const errs = page.console.filter((m) => ['exception', 'error', 'log-error'].includes(m.type));
    const ok = Object.values(res).every(Boolean) && !errs.length;
    log(`   ${JSON.stringify(res)} console errors: ${errs.map((e) => e.text).join(' | ') || 0} -> ${ok ? 'passed' : 'FAILED'}`);
    if (!ok) failures++;
  }

  // ---- page transition flow, over http:// and file://
  const toColumns = (h) => h.replace('data-transition="curtain"', 'data-transition="columns"');
  const a = variant('inline', 'pt-a.html', 'inline-detected');
  variant('inline', 'pt-b.html', 'inline-detected');
  const ac = variant('columns', 'pt-a.html', 'inline-detected', toColumns);
  variant('columns', 'pt-b.html', 'inline-detected', toColumns);
  const server = http.createServer((req, res) => {
    const f = path.join(TMP, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!f.startsWith(TMP) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(f));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const httpA = `http://127.0.0.1:${server.address().port}/inline/pt-a.html`;
  for (const [label, url] of [['http', httpA], ['file', a], ['file, columns', ac]]) {
    log(`\n== page transition (${label}://)`);
    await page.reducedMotion(false);
    await page.goto(url);
    await page.wait(300);
    const hashOk = await page.eval(`(function(){ document.getElementById('hash').click(); return !document.querySelector('.mk-pt').classList.contains('mk-pt-leave'); })()`);
    const nav = page.waitForNavigation(8000);
    const leaving = await page.eval(`(function(){ document.getElementById('go').click(); return document.querySelector('.mk-pt').classList.contains('mk-pt-leave'); })()`);
    const arrived = await nav;
    await page.wait(120);
    const onB = await page.eval(`({ title: document.title, reveal: document.querySelector('.mk-pt') && document.querySelector('.mk-pt').className,
      flag: (function(){ try { return sessionStorage.getItem('mk-pt'); } catch (e) { return null; } })(), name: window.name })`);
    await page.wait(1500);
    const later = await page.eval(`({ cls: document.querySelector('.mk-pt').className, h: document.getElementById('hb').classList.contains('mk-in') })`);
    const ok = hashOk && leaving && arrived && onB.title === 'page B' && /mk-pt-reveal/.test(onB.reveal) && !onB.flag &&
      !/mk-pt/.test(onB.name) && later.h && !/mk-pt-reveal|mk-pt-cover/.test(later.cls);
    log(`   hashIgnored=${hashOk} leaving=${leaving} arrived=${arrived} onB=${JSON.stringify(onB)} later=${JSON.stringify(later)} -> ${ok ? 'passed' : 'FAILED'}`);
    if (!ok) failures++;
  }
  server.close();
} finally {
  await page.close();
}

log(failures ? `\n${failures} failure(s)` : '\nALL BROWSER TESTS PASSED');
process.exitCode = failures ? 1 : 0;
