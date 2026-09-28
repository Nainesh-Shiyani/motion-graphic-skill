#!/usr/bin/env node
// Motion Kit CLI - part of the web-motion-graphics skill. Node 16+, no dependencies.
//
//   node motion-kit.mjs list                          show every module / effect
//   node motion-kit.mjs inline page.html [--all]      embed only the effects the page uses (single-file sites, artifacts)
//   node motion-kit.mjs link a.html b.html [--out dir] write motion-kit.css/js files and link them (multi-page sites)
//   node motion-kit.mjs bundle --out public [--from src]  write motion-kit.css/js for frameworks (Vue, Svelte, Astro, Next...)
//   node motion-kit.mjs react --out src/lib [--from src]  write motion-kit-react.js exporting useMotionKit() (React/Next)
//   node motion-kit.mjs check page.html|dir           lint: typos, missing kit, sticky breakers, reduced-motion gaps
//   node motion-kit.mjs detect page.html | list | boot   modules a file needs | all effects | the <head> boot snippet
// Options: --modules a,b (add modules)  --all  --no-min
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '..', 'assets', 'src');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8'));
const MODULES = MANIFEST.modules;
const BY_NAME = Object.fromEntries(MODULES.map((m) => [m.name, m]));
const VERSION = MANIFEST.version;

export const BOOT =
  "<script>/* motion-kit:boot */(function(d){var r=d.documentElement,f=0;r.classList.add('mk-js');" +
  "try{f=sessionStorage.getItem('mk-pt')}catch(e){}if(f||/(^|\\|)mk-pt$/.test(window.name))r.classList.add('mk-pt-in');" +
  "setTimeout(function(){if(!window.MotionKit)r.classList.remove('mk-js','mk-pt-in')},4000)})(document)</script>";

