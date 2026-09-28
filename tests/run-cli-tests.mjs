// Unit tests for the Motion Kit CLI (scripts/motion-kit.mjs). Usage: node tests/run-cli-tests.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { detect, resolve, build, inlineHtml, linkHtml, removeInjected, check, parseTags } from '../skills/web-motion-graphics/scripts/motion-kit.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.resolve(HERE, '..', 'skills', 'web-motion-graphics');
const CLI = path.join(SKILL, 'scripts', 'motion-kit.mjs');
const manifest = JSON.parse(fs.readFileSync(path.join(SKILL, 'assets', 'src', 'manifest.json'), 'utf8'));
let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ok   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message.split('\n').join('\n       ')); }
}
const page = (body, head = '<meta charset="utf-8"><title>t</title>') => `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;

console.log('manifest / sources');
test('every manifest file exists', () => {
  for (const m of manifest.modules) for (const k of ['js', 'css']) if (m[k]) assert.ok(fs.existsSync(path.join(SKILL, 'assets', 'src', m[k])), m[k]);
});
test('every data-motion preset has CSS', () => {
  const css = fs.readFileSync(path.join(SKILL, 'assets', 'src', 'modules', 'reveal.css'), 'utf8');
  for (const v of manifest.values['data-motion'].filter(Boolean)) {
    assert.ok(css.includes(`[data-motion="${v}"]`), 'missing rule for ' + v);
    assert.ok(new RegExp('@keyframes mk-' + v + '\\b').test(css), 'missing keyframes for ' + v);
  }
});
test('every data-scrub preset has CSS', () => {
  const css = fs.readFileSync(path.join(SKILL, 'assets', 'src', 'modules', 'scroll.css'), 'utf8');
  for (const v of manifest.values['data-scrub'].filter(Boolean)) assert.ok(css.includes(`[data-scrub="${v}"]`), v);
});
test('every data-text mode is implemented', () => {
  const src = ['text.js', 'text-scramble.js', 'text-typewriter.js', 'text-rotate.js', 'text-fx.js', 'text-particles.js']
    .map((f) => fs.readFileSync(path.join(SKILL, 'assets', 'src', 'modules', f), 'utf8')).join('\n');
  for (const v of manifest.values['data-text']) assert.ok(new RegExp('\\b' + v + ':|textModes\\.' + v + '\\b').test(src), v);
});
test('every loader / transition / cursor type has CSS', () => {
  const read = (f) => fs.readFileSync(path.join(SKILL, 'assets', 'src', 'modules', f), 'utf8');
  for (const v of manifest.values['data-loader'].filter(Boolean)) assert.ok(read('loader.css').includes('mk-loader--' + v), 'loader ' + v);
  for (const v of manifest.values['data-transition'].filter((x) => x && x !== 'view')) assert.ok(read('transition.css').includes('mk-pt--' + v), 'pt ' + v);
  for (const v of ['blend']) assert.ok(read('cursor.css').includes('mk-cursor--' + v), 'cursor ' + v);
});
test('every animation name used in the CSS has @keyframes', () => {
  const css = build(['all']).css;
  const defined = new Set([...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]));
  const used = new Set();
  for (const m of css.matchAll(/animation(?:-name)?\s*:([^;}]+)/g)) {
    (m[1].match(/(?<![-\w])mk-[\w-]+/g) || []).forEach((n) => used.add(n));
  }
  for (const m of css.matchAll(/--mk-name:\s*([\w-]+)/g)) used.add(m[1]);
  for (const n of used) assert.ok(defined.has(n), 'missing @keyframes ' + n);
  assert.ok(!/@keyframes\s*\./.test(css) && !/animation:\s*\./.test(css), 'mangled selector inside animation/keyframes');
});
test('minified CSS keeps doubled utility selectors', () => {
  assert.match(build(['effects-surface'], { min: true }).css, /\.mk-gradient-border\.mk-gradient-border/);
});
test('each module bundles and parses on its own (readable + minified)', () => {
  for (const m of manifest.modules) {
    for (const min of [false, true]) {
      const b = build([m.name], { min });
      new vm.Script(b.js, { filename: m.name + (min ? '.min' : '') + '.js' });
    }
  }
});
test('prebuilt dist matches sources (run node tools/build.mjs)', () => {
  const dist = path.join(SKILL, 'assets', 'dist');
  assert.equal(fs.readFileSync(path.join(dist, 'motion-kit.js'), 'utf8'), build(['all']).js);
  assert.equal(fs.readFileSync(path.join(dist, 'motion-kit.css'), 'utf8'), build(['all']).css);
  assert.equal(fs.readFileSync(path.join(dist, 'motion-kit.min.js'), 'utf8'), build(['all'], { min: true }).js);
});

console.log('packaging / Agent Skills spec');
const skillMd = fs.readFileSync(path.join(SKILL, 'SKILL.md'), 'utf8');
function frontmatter(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(m, 'SKILL.md must start with --- frontmatter ---');
  const out = {}; let parent = null;
  for (const line of m[1].split('\n')) {
    const nested = line.match(/^ {2}([\w-]+):\s*(.*)$/);
    const top = line.match(/^([\w-]+):\s*(.*)$/);
    if (nested && parent) out[parent][nested[1]] = nested[2].replace(/^"(.*)"$/, '$1');
    else if (top) { out[top[1]] = top[2] === '' ? {} : top[2]; parent = top[2] === '' ? top[1] : null; }
    else if (line.trim()) throw new Error('unexpected frontmatter line: ' + line);
  }
  return out;
}
const fm = frontmatter(skillMd);
test('frontmatter uses only Agent Skills fields (Claude.ai / ChatGPT reject others)', () => {
  const allowed = ['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools'];
  for (const k of Object.keys(fm)) assert.ok(allowed.includes(k), 'unexpected key ' + k);
});
test('name, description, compatibility follow the spec limits', () => {
  assert.equal(fm.name, path.basename(SKILL), 'name must match the folder');
  assert.match(fm.name, /^[a-z0-9]+(-[a-z0-9]+)*$/);
  assert.ok(fm.name.length <= 64);
  assert.ok(fm.description.length > 0 && fm.description.length <= 1024, 'description length ' + fm.description.length);
  assert.ok(!fm.compatibility || fm.compatibility.length <= 500, 'compatibility length');
  assert.ok(!/: /.test(fm.description), 'unquoted ": " would break YAML');
  for (const v of Object.values(fm.metadata || {})) assert.equal(typeof v, 'string');
});
test('SKILL.md body stays under 500 lines and its links resolve', () => {
  assert.ok(skillMd.split('\n').length < 500);
  for (const m of skillMd.matchAll(/\]\(((?:references|assets|scripts)\/[^)#]+)\)/g)) {
    assert.ok(fs.existsSync(path.join(SKILL, m[1])), 'broken link ' + m[1]);
  }
});
test('versions agree across manifest, SKILL.md, marketplace and Gemini extension', () => {
  const mk = JSON.parse(fs.readFileSync(path.join(SKILL, 'assets', 'src', 'manifest.json'), 'utf8')).version;
  const market = JSON.parse(fs.readFileSync(path.join(HERE, '..', '.claude-plugin', 'marketplace.json'), 'utf8'));
  const gem = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'gemini-extension.json'), 'utf8'));
  assert.equal(fm.metadata.version, mk);
  assert.equal(market.plugins[0].version, mk);
  assert.equal(market.plugins[0].name, fm.name);
  assert.equal(gem.version, mk);
  assert.equal(gem.name, fm.name);
  const oa = fs.readFileSync(path.join(SKILL, 'agents', 'openai.yaml'), 'utf8');
  for (const m of oa.matchAll(/icon_\w+:\s*"\.\/([^"]+)"/g)) assert.ok(fs.existsSync(path.join(SKILL, m[1])), 'missing icon ' + m[1]);
});
test('dist zip is up to date with the skill folder (run node tools/package.mjs)', () => {
  const zip = fs.readFileSync(path.join(HERE, '..', 'dist', 'web-motion-graphics.zip'));
  const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  let p = zip.readUInt32LE(eocd + 16);
  const entries = {};
  for (let i = 0; i < zip.readUInt16LE(eocd + 10); i++) {
    const nameLen = zip.readUInt16LE(p + 28), extra = zip.readUInt16LE(p + 30), comment = zip.readUInt16LE(p + 32);
    entries[zip.toString('utf8', p + 46, p + 46 + nameLen)] = zip.readUInt32LE(p + 16);
    p += 46 + nameLen + extra + comment;
  }
  const files = [];
  (function walk(dir, rel) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(dir, e.name), rel + e.name + '/');
      else files.push(rel + e.name);
    }
  })(SKILL, 'web-motion-graphics/');
  for (const f of files) {
    assert.ok(f in entries, 'zip is missing ' + f);
    const crc = zlib.crc32(fs.readFileSync(path.join(SKILL, f.slice('web-motion-graphics/'.length))));
    assert.equal(entries[f], crc >>> 0, 'zip has a stale copy of ' + f);
  }
  assert.equal(Object.keys(entries).filter((n) => !n.endsWith('/')).length, files.length, 'zip has extra files');
});

console.log('detect');
test('attributes, values, classes and code', () => {
  const mods = detect(page(`<h1 data-text="reveal">Hi</h1><p data-text="typewriter" data-words="a|b">a</p>
    <section data-bg="aurora noise"><a class="btn mk-btn-fill" data-magnetic>x</a></section>
    <div data-count-to="10">10</div><script>MotionKit.confetti()</script>`));
  for (const n of ['core', 'text', 'text-typewriter', 'bg', 'bg-aurora', 'bg-noise', 'effects-hover', 'magnetic', 'counter', 'confetti']) assert.ok(mods.includes(n), n + ' missing: ' + mods);
  for (const n of ['text-rotate', 'text-scramble', 'reveal', 'bg-particles', 'tilt']) assert.ok(!mods.includes(n), n + ' should not be included');
});
test('liquid pulls in the aurora fallback', () => {
  assert.deepEqual(detect('<div data-bg="liquid"></div>'), ['core', 'bg', 'bg-gl', 'bg-aurora', 'bg-liquid']);
});
test('JSX string literals and dynamic values', () => {
  assert.ok(detect('<div data-motion={"fade-up"} />').includes('reveal'));
  const d = detect('<h1 data-text={variant} />');
  assert.ok(d.includes('text-rotate') && d.includes('text-typewriter'), 'dynamic value should include add-ons: ' + d);
});
test('ignores text inside comments', () => {
  assert.deepEqual(detect('<!-- <div data-bg="stars"> -->'), ['core']);
});
test('resolve orders modules and adds deps', () => {
  assert.deepEqual(resolve(['bg-stars']), ['core', 'bg', 'bg-stars']);
  assert.throws(() => resolve(['nope']));
});
test('parseTags handles quotes, booleans and line numbers', () => {
  const t = parseTags('<p>\n<div data-tilt data-motion=\'zoom-in\' class="a b">x</div>');
  const div = t.find((x) => x.tag === 'div');
  assert.equal(div.attrs['data-tilt'], '');
  assert.equal(div.attrs['data-motion'], 'zoom-in');
  assert.equal(div.line, 2);
});

console.log('inline / link');
const sample = page('<h1 data-text="reveal">Hello world</h1><div data-motion="fade-up">x</div>', '<meta charset="utf-8"><title>t</title><style>h1{color:red}</style>');
test('inline injects boot + css in head (before author css) and js before </body>', () => {
  const { html, modules } = inlineHtml(sample);
  assert.deepEqual(modules, ['core', 'reveal', 'text']);
  const boot = html.indexOf('motion-kit:boot'), css = html.indexOf('id="motion-kit-css"'), author = html.indexOf('h1{color:red}');
  assert.ok(boot > 0 && boot < css && css < author, 'order boot<css<author');
  assert.ok(html.indexOf('id="motion-kit-js"') < html.indexOf('</body>'));
});
test('inline is idempotent', () => {
  const once = inlineHtml(sample).html;
  const twice = inlineHtml(once).html;
  assert.equal(twice, once);
  assert.equal(twice.split('motion-kit:boot').length, 2);
});
test('switching inline -> link removes the inline kit', () => {
  const linked = linkHtml(inlineHtml(sample).html, 'assets/motion-kit');
  assert.ok(!linked.includes('motion-kit-js'));
  assert.ok(linked.includes('href="assets/motion-kit/motion-kit.css"') && linked.includes('src="assets/motion-kit/motion-kit.js" defer'));
  assert.equal(removeInjected(linked).includes('motion-kit'), false);
});
test('inline works without <head>, <meta charset> or <body>', () => {
  for (const src of ['<div data-motion>x</div>', '<html><body><div data-motion>x</div></body></html>', '<head><title>x</title></head><div data-motion>x</div>']) {
    const out = inlineHtml(src).html;
    assert.ok(out.includes('motion-kit:boot') && out.includes('motion-kit-js'), src);
  }
});
test('--all includes every module', () => {
  assert.equal(inlineHtml(sample, { all: true }).modules.length, manifest.modules.length);
});

console.log('check');
test('flags typos with suggestions', () => {
  const r = check(page('<div data-motion="fade-upp">x</div><div data-bg="particle">y</div><div data-text="typewritter">z</div>'));
  const msgs = r.issues.map((i) => i.msg).join('\n');
  assert.match(msgs, /did you mean "fade-up"/);
  assert.match(msgs, /did you mean "particles"/);
  assert.match(msgs, /did you mean "typewriter"/);
});
test('flags missing kit', () => {
  assert.match(check(page('<div data-motion>x</div>')).issues.map((i) => i.msg).join(), /kit is not included/);
});
test('clean inlined page has no errors or warnings', () => {
  const r = check(inlineHtml(sample).html);
  assert.deepEqual(r.issues, []);
  assert.ok(r.effectKinds >= 2);
});
test('flags sticky breakers, layout transitions, loops without reduced-motion, conflicts', () => {
  const html = inlineHtml(page('<section data-horizontal><div>1</div><div>2</div></section><div data-motion data-tilt>x</div>',
    '<meta charset="utf-8"><style>body{overflow-x:hidden} .a{transition: width .3s, opacity .2s} @keyframes spin{to{rotate:1turn}}</style>')).html;
  const msgs = check(html).issues.map((i) => i.msg).join('\n');
  assert.match(msgs, /breaks position: sticky/);
  assert.match(msgs, /transitions width/);
  assert.match(msgs, /prefers-reduced-motion/);
  assert.match(msgs, /put one of them on a wrapper/);
});
test('rotate without words and bad counter are errors', () => {
  const msgs = check(page('<span data-text="rotate">a</span><b data-count-to="lots">1</b>')).issues.map((i) => i.msg).join('\n');
  assert.match(msgs, /needs data-words/);
  assert.match(msgs, /must be a number/);
});

console.log('command line');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-cli-'));
test('inline / check / link / bundle via the real CLI', () => {
  const f = path.join(tmp, 'index.html');
  fs.writeFileSync(f, sample);
  const out = execFileSync(process.execPath, [CLI, 'inline', f], { encoding: 'utf8' });
  assert.match(out, /inlined Motion Kit/);
  execFileSync(process.execPath, [CLI, 'check', f], { encoding: 'utf8' });
  const f2 = path.join(tmp, 'about.html');
  fs.writeFileSync(f2, sample);
  execFileSync(process.execPath, [CLI, 'link', f, f2, '--out', path.join(tmp, 'assets', 'motion-kit')], { encoding: 'utf8' });
  assert.ok(fs.existsSync(path.join(tmp, 'assets', 'motion-kit', 'motion-kit.js')));
  assert.match(fs.readFileSync(f2, 'utf8'), /href="assets\/motion-kit\/motion-kit\.css"/);
  const pub = path.join(tmp, 'public');
  const src = path.join(tmp, 'src');
  fs.mkdirSync(src);
  fs.writeFileSync(path.join(src, 'App.jsx'), 'export default () => <h1 data-text="chars" className="mk-float">Hi</h1>;');
  const b = execFileSync(process.execPath, [CLI, 'bundle', '--out', pub, '--from', src], { encoding: 'utf8' });
  assert.match(b, /core, text, effects-ambient/);
  assert.ok(fs.existsSync(path.join(pub, 'motion-kit.css')));
});
test('check exits non-zero on errors', () => {
  const f = path.join(tmp, 'bad.html');
  fs.writeFileSync(f, page('<div data-motion="nope">x</div>'));
  let code = 0;
  try { execFileSync(process.execPath, [CLI, 'check', f], { encoding: 'utf8' }); } catch (e) { code = e.status; }
  assert.equal(code, 1);
});
test('list and help run', () => {
  assert.match(execFileSync(process.execPath, [CLI, 'list'], { encoding: 'utf8' }), /bg-liquid/);
  assert.match(execFileSync(process.execPath, [CLI, 'help'], { encoding: 'utf8' }), /inline/);
});
fs.rmSync(tmp, { recursive: true, force: true });

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
