// Checks that scripts/motion_kit.py (Python port) produces exactly the same results as scripts/motion-kit.mjs.
// Runs CPython inside Pyodide (WebAssembly), so no local Python install is needed.  Usage: node tests/run-python-parity.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPyodide } from 'pyodide';
import * as js from '../skills/web-motion-graphics/scripts/motion-kit.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SKILL = path.join(ROOT, 'skills', 'web-motion-graphics');

const py = await loadPyodide();
// mount the skill folder into the Python filesystem and import the module
py.FS.mkdirTree('/skill');
py.FS.mount(py.FS.filesystems.NODEFS, { root: SKILL }, '/skill');
py.runPython("import sys; sys.path.insert(0, '/skill/scripts'); import motion_kit as mk; import json");
const callPy = (expr, vars = {}) => {
  for (const [k, v] of Object.entries(vars)) py.globals.set(k, v);
  return JSON.parse(py.runPython(`json.dumps(${expr})`));
};

const inputs = [
  ...['showcase/index.html', 'wow/index.html'].map((f) => fs.readFileSync(path.join(ROOT, 'examples', f), 'utf8')),
  ...fs.readdirSync(path.join(HERE, 'fixtures')).filter((f) => f.endsWith('.html')).map((f) => fs.readFileSync(path.join(HERE, 'fixtures', f), 'utf8')),
  '<div data-motion="fade-upp">x</div><div data-bg="particle">y</div><span data-text="rotate">a</span><b data-count-to="lots">1</b>',
  '<Hero data-text={mode} className="mk-gradient-text mk-float" /><div data-motion={"zoom-in"} data-bg="aurora noise"/>',
  '<head><title>x</title></head><div data-motion>x</div>',
  '<div data-motion>x</div>',
  '<!doctype html><html><head><meta charset="utf-8"><style>body{overflow-x:hidden} .a{transition: width .3s, opacity .2s} @keyframes spin{to{rotate:1turn}}</style></head><body><section data-horizontal><div>1</div></section><div data-motion data-tilt>x</div></body></html>'
];

let pass = 0, fail = 0;
function same(name, a, b) {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  if (A === B) { pass++; return; }
  fail++;
  let i = 0;
  while (i < A.length && A[i] === B[i]) i++;
  console.log(`  FAIL ${name}\n    node:   ...${A.slice(Math.max(0, i - 80), i + 120)}\n    python: ...${B.slice(Math.max(0, i - 80), i + 120)}`);
}

inputs.forEach((src, n) => {
  same(`detect #${n}`, js.detect(src), callPy('mk.detect(src)', { src }));
  const c = js.check(src, 'f');
  same(`check #${n}`, { issues: c.issues, counts: c.counts, modules: c.modules, kinds: c.effectKinds }, (() => {
    const r = callPy("mk.check(src, 'f')", { src });
    return { issues: r.issues, counts: r.counts, modules: r.modules, kinds: r.effectKinds };
  })());
  same(`inline #${n}`, js.inlineHtml(src).html, callPy('mk.inline_html(src)["html"]', { src }));
  same(`inline --all #${n}`, js.inlineHtml(src, { all: true }).html, callPy('mk.inline_html(src, all_=True)["html"]', { src }));
  same(`link #${n}`, js.linkHtml(src, 'assets\\motion-kit'), callPy("mk.link_html(src, 'assets\\\\motion-kit')", { src }));
  same(`parseTags #${n}`, js.parseTags(src), callPy('mk.parse_tags(src)', { src }));
});
same('bundle all (min)', js.build(['all'], { min: true }), callPy("mk.build(['all'], True)"));
same('bundle all (readable)', js.build(['all']), callPy("mk.build(['all'])"));
same('bundle subset', js.build(['bg-liquid', 'text-typewriter']), callPy("mk.build(['bg-liquid', 'text-typewriter'])"));
same('react module', js.reactModule(['reveal', 'text']), callPy("mk.react_module(['reveal', 'text'])"));
same('boot', js.BOOT, callPy('mk.BOOT'));
same('minifyCss', js.minifyCss('a { color : red ; }  /* x */ b{}'), callPy("mk.minify_css('a { color : red ; }  /* x */ b{}')"));
same('minifyJs', js.minifyJs('// c\n  var a = 1; /* b */\n\n  a++;'), callPy("mk.minify_js('// c\\n  var a = 1; /* b */\\n\\n  a++;')"));

// command line: run both CLIs on real files and compare what they write
const TMP = path.join(HERE, '.tmp', 'py-cli');
fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(path.join(TMP, 'node'), { recursive: true });
fs.mkdirSync(path.join(TMP, 'py'), { recursive: true });
py.FS.mkdirTree('/work');
py.FS.mount(py.FS.filesystems.NODEFS, { root: TMP }, '/work');
const page = fs.readFileSync(path.join(ROOT, 'examples', 'wow', 'index.html'), 'utf8').replace(/\s*<!-- motion-kit:head -->[\s\S]*?<!-- \/motion-kit:head -->/, '');
for (const d of ['node', 'py']) fs.writeFileSync(path.join(TMP, d, 'index.html'), page);
const { execFileSync } = await import('node:child_process');
const CLI = path.join(SKILL, 'scripts', 'motion-kit.mjs');
execFileSync(process.execPath, [CLI, 'inline', path.join(TMP, 'node', 'index.html')]);
const code1 = py.runPython("mk.main(['inline', '/work/py/index.html'])");
same('cli inline writes identical file', fs.readFileSync(path.join(TMP, 'node', 'index.html'), 'utf8'), fs.readFileSync(path.join(TMP, 'py', 'index.html'), 'utf8'));
same('cli inline exit code', 0, code1);
fs.writeFileSync(path.join(TMP, 'py', 'bad.html'), '<div data-motion="nope">x</div>');
same('cli check exits 1 on errors', 1, py.runPython("mk.main(['check', '/work/py/bad.html'])"));
py.runPython("mk.main(['react', '--out', '/work/py/lib', '--modules', 'reveal,text'])");
execFileSync(process.execPath, [CLI, 'react', '--out', path.join(TMP, 'node', 'lib'), '--modules', 'reveal,text']);
same('cli react module', fs.readFileSync(path.join(TMP, 'node', 'lib', 'motion-kit-react.js'), 'utf8'), fs.readFileSync(path.join(TMP, 'py', 'lib', 'motion-kit-react.js'), 'utf8'));
same('cli react d.ts', fs.readFileSync(path.join(TMP, 'node', 'lib', 'motion-kit-react.d.ts'), 'utf8'), fs.readFileSync(path.join(TMP, 'py', 'lib', 'motion-kit-react.d.ts'), 'utf8'));
py.runPython("mk.main(['bundle', '--out', '/work/py/public'])");
execFileSync(process.execPath, [CLI, 'bundle', '--out', path.join(TMP, 'node', 'public')]);
for (const f of ['motion-kit.css', 'motion-kit.js']) {
  same('cli bundle ' + f, fs.readFileSync(path.join(TMP, 'node', 'public', f), 'utf8'), fs.readFileSync(path.join(TMP, 'py', 'public', f), 'utf8'));
}

console.log(`\npython parity: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
