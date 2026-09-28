#!/usr/bin/env python3
"""Motion Kit CLI (Python port) - part of the web-motion-graphics skill. Python 3.8+, standard library only.

Same commands and byte-identical output as scripts/motion-kit.mjs, for environments that have Python but
not Node (e.g. ChatGPT's code sandbox):

  python motion_kit.py list                           show every module / effect
  python motion_kit.py inline page.html [--all]       embed only the effects the page uses
  python motion_kit.py link a.html b.html [--out dir]  write motion-kit.css/js and link them (multi-page sites)
  python motion_kit.py bundle --out public [--from src] write motion-kit.css/js for frameworks
  python motion_kit.py react --out src/lib [--from src] write motion-kit-react.js exporting useMotionKit()
  python motion_kit.py check page.html|dir            lint: typos, missing kit, sticky breakers, reduced-motion gaps
  python motion_kit.py detect page.html | list | boot
Options: --modules a,b (add modules)  --all  --no-min
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.normpath(os.path.join(HERE, '..', 'assets', 'src'))
MIN_DIR = os.path.normpath(os.path.join(HERE, '..', 'assets', 'min'))


def _read(p):
    with open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()


def _write(p, text):
    with open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(text)


MANIFEST = json.loads(_read(os.path.join(SRC, 'manifest.json')))
MODULES = MANIFEST['modules']
BY_NAME = {m['name']: m for m in MODULES}
VERSION = MANIFEST['version']

BOOT = ("<script>/* motion-kit:boot */(function(d){var r=d.documentElement,f=0;r.classList.add('mk-js');"
        "try{f=sessionStorage.getItem('mk-pt')}catch(e){}if(f||/(^|\\|)mk-pt$/.test(window.name))r.classList.add('mk-pt-in');"
        "setTimeout(function(){if(!window.MotionKit)r.classList.remove('mk-js','mk-pt-in')},4000)})(document)</script>")

HEAD_START, HEAD_END = '<!-- motion-kit:head -->', '<!-- /motion-kit:head -->'
JS_START, JS_END = '<!-- motion-kit:js -->', '<!-- /motion-kit:js -->'

# ---------------------------------------------------------------- parsing helpers
TAG_RE = re.compile(r'''<([a-zA-Z][\w:.-]*)((?:\s+(?:[^\s"'>/=]+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|\{[^}]*\}|[^\s"'=<>`]+))?)*)\s*/?>''')
ATTR_RE = re.compile(r'''([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([^}]*)\}|([^\s"'=<>`]+)))?''')
JSX_LIT_RE = re.compile(r'''^(["'`])([^"'`$]*)\1$''')


def _blank(s):
    return re.sub(r'[^\n]', ' ', s)


def blocks(src, tag):
    return [{'attrs': m.group(1), 'body': m.group(2)}
            for m in re.finditer(r'<' + tag + r'\b([^>]*)>([\s\S]*?)</' + tag + '>', src, re.I)]


def is_ours(text):
    return re.search(r'motion-kit:(boot|head|js)|Motion Kit v\d|window\.MotionKit\s*=|MotionKit\.register\(', text) is not None


def parse_tags(src):
    """Every start tag (HTML or JSX-ish): [{'tag', 'attrs': {name: value}, 'line'}]"""
    clean = re.sub(r'<!--[\s\S]*?-->', lambda m: _blank(m.group(0)), src)
    no_scripts = re.sub(r'(<script\b[^>]*>)([\s\S]*?)(</script>)', lambda m: m.group(1) + _blank(m.group(2)) + m.group(3), clean, flags=re.I)
    no_scripts = re.sub(r'(<style\b[^>]*>)([\s\S]*?)(</style>)', lambda m: m.group(1) + _blank(m.group(2)) + m.group(3), no_scripts, flags=re.I)
    tags = []
    for m in TAG_RE.finditer(no_scripts):
        attrs = {}
        for a in ATTR_RE.finditer(m.group(2) or ''):
            jsx = a.group(4).strip() if a.group(4) is not None else None
            lit = JSX_LIT_RE.match(jsx) if jsx else None
            if a.group(2) is not None:
                v = a.group(2)
            elif a.group(3) is not None:
                v = a.group(3)
            elif jsx is not None:
                v = lit.group(2) if lit else '{' + jsx + '}'
            elif a.group(5) is not None:
                v = a.group(5)
            else:
                v = ''
            attrs[a.group(1)] = v
        line = no_scripts.count('\n', 0, m.start()) + 1
        tags.append({'tag': m.group(1).lower(), 'attrs': attrs, 'line': line})
    return tags


def _classes(attrs):
    return [c for c in re.split(r'\s+', attrs.get('class') or attrs.get('className') or '') if c]


def _dynamic(v):
    return re.search(r'[${}]', v) is not None


# ---------------------------------------------------------------- module resolution
def detect(src):
    src = re.sub(r'<!--[\s\S]*?-->', '', remove_injected(src))
    tags = parse_tags(src)
    found = ['core']
    all_classes = set()
    for t in tags:
        all_classes.update(_classes(t['attrs']))
    all_classes.update(re.findall(r'\bmk-[a-z][a-z0-9-]*', src))
    for mod in MODULES:
        if mod.get('always'):
            continue
        attr_hit = any(any(name in t['attrs'] for t in tags) or re.search(r'\b' + name + r'\s*[=\s>]', src)
                       for name in mod.get('attrs', []))
        class_hit = any(c in all_classes for c in mod.get('classes', []))
        code_hit = any(c in src for c in mod.get('code', []))
        when_hit = False
        for attr, vals in (mod.get('when') or {}).items():
            if any(attr in t['attrs'] and (_dynamic(t['attrs'][attr]) or t['attrs'][attr].strip() in vals) for t in tags) or \
                    any(re.search(r'\b' + attr + r'''\s*=\s*["'{`]?\s*["'`]?''' + v + r'\b', src) for v in vals):
                when_hit = True
        if attr_hit or class_hit or code_hit or when_hit:
            found.append(mod['name'])
    bg_types = []
    for t in tags:
        if 'data-bg' in t['attrs']:
            bg_types += [x for x in re.split(r'\s+', t['attrs']['data-bg']) if x]
    for s in re.findall(r'''data-bg\s*=\s*["'{]([^"'}]*)''', src):
        bg_types += [x for x in re.split(r'\s+', s) if x]
    for b in bg_types:
        if 'bg-' + b in BY_NAME:
            found.append('bg-' + b)
    return resolve(found)


def resolve(names):
    want = {'core'}

    def add(n):
        m = BY_NAME.get(n)
        if not m:
            raise ValueError('Unknown module "%s". Run "list" to see modules.' % n)
        if n in want and n != 'core':
            return
        want.add(n)
        for dep in m.get('deps', []):
            add(dep)

    for n in names:
        if n == 'all':
            want.update(m['name'] for m in MODULES)
        else:
            add(n)
    return [m['name'] for m in MODULES if m['name'] in want]


# ---------------------------------------------------------------- bundling
def minify_js(js):
    js = re.sub(r'/\*(?!!)[\s\S]*?\*/', '', js)
    return '\n'.join(l.strip() for l in js.split('\n') if l.strip() and not l.strip().startswith('//'))


def minify_css(css):
    css = re.sub(r'/\*(?!!)[\s\S]*?\*/', '', css)
    css = re.sub(r'\s+', ' ', css)
    css = re.sub(r'\s*([{};])\s*', r'\1', css)
    return css.replace(';}', '}').strip()


def _src(rel):
    return _read(os.path.join(SRC, rel))


def _min(rel, kind):
    p = os.path.join(MIN_DIR, rel)
    if os.path.exists(p):
        return _read(p)
    return minify_js(_src(rel)) if kind == 'js' else minify_css(_src(rel))


def build(names, min_=False):
    mods = resolve(names)
    header = '/*! Motion Kit v%s | modules: %s | MIT | web-motion-graphics skill */\n' % (VERSION, ', '.join(mods))

    def pick(kind):
        parts = [(_min(BY_NAME[n][kind], kind) if min_ else _src(BY_NAME[n][kind])).strip() for n in mods if BY_NAME[n].get(kind)]
        return (';\n' if kind == 'js' else '\n').join(parts)

    return {'css': header + pick('css') + '\n', 'js': header + pick('js') + '\n', 'modules': mods}


def _json_str(s):
    return json.dumps(s, ensure_ascii=False)


def react_module(names, min_=True):
    b = build(names, min_)
    return ('// @ts-nocheck\n'
            '// Motion Kit for React (generated by the web-motion-graphics skill; modules: ' + ', '.join(b['modules']) + ').\n'
            "// Usage: import { useMotionKit } from './motion-kit-react'; call useMotionKit() once in your root/layout\n"
            '// component (a "use client" component in Next.js). Then use data-motion / data-text / data-bg ... in JSX.\n'
            "import { useEffect } from 'react';\n\n"
            'export const MOTION_KIT_CSS = ' + _json_str(b['css']) + ';\n'
            'export const MOTION_KIT_JS = ' + _json_str(b['js']) + ';\n\n'
            'export function useMotionKit() {\n'
            '  useEffect(() => {\n'
            '    if (window.MotionKit) { window.MotionKit.refresh(); return; }\n'
            "    document.documentElement.classList.add('mk-js');\n"
            "    const style = document.createElement('style');\n"
            "    style.id = 'motion-kit-css';\n"
            '    style.textContent = MOTION_KIT_CSS;\n'
            '    document.head.prepend(style);\n'
            "    const script = document.createElement('script');\n"
            "    script.id = 'motion-kit-js';\n"
            '    script.textContent = MOTION_KIT_JS;\n'
            '    document.body.appendChild(script);\n'
            '  }, []);\n'
            '}\n\n'
            'export default useMotionKit;\n')


REACT_DTS = ('export declare const MOTION_KIT_CSS: string;\n'
             'export declare const MOTION_KIT_JS: string;\n'
             'export declare function useMotionKit(): void;\n'
             'export default useMotionKit;\n')


# ---------------------------------------------------------------- html injection
def remove_injected(html):
    html = re.sub(r'\s*' + re.escape(HEAD_START) + r'[\s\S]*?' + re.escape(HEAD_END), '', html)
    html = re.sub(r'\s*' + re.escape(JS_START) + r'[\s\S]*?' + re.escape(JS_END) + r'\n?', '', html)
    html = re.sub(r'\s*<script>/\* motion-kit:boot \*/[\s\S]*?</script>', '', html)
    html = re.sub(r'\s*<link\b[^>]*data-motion-kit[^>]*>', '', html)
    return re.sub(r'\s*<script\b[^>]*data-motion-kit[^>]*></script>', '', html)


def _insert_head(html, snippet):
    for pat, wrap in ((r'<meta\s+charset[^>]*>', False), (r'<head\b[^>]*>', False), (r'<html\b[^>]*>', True)):
        m = re.search(pat, html, re.I)
        if m:
            i = m.end()
            if wrap:
                return html[:i] + '\n<head>\n' + snippet + '\n</head>' + html[i:]
            return html[:i] + '\n' + snippet + html[i:]
    return snippet + '\n' + html


def _insert_body_end(html, snippet):
    m = re.search(r'</body>', html, re.I)
    if m:
        return html[:m.start()] + '\n' + snippet + '\n' + html[m.start():]
    m = re.search(r'</html>', html, re.I)
    if m:
        return html[:m.start()] + snippet + '\n' + html[m.start():]
    return html + '\n' + snippet + '\n'


def inline_html(html, all_=False, modules=(), min_=True):
    clean = remove_injected(html)
    names = ['all'] if all_ else list(dict.fromkeys(detect(clean) + list(modules)))
    b = build(names, min_)
    out = _insert_head(clean, HEAD_START + '\n' + BOOT + '\n<style id="motion-kit-css">\n' + b['css'] + '</style>\n' + HEAD_END)
    out = _insert_body_end(out, JS_START + '\n<script id="motion-kit-js">\n' + b['js'] + '</script>\n' + JS_END)
    return {'html': out, 'modules': b['modules'], 'bytes': len(b['css']) + len(b['js'])}


def link_html(html, rel_dir):
    clean = remove_injected(html)
    href = re.sub(r'/?$', '/', rel_dir.replace('\\', '/'), count=1) if rel_dir else ''
    snippet = (HEAD_START + '\n' + BOOT + '\n'
               '<link rel="stylesheet" href="' + href + 'motion-kit.css" data-motion-kit>\n'
               '<script src="' + href + 'motion-kit.js" defer data-motion-kit></script>\n' + HEAD_END)
    return _insert_head(clean, snippet)


# ---------------------------------------------------------------- lint
def _lev(a, b):
    dp = [[i] + [0] * len(b) for i in range(len(a) + 1)]
    for j in range(1, len(b) + 1):
        dp[0][j] = j
    for i in range(1, len(a) + 1):
        for j in range(1, len(b) + 1):
            dp[i][j] = min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (0 if a[i - 1] == b[j - 1] else 1))
    return dp[len(a)][len(b)]


def _suggest(value, candidates):
    best, best_d = None, 99
    for c in candidates:
        d = _lev(value, c)
        if d < best_d:
            best, best_d = c, d
    return best if best_d <= 3 else None


def _js_parse_float_ok(s):
    return re.match(r'\s*[+-]?(\d+\.?\d*|\.\d+)', s) is not None


COUNTED_ATTRS = [a for a in dict.fromkeys(a for m in MODULES for a in m.get('attrs', []))
                 if a not in ('data-motion', 'data-motion-children', 'data-text', 'data-bg')]


def check(src, file='input'):
    issues = []
    counts = {}

    def add(level, line, msg):
        issues.append({'level': level, 'line': line, 'msg': msg})

    def count(k):
        counts[k] = counts.get(k, 0) + 1

    tags = parse_tags(src)
    values = MANIFEST['values']
    bg_types = [m['bg'] for m in MODULES if m.get('bg')]
    for t in tags:
        A, line = t['attrs'], t['line']
        for name, allowed in values.items():
            if name not in A or _dynamic(A[name]):
                continue
            val = A[name].strip()
            if val not in allowed:
                opts = [x for x in allowed if x]
                s = _suggest(val, opts)
                add('error', line, '%s="%s" is not a Motion Kit value%s (allowed: %s)' % (name, val, ' - did you mean "%s"?' % s if s else '', ', '.join(opts)))
        if 'data-bg' in A and not _dynamic(A['data-bg']):
            for b in [x for x in re.split(r'\s+', A['data-bg']) if x]:
                if b not in bg_types:
                    s = _suggest(b, bg_types)
                    add('error', line, 'data-bg="%s" is not a background type%s (types: %s)' % (b, ' - did you mean "%s"?' % s if s else '', ', '.join(bg_types)))
                count('bg:' + b)
        if 'data-count-to' in A and not _dynamic(A['data-count-to']) and not _js_parse_float_ok(re.sub(r'[, _]', '', A['data-count-to'])):
            add('error', line, 'data-count-to="%s" must be a number' % A['data-count-to'])
        if A.get('data-text') == 'rotate' and not A.get('data-words'):
            add('error', line, 'data-text="rotate" needs data-words="one|two|three"')
        if 'data-cursor' in A and t['tag'] not in ('body', 'html'):
            add('warn', line, 'data-cursor belongs on <body>')
        if 'data-transition' in A and t['tag'] not in ('body', 'html'):
            add('warn', line, 'data-transition belongs on <body>')
        if 'data-motion' in A and any(x in A for x in ('data-parallax', 'data-mouse-parallax', 'data-magnetic', 'data-tilt')):
            add('warn', line, 'data-motion shares an element with parallax/magnetic/tilt - both move the element; put one of them on a wrapper')
        if 'data-parallax' in A and 'data-scrub' in A:
            add('warn', line, 'data-parallax and data-scrub on the same element fight over transforms')
        if 'data-motion' in A:
            count('reveal')
        if 'data-motion-children' in A:
            count('reveal-group')
        if 'data-text' in A:
            count('text:' + A['data-text'])
        for k in COUNTED_ATTRS:
            if k in A:
                count(k.replace('data-', '', 1))

    used = [n for n in detect(src) if n != 'core']
    has_kit = re.search(r'Motion Kit v\d|motion-kit\.js|window\.MotionKit\s*=|MotionKit\.register\(', src) is not None
    if used and not has_kit:
        add('error', 0, 'Motion Kit attributes are used but the kit is not included - run "inline" or "link" on this file (or load motion-kit.js)')
    if used and has_kit and 'mk-js' not in src:
        add('warn', 0, 'no <head> boot snippet - content may flash before animating (run "inline"/"link", or add the "boot" snippet)')
    if len([t for t in tags if 'data-loader' in t['attrs']]) > 1:
        add('warn', 0, 'more than one data-loader on the page')
    canvas_bgs = sum(v for k, v in counts.items() if k.startswith('bg:') and k not in ('bg:aurora', 'bg:gradient', 'bg:noise'))
    if canvas_bgs > 3:
        add('warn', 0, '%d canvas/WebGL backgrounds on one page - keep it to 1-3 for smooth scrolling on laptops/phones' % canvas_bgs)

    css = '\n'.join(b['body'] for b in blocks(src, 'style') if not is_ours(b['body'])) + '\n' + ';'.join(t['attrs'].get('style', '') for t in tags)
    uses_sticky = 'story' in used or re.search(r'position\s*:\s*sticky', css)
    if uses_sticky and re.search(r'(?:^|[}\s,])(?:html|body)\s*(?:,[^{]*)?\{[^}]*overflow(?:-x|-y)?\s*:\s*(?:hidden|auto|scroll)', css, re.I):
        add('warn', 0, 'html/body has overflow hidden/auto - this breaks position: sticky (data-horizontal, data-steps, sticky headers). Use overflow-x: clip instead')
    layout = ['width', 'height', 'top', 'left', 'right', 'bottom', 'margin', 'padding', 'max-height', 'max-width',
              'margin-top', 'margin-left', 'padding-top', 'padding-left']
    layout_props = []
    for m in re.finditer(r'transition(?:-property)?\s*:([^;}]*)', css, re.I):
        for part in m.group(1).split(','):
            prop = re.split(r'\s+', part.strip())[0]
            if prop in layout and prop not in layout_props:
                layout_props.append(prop)
    if layout_props:
        add('warn', 0, 'author CSS transitions %s - animate transform/opacity instead for smooth 60fps' % ', '.join(layout_props))
    if '@keyframes' in css and 'prefers-reduced-motion' not in css:
        add('warn', 0, 'author CSS defines @keyframes but has no @media (prefers-reduced-motion: reduce) rule - disable decorative loops for users who ask for less motion')
    for u in re.findall(r'''<script[^>]+src=["']([^"']+)["']''', src, re.I):
        if re.match(r'https?:', u) and 'cdnjs.cloudflare.com' not in u:
            add('info', 0, 'external script %s - Claude.ai artifacts only allow cdnjs.cloudflare.com; fine for real sites' % u)
    return {'file': file, 'issues': issues, 'counts': counts,
            'reveals': counts.get('reveal', 0) + counts.get('reveal-group', 0), 'effectKinds': len(counts), 'modules': used}


def _print_check(r):
    icon = {'error': 'x', 'warn': '!', 'info': 'i'}
    print('\n' + r['file'])
    summary = ', '.join('%s%s' % (k, ' x%d' % v if v > 1 else '') for k, v in r['counts'].items())
    print('  effects (%d kinds): %s' % (r['effectKinds'], summary or 'none'))
    print('  modules: %s' % (', '.join(r['modules']) or 'none'))
    if not r['issues']:
        print('  OK - no problems found')
    for i in r['issues']:
        print('  [%s] %s%s' % (icon[i['level']], 'line %d: ' % i['line'] if i['line'] else '', i['msg']))
    if r['effectKinds'] and r['effectKinds'] < 4:
        print('  tip: most polished sites combine 4-8 kinds of motion (hero text, reveals, background, hover, counters/marquee)')


# ---------------------------------------------------------------- cli
SRC_EXT = ['.html', '.htm', '.jsx', '.tsx', '.js', '.ts', '.vue', '.svelte', '.astro', '.php', '.erb', '.hbs', '.njk', '.liquid']


def _list_files(target, exts):
    if os.path.isfile(target):
        return [target]
    out = []
    for name in sorted(os.listdir(target)):
        if name in ('node_modules', '.git', 'dist', 'build', '.next'):
            continue
        p = os.path.join(target, name)
        if os.path.isdir(p):
            out += _list_files(p, exts)
        elif os.path.splitext(name)[1].lower() in exts:
            out.append(p)
    return out


def _parse_args(argv):
    args = {'_': []}
    i = 0
    while i < len(argv):
        a = argv[i]
        if a.startswith('--'):
            key = a[2:]
            nxt = argv[i + 1] if i + 1 < len(argv) else None
            if nxt is not None and not nxt.startswith('--') and key in ('out', 'modules', 'from'):
                args[key] = nxt
                i += 1
            else:
                args[key] = True
        else:
            args['_'].append(a)
        i += 1
    return args


def main(argv):
    args = _parse_args(argv)
    cmd = args['_'].pop(0) if args['_'] else None
    min_ = not args.get('no-min')
    extra = [s.strip() for s in str(args['modules']).split(',') if s.strip()] if isinstance(args.get('modules'), str) else []
    if not cmd or cmd == 'help' or args.get('help'):
        print(__doc__)
        return 0
    if cmd == 'list':
        print('Motion Kit v%s modules:\n' % VERSION)
        for m in MODULES:
            print('  %s %s' % (m['name'].ljust(13), m['desc']))
        print('\nValid values:')
        for k, v in MANIFEST['values'].items():
            print('  %s: %s' % (k, ' '.join(x for x in v if x)))
        return 0
    if cmd == 'boot':
        print(BOOT)
        return 0
    if cmd == 'detect':
        for f in args['_']:
            print('%s: %s' % (f, ', '.join(detect(_read(f)))))
        return 0
    if cmd == 'inline':
        if not args['_']:
            print('usage: inline <file.html> [--all] [--modules a,b] [--no-min]', file=sys.stderr)
            return 2
        for f in args['_']:
            r = inline_html(_read(f), all_=bool(args.get('all')), modules=extra, min_=min_)
            _write(f, r['html'])
            print('inlined Motion Kit into %s (%.1f KB): %s' % (f, r['bytes'] / 1024, ', '.join(r['modules'])))
        return 0
    if cmd == 'link':
        if not args['_']:
            print('usage: link <a.html> [b.html ...] [--out dir] [--detect]', file=sys.stderr)
            return 2
        out_dir = os.path.abspath(args['out'] if isinstance(args.get('out'), str) else os.path.join(os.path.dirname(args['_'][0]), 'motion-kit'))
        names = ['all']
        if args.get('detect'):
            names = list(dict.fromkeys([n for f in args['_'] for n in detect(_read(f))] + extra))
        b = build(names, min_)
        os.makedirs(out_dir, exist_ok=True)
        _write(os.path.join(out_dir, 'motion-kit.css'), b['css'])
        _write(os.path.join(out_dir, 'motion-kit.js'), b['js'])
        for f in args['_']:
            rel = os.path.relpath(out_dir, os.path.dirname(os.path.abspath(f)))
            rel = '' if rel == '.' else rel
            _write(f, link_html(_read(f), rel))
            print('linked %s -> %s/motion-kit.{css,js}' % (f, rel.replace('\\', '/') or '.'))
        print('wrote %s (%d modules)' % (out_dir, len(b['modules'])))
        return 0
    if cmd in ('bundle', 'react'):
        names = ['all']
        if isinstance(args.get('from'), str):
            names = list(dict.fromkeys([n for f in _list_files(args['from'], SRC_EXT) for n in detect(_read(f))] + extra))
        elif extra:
            names = extra
        if cmd == 'react':
            code = react_module(names, min_)
            if isinstance(args.get('out'), str):
                target = os.path.abspath(args['out']) if re.search(r'\.(m?js|jsx)$', args['out']) else os.path.join(os.path.abspath(args['out']), 'motion-kit-react.js')
                os.makedirs(os.path.dirname(target), exist_ok=True)
                _write(target, code)
                _write(re.sub(r'\.(m?js|jsx)$', '.d.ts', target), REACT_DTS)
                print('wrote %s (+ .d.ts), %.1f KB - import { useMotionKit } from it and call useMotionKit() once' % (target, len(code) / 1024))
            else:
                sys.stdout.write(code)
            return 0
        out_dir = os.path.abspath(args['out'] if isinstance(args.get('out'), str) else '.')
        b = build(names, min_)
        os.makedirs(out_dir, exist_ok=True)
        _write(os.path.join(out_dir, 'motion-kit.css'), b['css'])
        _write(os.path.join(out_dir, 'motion-kit.js'), b['js'])
        print('wrote %s and motion-kit.js (%d modules: %s)' % (os.path.join(out_dir, 'motion-kit.css'), len(b['modules']), ', '.join(b['modules'])))
        print('add to <head>:\n' + BOOT + '\n<link rel="stylesheet" href="/motion-kit.css">\n<script src="/motion-kit.js" defer></script>')
        return 0
    if cmd == 'check':
        errors = 0
        for t in (args['_'] or ['.']):
            for f in _list_files(t, ['.html', '.htm']):
                r = check(_read(f), f)
                _print_check(r)
                errors += len([i for i in r['issues'] if i['level'] == 'error'])
        print('\n%d error(s)' % errors if errors else '\nall good')
        return 1 if errors else 0
    print('unknown command "%s" - try: list, inline, link, bundle, react, check, detect, boot' % cmd, file=sys.stderr)
    return 2


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