// ---------------------------------------------------------------- parsing helpers
function stripBlocks(src, tag) {
  return src.replace(new RegExp('<' + tag + '\\b[^>]*>[\\s\\S]*?<\\/' + tag + '>', 'gi'), '');
}
function blocks(src, tag) {
  const out = [];
  const re = new RegExp('<' + tag + '\\b([^>]*)>([\\s\\S]*?)<\\/' + tag + '>', 'gi');
  let m;
  while ((m = re.exec(src))) out.push({ attrs: m[1], body: m[2] });
  return out;
}
function isOurs(text) {
  return /motion-kit:(boot|head|js)|Motion Kit v\d|window\.MotionKit\s*=|MotionKit\.register\(/.test(text);
}

// Returns [{ tag, attrs: {name: value|''}, line }] for every start tag (HTML or JSX-ish markup).
export function parseTags(src) {
  const clean = src.replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, ' '));
  const noScripts = clean
    .replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi, (m, a, b, c) => a + b.replace(/[^\n]/g, ' ') + c)
    .replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (m, a, b, c) => a + b.replace(/[^\n]/g, ' ') + c);
  const tags = [];
  const tagRe = /<([a-zA-Z][\w:.-]*)((?:\s+(?:[^\s"'>\/=]+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|\{[^}]*\}|[^\s"'=<>`]+))?)*)\s*\/?>/g;
  let m;
  while ((m = tagRe.exec(noScripts))) {
    const attrs = {};
    const attrRe = /([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([^}]*)\}|([^\s"'=<>`]+)))?/g;
    let a;
    while ((a = attrRe.exec(m[2] || ''))) {
      // JSX: {"fade-up"} is a plain string; {mode} or {`x-${y}`} stays wrapped in braces = dynamic
      const jsx = a[4] != null ? a[4].trim() : null;
      const lit = jsx && jsx.match(/^(["'`])([^"'`$]*)\1$/);
      const v = a[2] ?? a[3] ?? (jsx != null ? (lit ? lit[2] : '{' + jsx + '}') : undefined) ?? a[5] ?? '';
      attrs[a[1]] = v;
    }
    const line = noScripts.slice(0, m.index).split('\n').length;
    tags.push({ tag: m[1].toLowerCase(), attrs, line });
  }
  return tags;
}
function classesOf(tagAttrs) {
  return (tagAttrs.class || tagAttrs.className || '').split(/\s+/).filter(Boolean);
}

// ---------------------------------------------------------------- module resolution
export function detect(src) {
  src = removeInjected(src).replace(/<!--[\s\S]*?-->/g, '');
  const tags = parseTags(src);
  const found = new Set(['core']);
  const allClasses = new Set();
  tags.forEach((t) => classesOf(t.attrs).forEach((c) => allClasses.add(c)));
  const rawClassHits = src.match(/\bmk-[a-z][a-z0-9-]*/g) || [];
  rawClassHits.forEach((c) => allClasses.add(c));
  const dynamic = (v) => /[${}]/.test(v);
  for (const mod of MODULES) {
    if (mod.always) continue;
    const attrHit = (mod.attrs || []).some((name) => tags.some((t) => name in t.attrs) || new RegExp('\\b' + name + '\\s*[=\\s>]').test(src));
    const classHit = (mod.classes || []).some((c) => allClasses.has(c));
    const codeHit = (mod.code || []).some((c) => src.includes(c));
    // "when": module needed only for certain attribute values (e.g. data-text="typewriter"); dynamic values pull it in to be safe
    const whenHit = Object.entries(mod.when || {}).some(([attr, vals]) =>
      tags.some((t) => attr in t.attrs && (dynamic(t.attrs[attr]) || vals.includes(t.attrs[attr].trim()))) ||
      vals.some((v) => new RegExp('\\b' + attr + '\\s*=\\s*["\'{`]?\\s*["\'`]?' + v + '\\b').test(src)));
    if (attrHit || classHit || codeHit || whenHit) found.add(mod.name);
  }
  // backgrounds by type
  const bgTypes = new Set();
  tags.forEach((t) => { if ('data-bg' in t.attrs) t.attrs['data-bg'].split(/\s+/).filter(Boolean).forEach((x) => bgTypes.add(x)); });
  (src.match(/data-bg\s*=\s*["'{]([^"'}]*)/g) || []).forEach((s) => {
    s.replace(/data-bg\s*=\s*["'{]/, '').split(/\s+/).filter(Boolean).forEach((x) => bgTypes.add(x));
  });
  bgTypes.forEach((b) => { if (BY_NAME['bg-' + b]) found.add('bg-' + b); });
  return resolve([...found]);
}

export function resolve(names) {
  const want = new Set(['core']);
  const add = (n) => {
    const m = BY_NAME[n];
    if (!m) throw new Error('Unknown module "' + n + '". Run "list" to see modules.');
    if (want.has(n) && n !== 'core') return;
    want.add(n);
    (m.deps || []).forEach(add);
  };
  names.forEach((n) => { if (n === 'all') MODULES.forEach((m) => want.add(m.name)); else add(n); });
  // any bg-* type implies the bg engine; the bg engine alone is useless without a type
  return MODULES.filter((m) => want.has(m.name)).map((m) => m.name);
}

// ---------------------------------------------------------------- bundling
const MIN_DIR = path.resolve(HERE, '..', 'assets', 'min');
function read(rel) { return fs.readFileSync(path.join(SRC, rel), 'utf8'); }
// Pre-minified copy (built with esbuild by the repo's tools/build.mjs); falls back to a light minifier.
function readMin(rel, kind) {
  const p = path.join(MIN_DIR, rel);
  if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
  return kind === 'js' ? minifyJs(read(rel)) : minifyCss(read(rel));
}

export function minifyJs(js) {
  return js
    .replace(/\/\*(?!!)[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//'))
    .join('\n');
}
export function minifyCss(css) {
  return css
    .replace(/\/\*(?!!)[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{};])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim();
}

export function build(names, { min = false } = {}) {
  const mods = resolve(names);
  const header = `/*! Motion Kit v${VERSION} | modules: ${mods.join(', ')} | MIT | web-motion-graphics skill */\n`;
  const pick = (kind) => mods.map((n) => BY_NAME[n][kind]).filter(Boolean)
    .map((rel) => (min ? readMin(rel, kind) : read(rel)).trim()).join(kind === 'js' ? ';\n' : '\n');
  return { css: header + pick('css') + '\n', js: header + pick('js') + '\n', modules: mods };
}

// React / Next / any bundler: an importable module that injects the kit once on the client.
export function reactModule(names, { min = true } = {}) {
  const b = build(names, { min });
  return `// @ts-nocheck
// Motion Kit for React (generated by the web-motion-graphics skill; modules: ${b.modules.join(', ')}).
// Usage: import { useMotionKit } from './motion-kit-react'; call useMotionKit() once in your root/layout
// component (a "use client" component in Next.js). Then use data-motion / data-text / data-bg ... in JSX.
import { useEffect } from 'react';

export const MOTION_KIT_CSS = ${JSON.stringify(b.css)};
export const MOTION_KIT_JS = ${JSON.stringify(b.js)};

export function useMotionKit() {
  useEffect(() => {
    if (window.MotionKit) { window.MotionKit.refresh(); return; }
    document.documentElement.classList.add('mk-js');
    const style = document.createElement('style');
    style.id = 'motion-kit-css';
    style.textContent = MOTION_KIT_CSS;
    document.head.prepend(style);
    const script = document.createElement('script');
    script.id = 'motion-kit-js';
    script.textContent = MOTION_KIT_JS;
    document.body.appendChild(script);
  }, []);
}

export default useMotionKit;
`;
}
const REACT_DTS = `export declare const MOTION_KIT_CSS: string;
export declare const MOTION_KIT_JS: string;
export declare function useMotionKit(): void;
export default useMotionKit;
`;

// ---------------------------------------------------------------- html injection
const HEAD_START = '<!-- motion-kit:head -->', HEAD_END = '<!-- /motion-kit:head -->';
const JS_START = '<!-- motion-kit:js -->', JS_END = '<!-- /motion-kit:js -->';

export function removeInjected(html) {
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
  return html
    .replace(new RegExp('\\s*' + esc(HEAD_START) + '[\\s\\S]*?' + esc(HEAD_END), 'g'), '')
    .replace(new RegExp('\\s*' + esc(JS_START) + '[\\s\\S]*?' + esc(JS_END) + '\\n?', 'g'), '')
    .replace(/\s*<script>\/\* motion-kit:boot \*\/[\s\S]*?<\/script>/g, '')
    .replace(/\s*<link\b[^>]*data-motion-kit[^>]*>/g, '')
    .replace(/\s*<script\b[^>]*data-motion-kit[^>]*><\/script>/g, '');
}

function insertHead(html, snippet) {
  const charset = html.match(/<meta\s+charset[^>]*>/i);
  if (charset) {
    const i = charset.index + charset[0].length;
    return html.slice(0, i) + '\n' + snippet + html.slice(i);
  }
  const head = html.match(/<head\b[^>]*>/i);
  if (head) {
    const i = head.index + head[0].length;
    return html.slice(0, i) + '\n' + snippet + html.slice(i);
  }
  const htmlTag = html.match(/<html\b[^>]*>/i);
  if (htmlTag) {
    const i = htmlTag.index + htmlTag[0].length;
    return html.slice(0, i) + '\n<head>\n' + snippet + '\n</head>' + html.slice(i);
  }
  return snippet + '\n' + html;
}
function insertBodyEnd(html, snippet) {
  const i = html.search(/<\/body>/i);
  if (i >= 0) return html.slice(0, i) + '\n' + snippet + '\n' + html.slice(i);
  const j = html.search(/<\/html>/i);
  if (j >= 0) return html.slice(0, j) + snippet + '\n' + html.slice(j);
  return html + '\n' + snippet + '\n';
}

export function inlineHtml(html, { all = false, modules = [], min = true } = {}) {
  const clean = removeInjected(html);
  const names = all ? ['all'] : [...new Set([...detect(clean), ...modules])];
  const b = build(names, { min });
  let out = insertHead(clean, HEAD_START + '\n' + BOOT + '\n<style id="motion-kit-css">\n' + b.css + '</style>\n' + HEAD_END);
  out = insertBodyEnd(out, JS_START + '\n<script id="motion-kit-js">\n' + b.js + '</script>\n' + JS_END);
  return { html: out, modules: b.modules, bytes: b.css.length + b.js.length };
}

export function linkHtml(html, relDir) {
  const clean = removeInjected(html);
  const href = (relDir ? relDir.replace(/\\/g, '/').replace(/\/?$/, '/') : '');
  const snippet = HEAD_START + '\n' + BOOT + '\n' +
    `<link rel="stylesheet" href="${href}motion-kit.css" data-motion-kit>\n` +
    `<script src="${href}motion-kit.js" defer data-motion-kit></script>\n` + HEAD_END;
  return insertHead(clean, snippet);
}

// ---------------------------------------------------------------- lint
function suggest(value, list) {
  let best = null, bestD = 99;
  for (const cand of list) {
    const d = lev(value, cand);
    if (d < bestD) { bestD = d; best = cand; }
  }
  return bestD <= 3 ? best : null;
}
function lev(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return dp[a.length][b.length];
}

// every effect attribute except the ones counted separately above (reveal, text, bg)
const COUNTED_ATTRS = [...new Set(MODULES.flatMap((m) => m.attrs || []))].filter((a) => !['data-motion', 'data-motion-children', 'data-text', 'data-bg'].includes(a));

export function check(src, file = 'input') {
  const issues = [];
  const add = (level, line, msg) => issues.push({ level, line, msg });
  const tags = parseTags(src);
  const V = MANIFEST.values;
  const bgTypes = MODULES.filter((m) => m.bg).map((m) => m.bg);
  const counts = {};
  const count = (k) => { counts[k] = (counts[k] || 0) + 1; };
  const dynamic = (v) => /[${}]/.test(v);

  for (const t of tags) {
    const A = t.attrs;
    for (const [name, allowed] of Object.entries(V)) {
      if (!(name in A) || dynamic(A[name])) continue;
      const val = A[name].trim();
      if (!allowed.includes(val)) {
        const s = suggest(val, allowed.filter(Boolean));
        add('error', t.line, `${name}="${val}" is not a Motion Kit value${s ? ` - did you mean "${s}"?` : ''} (allowed: ${allowed.filter(Boolean).join(', ')})`);
      }
    }
    if ('data-bg' in A && !dynamic(A['data-bg'])) {
      A['data-bg'].split(/\s+/).filter(Boolean).forEach((b) => {
        if (!bgTypes.includes(b)) {
          const s = suggest(b, bgTypes);
          add('error', t.line, `data-bg="${b}" is not a background type${s ? ` - did you mean "${s}"?` : ''} (types: ${bgTypes.join(', ')})`);
        }
        count('bg:' + b);
      });
    }
    if ('data-count-to' in A && !dynamic(A['data-count-to']) && isNaN(parseFloat(A['data-count-to'].replace(/[, _]/g, '')))) {
      add('error', t.line, `data-count-to="${A['data-count-to']}" must be a number`);
    }
    if (A['data-text'] === 'rotate' && !A['data-words']) add('error', t.line, 'data-text="rotate" needs data-words="one|two|three"');
    if ('data-cursor' in A && !['body', 'html'].includes(t.tag)) add('warn', t.line, 'data-cursor belongs on <body>');
    if ('data-transition' in A && !['body', 'html'].includes(t.tag)) add('warn', t.line, 'data-transition belongs on <body>');
    if ('data-motion' in A && ['data-parallax', 'data-mouse-parallax', 'data-magnetic', 'data-tilt'].some((x) => x in A)) {
      add('warn', t.line, 'data-motion shares an element with parallax/magnetic/tilt - both move the element; put one of them on a wrapper');
    }
    if ('data-parallax' in A && ('data-scrub' in A)) add('warn', t.line, 'data-parallax and data-scrub on the same element fight over transforms');
    if ('data-motion' in A) count('reveal');
    if ('data-motion-children' in A) count('reveal-group');
    if ('data-text' in A) count('text:' + A['data-text']);
    for (const k of COUNTED_ATTRS) {
      if (k in A) count(k.replace('data-', ''));
    }
  }

  const used = detect(src).filter((n) => n !== 'core');
  const hasKit = /Motion Kit v\d|motion-kit\.js|window\.MotionKit\s*=|MotionKit\.register\(/.test(src);
  if (used.length && !hasKit) add('error', 0, 'Motion Kit attributes are used but the kit is not included - run "inline" or "link" on this file (or load motion-kit.js)');
  if (used.length && hasKit && !/mk-js/.test(src)) add('warn', 0, 'no <head> boot snippet - content may flash before animating (run "inline"/"link", or add the "boot" snippet)');
  if (tags.filter((t) => 'data-loader' in t.attrs).length > 1) add('warn', 0, 'more than one data-loader on the page');

  const canvasBgs = Object.keys(counts).filter((k) => k.startsWith('bg:') && !['bg:aurora', 'bg:gradient', 'bg:noise'].includes(k))
    .reduce((s, k) => s + counts[k], 0);
  if (canvasBgs > 3) add('warn', 0, `${canvasBgs} canvas/WebGL backgrounds on one page - keep it to 1-3 for smooth scrolling on laptops/phones`);

  // author CSS checks (ignore the kit's own CSS)
  const css = blocks(src, 'style').filter((b) => !isOurs(b.body)).map((b) => b.body).join('\n') +
    '\n' + tags.map((t) => t.attrs.style || '').join(';');
  const usesSticky = used.includes('story') || /position\s*:\s*sticky/.test(css);
  if (usesSticky && /(?:^|[}\s,])(?:html|body)\s*(?:,[^{]*)?\{[^}]*overflow(?:-x|-y)?\s*:\s*(?:hidden|auto|scroll)/i.test(css)) {
    add('warn', 0, 'html/body has overflow hidden/auto - this breaks position: sticky (data-horizontal, data-steps, sticky headers). Use overflow-x: clip instead');
  }
  const LAYOUT = ['width', 'height', 'top', 'left', 'right', 'bottom', 'margin', 'padding', 'max-height', 'max-width',
    'margin-top', 'margin-left', 'padding-top', 'padding-left'];
  const layoutProps = new Set();
  for (const m of css.matchAll(/transition(?:-property)?\s*:([^;}]*)/gi)) {
    m[1].split(',').forEach((part) => {
      const prop = part.trim().split(/\s+/)[0];
      if (LAYOUT.includes(prop)) layoutProps.add(prop);
    });
  }
  if (layoutProps.size) add('warn', 0, `author CSS transitions ${[...layoutProps].join(', ')} - animate transform/opacity instead for smooth 60fps`);
  if (/@keyframes/.test(css) && !/prefers-reduced-motion/.test(css)) {
    add('warn', 0, 'author CSS defines @keyframes but has no @media (prefers-reduced-motion: reduce) rule - disable decorative loops for users who ask for less motion');
  }
  const extScripts = [...src.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]).filter((u) => /^https?:/.test(u));
  extScripts.filter((u) => !/cdnjs\.cloudflare\.com/.test(u)).forEach((u) =>
    add('info', 0, `external script ${u} - Claude.ai artifacts only allow cdnjs.cloudflare.com; fine for real sites`));

  const reveals = (counts.reveal || 0) + (counts['reveal-group'] || 0);
  const effectKinds = Object.keys(counts).length;
  return { file, issues, counts, reveals, effectKinds, modules: used };
}

function printCheck(r) {
  const icon = { error: 'x', warn: '!', info: 'i' };
  console.log(`\n${r.file}`);
  const summary = Object.entries(r.counts).map(([k, v]) => `${k}${v > 1 ? ' x' + v : ''}`).join(', ');
  console.log(`  effects (${r.effectKinds} kinds): ${summary || 'none'}`);
  console.log(`  modules: ${r.modules.join(', ') || 'none'}`);
  if (!r.issues.length) console.log('  OK - no problems found');
  r.issues.forEach((i) => console.log(`  [${icon[i.level]}] ${i.line ? 'line ' + i.line + ': ' : ''}${i.msg}`));
  if (r.effectKinds && r.effectKinds < 4) console.log('  tip: most polished sites combine 4-8 kinds of motion (hero text, reveals, background, hover, counters/marquee)');
}

// ---------------------------------------------------------------- cli
function listFiles(target, exts) {
  const st = fs.statSync(target);
  if (st.isFile()) return [target];
  const out = [];
  for (const e of fs.readdirSync(target, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist', 'build', '.next'].includes(e.name)) continue;
    const p = path.join(target, e.name);
    if (e.isDirectory()) out.push(...listFiles(p, exts));
    else if (exts.includes(path.extname(e.name).toLowerCase())) out.push(p);
  }
  return out;
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--') && ['out', 'modules', 'from'].includes(key)) { args[key] = next; i++; }
      else args[key] = true;
    } else args._.push(a);
  }
  return args;
}

function main(argv) {
  const args = parseArgs(argv);
  const cmd = args._.shift();
  const min = !args['no-min'];
  const extra = args.modules && args.modules !== true ? String(args.modules).split(',').map((s) => s.trim()).filter(Boolean) : [];
  const SRC_EXT = ['.html', '.htm', '.jsx', '.tsx', '.js', '.ts', '.vue', '.svelte', '.astro', '.php', '.erb', '.hbs', '.njk', '.liquid'];

  if (!cmd || cmd === 'help' || args.help) {
    console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 11).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
    return 0;
  }
  if (cmd === 'list') {
    console.log(`Motion Kit v${VERSION} modules:\n`);
    for (const m of MODULES) console.log(`  ${m.name.padEnd(13)} ${m.desc}`);
    console.log('\nValid values:');
    for (const [k, v] of Object.entries(MANIFEST.values)) console.log(`  ${k}: ${v.filter(Boolean).join(' ')}`);
    return 0;
  }
  if (cmd === 'boot') { console.log(BOOT); return 0; }
  if (cmd === 'detect') {
    for (const f of args._) console.log(`${f}: ${detect(fs.readFileSync(f, 'utf8')).join(', ')}`);
    return 0;
  }
  if (cmd === 'inline') {
    if (!args._.length) { console.error('usage: inline <file.html> [--all] [--modules a,b] [--no-min]'); return 2; }
    for (const f of args._) {
      const r = inlineHtml(fs.readFileSync(f, 'utf8'), { all: !!args.all, modules: extra, min });
      fs.writeFileSync(f, r.html);
      console.log(`inlined Motion Kit into ${f} (${(r.bytes / 1024).toFixed(1)} KB): ${r.modules.join(', ')}`);
    }
    return 0;
  }
  if (cmd === 'link') {
    if (!args._.length) { console.error('usage: link <a.html> [b.html ...] [--out dir] [--detect]'); return 2; }
    const outDir = path.resolve(args.out && args.out !== true ? args.out : path.join(path.dirname(args._[0]), 'motion-kit'));
    let names = ['all'];
    if (args.detect) names = [...new Set(args._.flatMap((f) => detect(fs.readFileSync(f, 'utf8'))).concat(extra))];
    const b = build(names, { min });
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'motion-kit.css'), b.css);
    fs.writeFileSync(path.join(outDir, 'motion-kit.js'), b.js);
    for (const f of args._) {
      const rel = path.relative(path.dirname(path.resolve(f)), outDir);
      fs.writeFileSync(f, linkHtml(fs.readFileSync(f, 'utf8'), rel));
      console.log(`linked ${f} -> ${rel.replace(/\\/g, '/') || '.'}/motion-kit.{css,js}`);
    }
    console.log(`wrote ${outDir} (${b.modules.length} modules)`);
    return 0;
  }
  if (cmd === 'bundle') {
    const outDir = path.resolve(args.out && args.out !== true ? args.out : '.');
    let names = ['all'];
    if (args.from && args.from !== true) {
      const files = listFiles(args.from, SRC_EXT);
      names = [...new Set(files.flatMap((f) => detect(fs.readFileSync(f, 'utf8'))).concat(extra))];
    } else if (extra.length) names = extra;
    const b = build(names, { min: !!args.min || min });
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'motion-kit.css'), b.css);
    fs.writeFileSync(path.join(outDir, 'motion-kit.js'), b.js);
    console.log(`wrote ${path.join(outDir, 'motion-kit.css')} and motion-kit.js (${b.modules.length} modules: ${b.modules.join(', ')})`);
    console.log('add to <head>:\n' + BOOT + '\n<link rel="stylesheet" href="/motion-kit.css">\n<script src="/motion-kit.js" defer></script>');
    return 0;
  }
  if (cmd === 'react') {
    let names = ['all'];
    if (args.from && args.from !== true) {
      const files = listFiles(args.from, SRC_EXT);
      names = [...new Set(files.flatMap((f) => detect(fs.readFileSync(f, 'utf8'))).concat(extra))];
    } else if (extra.length) names = extra;
    const code = reactModule(names, { min });
    if (args.out && args.out !== true) {
      const target = /\.(m?js|jsx)$/.test(args.out) ? path.resolve(args.out) : path.resolve(args.out, 'motion-kit-react.js');
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, code);
      fs.writeFileSync(target.replace(/\.(m?js|jsx)$/, '.d.ts'), REACT_DTS);
      console.log(`wrote ${target} (+ .d.ts), ${(code.length / 1024).toFixed(1)} KB - import { useMotionKit } from it and call useMotionKit() once`);
    } else {
      process.stdout.write(code);
    }
    return 0;
  }
  if (cmd === 'check') {
    const targets = args._.length ? args._ : ['.'];
    let errors = 0;
    for (const t of targets) {
      for (const f of listFiles(t, ['.html', '.htm'])) {
        const r = check(fs.readFileSync(f, 'utf8'), f);
        printCheck(r);
        errors += r.issues.filter((i) => i.level === 'error').length;
      }
    }
    console.log(errors ? `\n${errors} error(s)` : '\nall good');
    return errors ? 1 : 0;
  }
  console.error(`unknown command "${cmd}" - try: list, inline, link, bundle, check, detect, boot`);
  return 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
