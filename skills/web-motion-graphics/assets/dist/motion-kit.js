/*! Motion Kit v2.0.0 | modules: core, reveal, text, text-scramble, text-typewriter, text-rotate, text-fx, text-particles, circle-text, counter, parallax, scroll, story, scrollfx, magnetic, tilt, spotlight, ripple, holo, cursor, trail, image-trail, widgets, marquee, draw, loader, transition, confetti, effects-ambient, effects-text, effects-surface, effects-hover, effects-interactive, bg, bg-gl, bg-particles, bg-stars, bg-waves, bg-matrix, bg-grid, bg-dots, bg-bokeh, bg-snow, bg-aurora, bg-gradient, bg-noise, bg-liquid, bg-fluid, bg-blobs, bg-orb, bg-beams, bg-tunnel, bg-globe, bg-galaxy, bg-warp, bg-flow | MIT | web-motion-graphics skill */
/*!
 * Motion Kit v2.0.0 - zero-dependency motion graphics for websites.
 * Part of the "web-motion-graphics" Claude skill. MIT License.
 * Usage: add data-attributes (data-motion, data-text, data-bg, ...) to your HTML.
 */
(function (w, d) {
  'use strict';
  if (w.MotionKit && w.MotionKit.__core) return;

  var root = d.documentElement;
  root.classList.add('mk-js');

  var cfg = w.MotionKitConfig || {};
  var mm = function (q) { return w.matchMedia ? w.matchMedia(q) : { matches: false }; };
  var reduceMQ = mm('(prefers-reduced-motion: reduce)');
  var fineMQ = mm('(hover: hover) and (pointer: fine)');

  var defs = [];
  var registry = new Map();
  var started = false;
  var holds = 0;
  var readyQueue = [];

  var MK = {
    __core: true,
    version: '2.0.0',
    reduced: cfg.reduced != null ? !!cfg.reduced : (reduceMQ.matches || root.hasAttribute('data-motion-reduce')),
    finePointer: cfg.finePointer != null ? !!cfg.finePointer : fineMQ.matches,
    debug: !!cfg.debug,
    scrollY: 0,
    scrollVelocity: 0,
    bgs: {}
  };
  if (MK.reduced) root.classList.add('mk-reduced');

  // ---------- small utils ----------
  MK.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  MK.lerp = function (a, b, t) { return a + (b - a) * t; };
  MK.attr = function (el, name, fallback) {
    var v = el.getAttribute(name);
    return v == null || v === '' ? fallback : v;
  };
  MK.num = function (el, name, fallback) {
    var v = parseFloat(el.getAttribute(name));
    return isNaN(v) ? fallback : v;
  };
  MK.has = function (el, name) { return el.hasAttribute(name); };
  MK.warn = function () {
    if (w.console) console.warn.apply(console, ['[MotionKit]'].concat([].slice.call(arguments)));
  };
  MK.log = function () {
    if (MK.debug && w.console) console.log.apply(console, ['[MotionKit]'].concat([].slice.call(arguments)));
  };
  MK.cssVar = function (el, name, fallback) {
    var v = getComputedStyle(el).getPropertyValue(name).trim();
    return v || fallback;
  };
  // Colors for backgrounds & effects: data-bg-colors="#a,#b" > --mk-c1..3 > defaults
  MK.colors = function (el, attr, defaults) {
    var raw = el.getAttribute(attr || 'data-bg-colors');
    if (raw) return raw.split(/\s*[,|]\s*/).filter(Boolean);
    var cs = getComputedStyle(el);
    var out = [];
    for (var i = 1; i <= 4; i++) {
      var c = cs.getPropertyValue('--mk-c' + i).trim();
      if (c) out.push(c);
    }
    return out.length ? out : (defaults || ['#8b5cf6', '#06b6d4', '#f472b6']);
  };
  MK.ms = function (el, name, fallback) {
    var v = el.getAttribute(name);
    if (v == null || v === '') return fallback;
    var n = parseFloat(v);
    if (isNaN(n)) return fallback;
    return /[0-9.]s$/.test(v.trim()) && !/ms$/.test(v.trim()) ? n * 1000 : n;
  };
  MK.easings = {
    smooth: 'cubic-bezier(.16,1,.3,1)',
    snappy: 'cubic-bezier(.2,.9,.1,1)',
    bounce: 'cubic-bezier(.34,1.56,.64,1)',
    'in-out': 'cubic-bezier(.65,0,.35,1)',
    linear: 'linear',
    ease: 'ease'
  };
  MK.ease = function (name) {
    if (!name) return null;
    return MK.easings[name] || (/[(]/.test(name) ? name : null);
  };
  MK.easeOutExpo = function (t) { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); };
  MK.easeInOutCubic = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  MK.ensurePositioned = function (el) {
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
  };
  MK.emit = function (el, name, detail) {
    try { el.dispatchEvent(new CustomEvent('motionkit:' + name, { bubbles: true, detail: detail })); } catch (e) {}
  };

  // ---------- ready gate (loaders hold animations until the page is revealed) ----------
  MK.hold = function () { holds++; };
  MK.release = function () {
    holds = Math.max(0, holds - 1);
    if (!holds) {
      var q = readyQueue; readyQueue = [];
      q.forEach(function (fn) { try { fn(); } catch (e) { MK.warn(e); } });
      MK.emit(d, 'ready');
    }
  };
  MK.whenReady = function (fn) { if (holds) readyQueue.push(fn); else fn(); };
  MK.isHeld = function () { return holds > 0; };

  // ---------- viewport observers ----------
  var ioCache = {};
  MK.inView = function (el, cb, opts) {
    opts = opts || {};
    var key = (opts.rootMargin || '0px') + '|' + (opts.threshold || 0);
    var rec = ioCache[key];
    if (!rec) {
      var map = new Map();
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          var set = map.get(e.target);
          if (set) set.forEach(function (f) { f(e.isIntersecting, e); });
        });
      }, { rootMargin: opts.rootMargin || '0px', threshold: opts.threshold || 0 });
      rec = ioCache[key] = { io: io, map: map };
    }
    var set = rec.map.get(el);
    if (!set) { set = new Set(); rec.map.set(el, set); }
    set.add(cb);
    rec.io.observe(el);
    return function () {
      var s = rec.map.get(el);
      if (!s) return;
      s.delete(cb);
      if (!s.size) { rec.map.delete(el); rec.io.unobserve(el); }
    };
  };
  // Fires cb once, the first time el enters the viewport (and the ready gate is open).
  MK.onEnter = function (el, cb, opts) {
    var done = false;
    var off = MK.inView(el, function (inside) {
      if (!inside || done) return;
      done = true;
      off();
      MK.whenReady(cb);
    }, opts || { rootMargin: '0px 0px -10% 0px' });
    return off;
  };

  // ---------- shared scroll/resize tick ----------
  var scrollSubs = new Set();
  var ticking = false;
  var lastY = w.pageYOffset || 0;
  function tick() {
    ticking = false;
    var y = w.pageYOffset || root.scrollTop || 0;
    MK.scrollVelocity = y - lastY;
    lastY = y;
    MK.scrollY = y;
    var vh = w.innerHeight;
    scrollSubs.forEach(function (fn) { try { fn(y, vh); } catch (e) { MK.warn(e); } });
  }
  function requestTick() { if (!ticking) { ticking = true; w.requestAnimationFrame(tick); } }
  w.addEventListener('scroll', requestTick, { passive: true });
  w.addEventListener('resize', requestTick);
  MK.onScroll = function (fn) {
    scrollSubs.add(fn);
    requestTick();
    return function () { scrollSubs.delete(fn); };
  };
  MK.update = requestTick;

  // ---------- continuous animation loop that pauses off-screen / in hidden tabs ----------
  // fn(timeMs, dtMs). Returns a stop() function.
  MK.ticker = function (el, fn, opts) {
    opts = opts || {};
    var visible = !el, raf = 0, last = 0, stopped = false;
    function frame(t) {
      raf = 0;
      if (stopped || !visible || d.hidden) return;
      var dt = last ? Math.min(t - last, 64) : 16;
      last = t;
      fn(t, dt);
      raf = w.requestAnimationFrame(frame);
    }
    function kick() { if (!raf && visible && !d.hidden && !stopped) { last = 0; raf = w.requestAnimationFrame(frame); } }
    var offView = el ? MK.inView(el, function (inside) { visible = inside; kick(); }, { rootMargin: opts.rootMargin || '100px' }) : null;
    var onVis = function () { kick(); };
    d.addEventListener('visibilitychange', onVis);
    kick();
    return function () {
      stopped = true;
      if (raf) w.cancelAnimationFrame(raf);
      if (offView) offView();
      d.removeEventListener('visibilitychange', onVis);
    };
  };

  // ---------- pointer tracking (shared) ----------
  MK.pointer = { x: w.innerWidth / 2, y: w.innerHeight / 2, active: false };
  w.addEventListener('pointermove', function (e) {
    MK.pointer.x = e.clientX; MK.pointer.y = e.clientY; MK.pointer.active = true;
  }, { passive: true });
  d.addEventListener('pointerleave', function () { MK.pointer.active = false; });

  // ---------- module registry ----------
  // def = { name, selector, init(el, MK) -> optional cleanup fn }
  function initEl(def, el) {
    var m = registry.get(el);
    if (!m) { m = new Map(); registry.set(el, m); }
    if (m.has(def.name)) return;
    m.set(def.name, null);
    try {
      var cleanup = def.init(el, MK);
      if (typeof cleanup === 'function') m.set(def.name, cleanup);
      MK.log('init', def.name, el);
    } catch (e) {
      MK.warn(def.name + ' failed on', el, e);
    }
  }
  MK.initEl = function (name, el) {
    for (var i = 0; i < defs.length; i++) if (defs[i].name === name) return initEl(defs[i], el);
  };
  // tear down one module on one element and set it up again (e.g. after its options changed)
  MK.reinit = function (name, el) {
    var m = registry.get(el);
    if (m && m.has(name)) {
      var c = m.get(name);
      m.delete(name);
      if (c) try { c(); } catch (e) {}
    }
    MK.initEl(name, el);
  };
  MK.isStarted = function () { return started; };
  function scanDef(def, node) {
    if (node.nodeType === 1 && node.matches(def.selector)) initEl(def, node);
    if (node.querySelectorAll) {
      var list = node.querySelectorAll(def.selector);
      for (var i = 0; i < list.length; i++) initEl(def, list[i]);
    }
  }
  MK.register = function (def) {
    defs.push(def);
    if (started) scanDef(def, d);
  };
  MK.scan = function (node) {
    node = node || d;
    defs.forEach(function (def) { scanDef(def, node); });
  };
  MK.destroy = function (node) {
    registry.forEach(function (m, el) {
      if (node && node !== el && !(node.contains && node.contains(el))) return;
      m.forEach(function (cleanup) { if (cleanup) try { cleanup(); } catch (e) {} });
      registry.delete(el);
    });
  };
  function sweep() {
    registry.forEach(function (m, el) {
      if (el.isConnected || el === d || el === w) return;
      m.forEach(function (cleanup) { if (cleanup) try { cleanup(); } catch (e) {} });
      registry.delete(el);
    });
  }
  MK.refresh = function () { sweep(); MK.scan(d); requestTick(); };
  MK.stats = function () {
    var out = {};
    registry.forEach(function (m) { m.forEach(function (_, name) { out[name] = (out[name] || 0) + 1; }); });
    return out;
  };

  var sweepQueued = false;
  MK.start = function () {
    if (started) return;
    started = true;
    MK.scan(d);
    if (w.MutationObserver && d.body) {
      new MutationObserver(function (records) {
        var removed = false;
        records.forEach(function (r) {
          for (var i = 0; i < r.addedNodes.length; i++) {
            var n = r.addedNodes[i];
            if (n.nodeType === 1 && !(n.classList && n.classList.contains('mk-internal'))) MK.scan(n);
          }
          if (r.removedNodes.length) removed = true;
        });
        if (removed && !sweepQueued) {
          sweepQueued = true;
          setTimeout(function () { sweepQueued = false; sweep(); }, 50);
        }
      }).observe(d.body, { childList: true, subtree: true });
    }
    requestTick();
    MK.emit(d, 'start');
  };

  w.MotionKit = MK;

  function boot() { if (cfg.autoStart !== false) MK.start(); }
  // Defer to a microtask so every module in this bundle registers before the first scan.
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot);
  else (w.queueMicrotask || function (f) { Promise.resolve().then(f); })(boot);
})(window, document);;
/* Motion Kit - reveal: scroll-triggered entrance animations
 *   <div data-motion="fade-up">                         single element
 *   <ul data-motion-children="zoom-in">                  every direct child, auto-staggered
 *   <div data-motion-stagger="100"> <div data-motion>... children entering together are staggered
 * Options: data-motion-delay="200" data-motion-duration="1200" data-motion-distance="80px"
 *          data-motion-ease="smooth|snappy|bounce|in-out|linear" data-motion-repeat
 */
(function (MK) {
  'use strict';
  var io = null;

  function finish(el) {
    el.classList.add('mk-done');
    MK.emit(el, 'revealed');
  }

  function play(list) {
    var groups = new Map();
    list.forEach(function (el) {
      var parent = el.parentElement && el.parentElement.closest('[data-motion-stagger]');
      var key = parent || el;
      if (!groups.has(key)) groups.set(key, { step: parent ? MK.num(parent, 'data-motion-stagger', 90) : 0, els: [] });
      groups.get(key).els.push(el);
    });
    groups.forEach(function (g) {
      var els = g.els;
      // keep the whole group's stagger under ~1s so long grids don't feel slow
      var step = els.length > 1 ? Math.min(g.step, 1000 / (els.length - 1)) : 0;
      els.sort(function (a, b) {
        return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
      });
      els.forEach(function (el, i) {
        var delay = MK.ms(el, 'data-motion-delay', 0) + i * step;
        el.style.setProperty('--mk-delay', delay + 'ms');
        el.classList.remove('mk-done');
        el.classList.add('mk-in');
        var dur = MK.ms(el, 'data-motion-duration', 900);
        clearTimeout(el.__mkRevealT);
        el.__mkRevealT = setTimeout(function () { finish(el); }, delay + dur + 150);
      });
    });
  }

  function getIO() {
    if (io) return io;
    io = new IntersectionObserver(function (entries) {
      var entering = [];
      entries.forEach(function (e) {
        var el = e.target;
        if (e.isIntersecting) {
          if (!el.classList.contains('mk-in')) entering.push(el);
          if (!el.hasAttribute('data-motion-repeat')) io.unobserve(el);
        } else if (el.hasAttribute('data-motion-repeat') && el.classList.contains('mk-in')) {
          clearTimeout(el.__mkRevealT);
          el.classList.remove('mk-in', 'mk-done');
        }
      });
      if (entering.length) MK.whenReady(function () { play(entering); });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });
    return io;
  }

  function setup(el) {
    if (MK.reduced) { el.classList.add('mk-in', 'mk-done'); return; }
    var dur = MK.ms(el, 'data-motion-duration', 0);
    if (dur) el.style.setProperty('--mk-dur', dur + 'ms');
    var dist = el.getAttribute('data-motion-distance');
    if (dist) el.style.setProperty('--mk-dist', /^[0-9.]+$/.test(dist) ? dist + 'px' : dist);
    var ease = MK.ease(el.getAttribute('data-motion-ease'));
    if (ease) el.style.setProperty('--mk-ease', ease);
    el.addEventListener('animationend', function (e) {
      if (e.target === el && el.classList.contains('mk-in')) { clearTimeout(el.__mkRevealT); finish(el); }
    });
    getIO().observe(el);
    return function () { if (io) io.unobserve(el); clearTimeout(el.__mkRevealT); };
  }

  MK.register({
    name: 'reveal',
    selector: '[data-motion],[data-motion-children]',
    init: function (el) {
      var cleanups = [];
      if (el.hasAttribute('data-motion-children')) {
        var preset = el.getAttribute('data-motion-children') || 'fade-up';
        if (!el.hasAttribute('data-motion-stagger')) el.setAttribute('data-motion-stagger', '90');
        Array.prototype.forEach.call(el.children, function (child) {
          if (!child.hasAttribute('data-motion')) child.setAttribute('data-motion', preset);
          MK.initEl('reveal', child);
        });
      }
      if (el.hasAttribute('data-motion')) {
        var c = setup(el);
        if (c) cleanups.push(c);
      }
      return function () { cleanups.forEach(function (f) { f(); }); };
    }
  });
})(window.MotionKit);;
/* Motion Kit - text: animated typography
 *   data-text="reveal"      words rise from a mask (hero headlines)
 *   data-text="fade|blur"   words fade / un-blur in sequence
 *   data-text="chars"       letters pop in one by one
 *   data-text="wave"        letters bob in a continuous wave
 *   data-text="scroll"      words light up as you scroll (Apple-style)
 *   data-text="highlight"   marker highlight sweeps behind the text
 *   data-text="scramble"    decoding / hacker effect   (data-text-trigger="hover" for links)
 *   data-text="typewriter"  types text; data-words="one|two|three" cycles words
 *   data-text="rotate"      cycles data-words="one|two|three" with a slide
 * Options: data-text-delay, data-text-duration, data-text-stagger, data-text-speed, data-text-interval
 */
(function (MK) {
  'use strict';
  var d = document;
  var SKIP = /^(SCRIPT|STYLE|SVG|BR|IMG|INPUT|TEXTAREA|SELECT|CANVAS|VIDEO|IFRAME|PICTURE)$/i;
  var seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
  var MODES = {
    reveal: { by: 'words', stagger: 70, total: 1400 },
    fade: { by: 'words', stagger: 60, total: 1400 },
    blur: { by: 'words', stagger: 70, total: 1400 },
    chars: { by: 'chars', stagger: 28, total: 1300 },
    wave: { by: 'chars', stagger: 0, total: 0 },
    scroll: { by: 'words', stagger: 0, total: 0 }
  };

  function span(cls, text) {
    // a custom tag, so page CSS written for <span> (e.g. ".stats span { font-size: 14px }") can't restyle the pieces
    var s = d.createElement('mk-span');
    s.className = cls;
    if (text != null) s.textContent = text;
    return s;
  }
  function graphemes(str) {
    return seg ? Array.from(seg.segment(str), function (s) { return s.segment; }) : Array.from(str);
  }
  function isClipText(el) {
    if (el.classList.contains('mk-gradient-text') || el.classList.contains('mk-shine')) return true;
    var cs = getComputedStyle(el);
    return cs.webkitBackgroundClip === 'text' || cs.backgroundClip === 'text';
  }
  function addSr(el, text) {
    var old = el.querySelector(':scope > .mk-sr');
    if (old) return old;
    var sr = span('mk-sr', text);
    el.insertBefore(sr, el.firstChild);
    return sr;
  }

  // Split text into animatable spans while keeping inline markup (<em>, <a>, <span class>) intact.
  function split(el, by) {
    if (el.hasAttribute('data-mk-split')) {
      return Array.prototype.slice.call(el.querySelectorAll(by === 'chars' ? '.mk-c' : '.mk-wi'));
    }
    var text = el.textContent.replace(/\s+/g, ' ').trim();
    var units = [];
    var idx = 0;
    function unit(content) {
      var u = span(by === 'chars' ? 'mk-c' : 'mk-wi');
      if (typeof content === 'string') u.textContent = content; else u.appendChild(content);
      u.style.setProperty('--i', idx++);
      units.push(u);
      return u;
    }
    function word(content) {
      var wEl = span('mk-w');
      wEl.setAttribute('aria-hidden', 'true');
      if (typeof content === 'string' && by === 'chars') {
        graphemes(content).forEach(function (ch) { wEl.appendChild(unit(ch)); });
      } else {
        wEl.appendChild(unit(content));
      }
      return wEl;
    }
    function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = d.createDocumentFragment();
          n.nodeValue.split(/(\s+)/).forEach(function (p) {
            if (!p) return;
            frag.appendChild(/^\s+$/.test(p) ? d.createTextNode(' ') : word(p));
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1) {
          if (n.classList.contains('mk-sr') || SKIP.test(n.tagName)) return;
          // gradient-clipped text must stay one piece or the gradient breaks; nested text effects
          // replace their own content, so any nested text effect (except highlight) rides along as a single unit
          if (isClipText(n) || (n.hasAttribute('data-text') && n.getAttribute('data-text') !== 'highlight')) {
            var holder = d.createElement('span');
            node.replaceChild(holder, n);
            holder.parentNode.replaceChild(word(n), holder);
            return;
          }
          walk(n);
        }
      });
    }
    walk(el);
    addSr(el, text);
    el.setAttribute('data-mk-split', by);
    el.style.setProperty('--mk-n', units.length);
    return units;
  }

  function splitMode(el, mode) {
    var cfg = MODES[mode];
    var units = split(el, cfg.by);
    var stagger = MK.ms(el, 'data-text-stagger', cfg.stagger);
    if (cfg.total && units.length > 1) stagger = Math.min(stagger, cfg.total / (units.length - 1));
    el.style.setProperty('--mk-stagger', stagger + 'ms');
    var delay = MK.ms(el, 'data-text-delay', 0);
    if (delay) el.style.setProperty('--mk-delay', delay + 'ms');
    var dur = MK.ms(el, 'data-text-duration', 0);
    if (dur) el.style.setProperty('--mk-dur', dur + 'ms');
    var ease = MK.ease(el.getAttribute('data-text-ease'));
    if (ease) el.style.setProperty('--mk-ease', ease);

    if (mode === 'scroll') return scrollFill(el, units);
    if (MK.reduced) { el.classList.add('mk-in'); return; }
    return MK.onEnter(el, function () { el.classList.add('mk-in'); MK.emit(el, 'text'); });
  }

  function scrollFill(el, units) {
    if (MK.reduced) { units.forEach(function (u) { u.style.opacity = 1; }); return; }
    var active = false;
    var offView = MK.inView(el, function (v) { active = v; if (v) MK.update(); }, { rootMargin: '200px 0px' });
    var last = -1;
    var offScroll = MK.onScroll(function (y, vh) {
      if (!active) return;
      var r = el.getBoundingClientRect();
      var start = vh * 0.85, end = vh * 0.4;
      var p = MK.clamp((start - r.top) / (r.height + start - end), 0, 1);
      if (Math.abs(p - last) < 0.001) return;
      last = p;
      var n = units.length;
      for (var i = 0; i < n; i++) {
        var o = MK.clamp(p * n - i, 0, 1);
        units[i].style.opacity = (0.16 + 0.84 * o).toFixed(3);
      }
    });
    return function () { offView(); offScroll(); };
  }

  function words(el) {
    return (el.getAttribute('data-words') || '').split('|').map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function highlight(el) {
    if (MK.reduced) { el.classList.add('mk-in'); return; }
    return MK.onEnter(el, function () { el.classList.add('mk-in'); });
  }

  // extra modes (scramble, typewriter, rotate) live in their own add-on files and register here
  MK.textModes = MK.textModes || {};
  MK.textModes.highlight = highlight;
  MK.textUtil = { span: span, addSr: addSr, words: words, split: split };

  MK.register({
    name: 'text',
    selector: '[data-text]',
    init: function (el) {
      var mode = (el.getAttribute('data-text') || 'reveal').trim();
      if (MODES[mode]) return splitMode(el, mode);
      if (MK.textModes[mode]) return MK.textModes[mode](el);
      MK.warn('unknown data-text="' + mode + '" (is its add-on included in the bundle?)', el);
    }
  });
  MK.splitText = split;
})(window.MotionKit);;
/* Motion Kit - text add-on: scramble
 *   data-text="scramble"  decoding / hacker effect; data-text-trigger="hover" replays on hover (nav links)
 *   Options: data-text-chars, data-text-duration, data-text-delay
 */
(function (MK) {
  'use strict';
  var d = document;
  var U = MK.textUtil, span = U.span, addSr = U.addSr, words = U.words;
  function scramble(el) {
    var glyphs = MK.attr(el, 'data-text-chars', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=?!<>');
    var original = el.textContent.replace(/\s+/g, ' ').trim();
    if (!el.querySelector(':scope > .mk-scr')) {
      var holder = span('mk-scr');
      holder.setAttribute('aria-hidden', 'true');
      while (el.firstChild) holder.appendChild(el.firstChild);
      el.appendChild(holder);
      addSr(el, original);
    }
    var nodes = [];
    var walker = d.createTreeWalker(el.querySelector(':scope > .mk-scr'), NodeFilter.SHOW_TEXT);
    var n;
    while ((n = walker.nextNode())) if (n.nodeValue.trim()) nodes.push({ n: n, orig: n.nodeValue });
    var total = nodes.reduce(function (s, o) { return s + o.orig.length; }, 0);
    var dur = MK.ms(el, 'data-text-duration', MK.clamp(total * 45, 700, 2200));
    var running = false, raf = 0;

    function run() {
      if (running || MK.reduced) return;
      running = true;
      var start = performance.now(), lastRand = 0, cache = [];
      function frame(now) {
        var p = MK.clamp((now - start) / dur, 0, 1);
        var resolved = Math.floor(MK.easeInOutCubic(p) * total);
        var reroll = now - lastRand > 50;
        if (reroll) lastRand = now;
        var k = 0;
        nodes.forEach(function (o) {
          var s = '';
          for (var i = 0; i < o.orig.length; i++, k++) {
            var ch = o.orig[i];
            if (k < resolved || /\s/.test(ch)) { s += ch; continue; }
            if (reroll || !cache[k]) cache[k] = glyphs[(Math.random() * glyphs.length) | 0];
            s += cache[k];
          }
          o.n.nodeValue = s;
        });
        if (p < 1) raf = requestAnimationFrame(frame);
        else { nodes.forEach(function (o) { o.n.nodeValue = o.orig; }); running = false; MK.emit(el, 'text'); }
      }
      raf = requestAnimationFrame(frame);
    }

    var trigger = MK.attr(el, 'data-text-trigger', 'view');
    var offs = [];
    if (trigger === 'hover') {
      el.addEventListener('pointerenter', run);
      el.addEventListener('focus', run);
      offs.push(function () { el.removeEventListener('pointerenter', run); el.removeEventListener('focus', run); });
    } else {
      offs.push(MK.onEnter(el, function () { setTimeout(run, MK.ms(el, 'data-text-delay', 0)); }));
    }
    return function () { offs.forEach(function (f) { f(); }); cancelAnimationFrame(raf); };
  }

  MK.textModes.scramble = scramble;
})(window.MotionKit);;
/* Motion Kit - text add-on: typewriter
 *   data-text="typewriter"  types the text; data-words="a|b|c" types, deletes and cycles words
 *   Options: data-text-speed="60" data-text-pause="1600" data-text-delay data-text-loop data-text-nocaret
 */
(function (MK) {
  'use strict';
  var d = document;
  var U = MK.textUtil, span = U.span, addSr = U.addSr, words = U.words;
  function typewriter(el) {
    var list = words(el);
    if (!list.length) list = [el.textContent.replace(/\s+/g, ' ').trim()];
    var loop = list.length > 1 || el.hasAttribute('data-text-loop');
    var speed = MK.ms(el, 'data-text-speed', 60);
    var pause = MK.ms(el, 'data-text-pause', 1600);
    el.textContent = '';
    addSr(el, list.join(', '));
    var out = span('mk-tw');
    out.setAttribute('aria-hidden', 'true');
    var caret = span('mk-caret');
    caret.setAttribute('aria-hidden', 'true');
    el.appendChild(out);
    if (!el.hasAttribute('data-text-nocaret')) el.appendChild(caret);
    if (MK.reduced) { out.textContent = list[0]; return; }

    var wi = 0, ci = 0, deleting = false, timer = 0;
    function step() {
      var word = list[wi];
      if (!deleting) {
        ci++;
        out.textContent = word.slice(0, ci);
        if (ci >= word.length) {
          if (!loop) { el.classList.add('mk-typed'); MK.emit(el, 'text'); return; }
          deleting = true;
          timer = setTimeout(step, pause);
          return;
        }
        timer = setTimeout(step, speed * (0.6 + Math.random() * 0.8));
      } else {
        ci--;
        out.textContent = word.slice(0, ci);
        if (ci <= 0) {
          deleting = false;
          wi = (wi + 1) % list.length;
          timer = setTimeout(step, 380);
          return;
        }
        timer = setTimeout(step, speed * 0.45);
      }
    }
    var off = MK.onEnter(el, function () { timer = setTimeout(step, MK.ms(el, 'data-text-delay', 250)); });
    return function () { off(); clearTimeout(timer); };
  }

  MK.textModes.typewriter = typewriter;
})(window.MotionKit);;
/* Motion Kit - text add-on: rotate
 *   data-text="rotate" data-words="a|b|c"  cycles words with a vertical slide (width animates)
 *   Options: data-text-interval="2200"
 */
(function (MK) {
  'use strict';
  var d = document;
  var U = MK.textUtil, span = U.span, addSr = U.addSr, words = U.words;
  function rotate(el) {
    var list = words(el);
    if (!list.length) { MK.warn('data-text="rotate" needs data-words="a|b|c"', el); return; }
    var interval = MK.ms(el, 'data-text-interval', 2200);
    el.textContent = '';
    addSr(el, list.join(', '));
    var box = span('mk-rot');
    box.setAttribute('aria-hidden', 'true');
    var cur = span('mk-rot-word', list[0]);
    box.appendChild(cur);
    el.appendChild(box);
    if (MK.reduced || list.length < 2) return;

    var i = 0, timer = 0, busy = false;
    var ease = 'cubic-bezier(.16,1,.3,1)';
    function next() {
      if (busy || d.hidden) return;
      busy = true;
      i = (i + 1) % list.length;
      var nxt = span('mk-rot-word mk-rot-next', list[i]);
      box.appendChild(nxt);
      var fromW = box.getBoundingClientRect().width;
      var toW = nxt.getBoundingClientRect().width;
      var opts = { duration: 650, easing: ease, fill: 'forwards' };
      box.animate([{ width: fromW + 'px' }, { width: toW + 'px' }], { duration: 650, easing: ease });
      cur.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-105%)', opacity: 0 }], opts);
      var a = nxt.animate([{ transform: 'translateY(105%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], opts);
      a.onfinish = function () {
        cur.remove();
        nxt.classList.remove('mk-rot-next');
        a.cancel();
        cur = nxt;
        busy = false;
      };
    }
    var offView = MK.inView(el, function (v) {
      clearInterval(timer);
      if (v) timer = setInterval(next, interval);
    });
    return function () { offView(); clearInterval(timer); };
  }

  MK.textModes.rotate = rotate;
})(window.MotionKit);;
/* Motion Kit - text add-on: interactive and flashy text
 *   data-text="glitch"     RGB-split glitch bursts on reveal and hover (data-text-loop = keeps glitching)
 *   data-text="neon"       flickers on like a neon sign, then glows (data-text-loop = occasional buzz). Dark bg.
 *   data-text="explode"    letters scatter on hover and spring back
 *   data-text="roll"       letters roll to a copy of themselves on hover (links, buttons, nav)
 *   data-text="proximity"  letters swell toward the cursor like a magnifier (data-text-weight="300 900" for variable fonts)
 * Colors: --mk-c1/--mk-c2 (glitch), --mk-neon (neon glow, default --mk-accent), --mk-accent (proximity tint)
 */
(function (MK) {
  'use strict';
  var U = MK.textUtil;

  function onEnterOrNow(el, fn) {
    if (MK.reduced) return;
    return MK.onEnter(el, fn);
  }

  MK.textModes.glitch = function (el) {
    el.setAttribute('data-mk-glitch', el.textContent.replace(/\s+/g, ' ').trim());
    el.classList.add('mk-glitch');
    if (MK.reduced) return;
    function burst() {
      el.classList.remove('mk-glitching');
      void el.offsetWidth;
      el.classList.add('mk-glitching');
    }
    var off = MK.onEnter(el, burst);
    el.addEventListener('pointerenter', burst);
    el.addEventListener('animationend', function (e) { if (e.target === el) el.classList.remove('mk-glitching'); });
    return function () { off(); el.removeEventListener('pointerenter', burst); };
  };

  MK.textModes.neon = function (el) {
    if (MK.reduced) { el.classList.add('mk-in'); return; }
    return MK.onEnter(el, function () { el.classList.add('mk-in'); });
  };

  MK.textModes.explode = function (el) {
    var chars = U.split(el, 'chars');
    if (MK.reduced || !chars.length) return;
    function scatter() {
      var r = el.getBoundingClientRect();
      var spread = Math.max(40, Math.min(160, r.width * 0.25));
      chars.forEach(function (c) {
        var a = Math.random() * Math.PI * 2, d = spread * (0.35 + Math.random() * 0.65);
        c.style.translate = (Math.cos(a) * d).toFixed(1) + 'px ' + (Math.sin(a) * d * 0.7).toFixed(1) + 'px';
        c.style.rotate = ((Math.random() - 0.5) * 140).toFixed(0) + 'deg';
      });
    }
    function reset() { chars.forEach(function (c) { c.style.translate = ''; c.style.rotate = ''; }); }
    el.classList.add('mk-explode');
    el.addEventListener('pointerenter', scatter);
    el.addEventListener('pointerleave', reset);
    el.addEventListener('focus', scatter);
    el.addEventListener('blur', reset);
    return function () {
      el.removeEventListener('pointerenter', scatter);
      el.removeEventListener('pointerleave', reset);
      reset();
    };
  };

  MK.textModes.roll = function (el) {
    var chars = U.split(el, 'chars');
    el.classList.add('mk-roll');
    function measure() {
      var cs = getComputedStyle(el), lh = parseFloat(cs.lineHeight);
      if (isNaN(lh)) lh = parseFloat(cs.fontSize) * 1.2;
      el.style.setProperty('--mk-lh', lh.toFixed(1) + 'px');
    }
    measure();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    return function () { chars.length = 0; };
  };

  MK.textModes.proximity = function (el) {
    var chars = U.split(el, 'chars');
    if (MK.reduced || !MK.finePointer || !chars.length) return;
    var wt = (el.getAttribute('data-text-weight') || '').split(/\s+/).map(parseFloat);
    var useWeight = wt.length === 2 && !isNaN(wt[0]) && !isNaN(wt[1]);
    var maxScale = MK.num(el, 'data-text-scale', 1.6);
    var radius = MK.num(el, 'data-text-radius', 140);
    el.classList.add('mk-prox');
    var cur = chars.map(function () { return 0; });
    var boxes = [], active = false;
    function measure() {
      var r = el.getBoundingClientRect();
      boxes = chars.map(function (c) {
        var b = c.getBoundingClientRect();
        return [b.left - r.left + b.width / 2, b.top - r.top + b.height / 2];
      });
    }
    var stop = MK.ticker(el, function () {
      var r = el.getBoundingClientRect(), P = MK.pointer;
      if (!boxes.length) measure();
      var moving = false;
      for (var i = 0; i < chars.length; i++) {
        var dx = P.x - (r.left + boxes[i][0]), dy = P.y - (r.top + boxes[i][1]);
        var f = P.active ? Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / radius) : 0;
        f = f * f * (3 - 2 * f);
        var v = MK.lerp(cur[i], f, 0.18);
        if (Math.abs(v - cur[i]) > 0.001) moving = true;
        cur[i] = v;
        var c = chars[i];
        c.style.scale = (1 + (maxScale - 1) * v).toFixed(3);
        c.style.setProperty('--mk-p', v.toFixed(3));
        if (useWeight) c.style.fontVariationSettings = '"wght" ' + Math.round(wt[0] + (wt[1] - wt[0]) * v);
      }
      active = moving;
    });
    var ro = window.ResizeObserver ? new ResizeObserver(function () { boxes = []; }) : null;
    if (ro) ro.observe(el);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { boxes = []; });
    return function () { stop(); if (ro) ro.disconnect(); };
  };

  // 3D flip reveal of letters is CSS-only on top of the chars split
  MK.textModes.flip = function (el) {
    var chars = U.split(el, 'chars');
    var stagger = MK.ms(el, 'data-text-stagger', Math.min(40, 1200 / Math.max(1, chars.length)));
    el.style.setProperty('--mk-stagger', stagger + 'ms');
    var delay = MK.ms(el, 'data-text-delay', 0);
    if (delay) el.style.setProperty('--mk-delay', delay + 'ms');
    if (MK.reduced) { el.classList.add('mk-in'); return; }
    return onEnterOrNow(el, function () { el.classList.add('mk-in'); });
  };
})(window.MotionKit);;
/* Motion Kit - text add-on: particles
 *   <h1 data-text="particles">Hello world</h1>
 * The headline is rebuilt from thousands of particles that fly in and assemble; the cursor (or a finger)
 * blows them apart and they spring back. The real text stays in the DOM (transparent) for SEO,
 * selection and screen readers. Best for short, big, bold headlines.
 * Options: data-text-color="palette" (gradient from --mk-c1..3; default = the text color)
 *          data-text-density="1" (more/fewer particles)  data-text-radius="90" (cursor push radius)
 */
(function (MK) {
  'use strict';
  var d = document;

  MK.textModes.particles = function (el) {
    var units = MK.textUtil.split(el, 'words');
    if (MK.reduced || !units.length) return;
    MK.ensurePositioned(el);
    el.classList.add('mk-ptext');
    var pad = 90;
    var canvas = d.createElement('canvas');
    canvas.className = 'mk-ptext-canvas mk-internal';
    canvas.setAttribute('aria-hidden', 'true');
    el.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    var density = MK.num(el, 'data-text-density', 1), radius = MK.num(el, 'data-text-radius', 90);
    var usePalette = el.getAttribute('data-text-color') === 'palette';
    var parts = [], buckets = [], W = 0, H = 0, built = false, born = 0;

    function build() {
      var r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      W = Math.ceil(r.width + pad * 2); H = Math.ceil(r.height + pad * 2);
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var off = d.createElement('canvas');
      off.width = W; off.height = H;
      var o = off.getContext('2d', { willReadFrequently: true });
      o.textBaseline = 'middle';
      var size = 16, color = null;
      units.forEach(function (u) {
        var cs = getComputedStyle(u), ur = u.getBoundingClientRect();
        size = parseFloat(cs.fontSize) || size;
        o.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
        if ('letterSpacing' in o) o.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
        o.fillStyle = '#000';
        o.fillText(u.textContent, ur.left - r.left + pad, ur.top - r.top + pad + ur.height / 2);
        if (!color) color = getComputedStyle(el).color;
      });
      var gap = Math.max(2, Math.round((size / 26) / Math.sqrt(density)));
      var img = o.getImageData(0, 0, W, H).data, targets = [];
      for (var y = 0; y < H; y += gap) for (var x = 0; x < W; x += gap) if (img[(y * W + x) * 4 + 3] > 140) targets.push([x, y]);
      while (targets.length > 7000) { targets = targets.filter(function (_, i) { return i % 2 === 0; }); gap *= 1.4; }
      var palette = usePalette || /rgba\(0, 0, 0, 0\)|transparent/.test(color) ? MK.colors(el, 'data-text-colors') : [color];
      buckets = palette.map(function () { return []; });
      var minX = pad, maxX = W - pad;
      var old = parts;
      parts = targets.map(function (t, i) {
        var p = old[i] || { x: Math.random() * W, y: Math.random() * H + (Math.random() < 0.5 ? -H : H) * 0.6, vx: 0, vy: 0 };
        p.tx = t[0]; p.ty = t[1]; p.s = gap * 0.78; p.ph = Math.random() * 6.28;
        var bi = palette.length > 1 ? Math.min(palette.length - 1, Math.floor(((t[0] - minX) / Math.max(1, maxX - minX)) * palette.length)) : 0;
        buckets[bi].push(p);
        return p;
      });
      buckets.color = palette;
      built = true;
      if (!born) born = performance.now();
    }

    var local = { x: -9999, y: -9999 };
    function move(e) {
      var r = canvas.getBoundingClientRect();
      local.x = e.clientX - r.left; local.y = e.clientY - r.top;
    }
    function leave() { local.x = local.y = -9999; }
    window.addEventListener('pointermove', move, { passive: true });
    d.documentElement.addEventListener('pointerleave', leave);

    var stop = MK.ticker(el, function (t) {
      if (!built) build();
      if (!built) return;
      ctx.clearRect(0, 0, W, H);
      var R2 = radius * radius, age = (performance.now() - born) / 1000;
      var k = age < 1.4 ? 0.02 + age * 0.03 : 0.065;
      for (var b = 0; b < buckets.length; b++) {
        ctx.fillStyle = buckets.color[b];
        var list = buckets[b];
        for (var i = 0; i < list.length; i++) {
          var p = list[i];
          var dx = p.x - local.x, dy = p.y - local.y, d2 = dx * dx + dy * dy;
          if (d2 < R2) {
            var f = (1 - d2 / R2) * 7 / (Math.sqrt(d2) + 1);
            p.vx += dx * f; p.vy += dy * f;
          }
          var jitter = Math.sin(t * 0.002 + p.ph) * 0.35;
          p.vx = (p.vx + (p.tx - p.x) * k) * 0.82;
          p.vy = (p.vy + (p.ty + jitter - p.y) * k) * 0.82;
          p.x += p.vx; p.y += p.vy;
          ctx.fillRect(p.x, p.y, p.s, p.s);
        }
      }
    }, { rootMargin: '150px' });

    var timer = 0;
    var ro = window.ResizeObserver ? new ResizeObserver(function () { clearTimeout(timer); timer = setTimeout(function () { built = false; }, 120); }) : null;
    if (ro) ro.observe(el);
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(function () { built = false; });
    return function () {
      stop();
      if (ro) ro.disconnect();
      window.removeEventListener('pointermove', move);
      d.documentElement.removeEventListener('pointerleave', leave);
      canvas.remove();
      el.classList.remove('mk-ptext');
    };
  };
})(window.MotionKit);;
/* Motion Kit - circle-text: rotating circular text badge ("SCROLL DOWN * SCROLL DOWN *")
 *   <a class="badge" href="#work" data-circle-text="Scroll to explore * ">↓</a>
 * The text is laid out around a circle that fills the element (give it a width/height, e.g. 130px),
 * rotates slowly, spins faster while scrolling and on hover. Existing children stay centered.
 * Options: data-circle-speed="1" (turns per ~20s)  data-circle-size="0.11" (font size relative to diameter)
 */
(function (MK) {
  'use strict';
  var d = document, NS = 'http://www.w3.org/2000/svg', uid = 0;

  MK.register({
    name: 'circle-text',
    selector: '[data-circle-text]',
    init: function (el) {
      var text = el.getAttribute('data-circle-text') || el.textContent.trim();
      if (!text) return;
      el.classList.add('mk-circle');
      if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', text.replace(/\s*[*•·]\s*/g, ' ').trim());
      var id = 'mk-circle-path-' + (++uid);
      var svg = d.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 200 200');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('class', 'mk-circle-svg mk-internal');
      var path = d.createElementNS(NS, 'path');
      path.setAttribute('id', id);
      path.setAttribute('d', 'M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0');
      path.setAttribute('fill', 'none');
      var t = d.createElementNS(NS, 'text');
      t.setAttribute('font-size', String(200 * MK.num(el, 'data-circle-size', 0.11)));
      var tp = d.createElementNS(NS, 'textPath');
      tp.setAttribute('href', '#' + id);
      tp.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#' + id);
      tp.setAttribute('textLength', String(Math.floor(2 * Math.PI * 78) - 2));
      tp.setAttribute('lengthAdjust', 'spacing');
      tp.textContent = text;
      t.appendChild(tp);
      svg.appendChild(path);
      svg.appendChild(t);
      el.insertBefore(svg, el.firstChild);
      if (MK.reduced) return;
      var rot = 0, boost = 0, hover = false, lastY = window.pageYOffset;
      var base = MK.num(el, 'data-circle-speed', 1) * 18; // deg per second
      function enter() { hover = true; }
      function leave() { hover = false; }
      el.addEventListener('pointerenter', enter);
      el.addEventListener('pointerleave', leave);
      var stop = MK.ticker(el, function (now, dt) {
        var y = window.pageYOffset, v = Math.abs(y - lastY);
        lastY = y;
        boost = MK.lerp(boost, Math.min(v * 6, 360) + (hover ? 140 : 0), 0.08);
        rot = (rot + (base + boost) * (dt / 1000)) % 360;
        svg.style.rotate = rot.toFixed(2) + 'deg';
      });
      return function () { stop(); el.removeEventListener('pointerenter', enter); el.removeEventListener('pointerleave', leave); svg.remove(); };
    }
  });
})(window.MotionKit);;
/* Motion Kit - counter: numbers that count up when scrolled into view
 *   <span data-count-to="12500" data-count-prefix="$" data-count-suffix="+">12,500</span>
 * Options: data-count-from="0" data-count-duration="2000" data-count-decimals="1"
 *          data-count-separator="," (use "" for none) data-count-delay="0"
 * Keep the final number as the element's text so it reads correctly without JavaScript.
 */
(function (MK) {
  'use strict';
  // data-count-style="odometer": every digit is a strip of 0-9 that rolls into place like a slot machine
  function odometer(el, text, dur) {
    el.setAttribute('aria-label', text);
    el.textContent = '';
    el.classList.add('mk-odo');
    var digits = text.replace(/\D/g, '').length, seen = 0, strips = [];
    Array.from(text).forEach(function (ch) {
      if (!/\d/.test(ch)) {
        var c = document.createElement('mk-span');
        c.className = 'mk-odo-c';
        c.setAttribute('aria-hidden', 'true');
        c.textContent = ch;
        el.appendChild(c);
        return;
      }
      var pos = seen++, cycles = 1 + Math.max(0, Math.min(3, digits - pos - 1));
      var box = document.createElement('mk-span');
      box.className = 'mk-odo-d';
      box.setAttribute('aria-hidden', 'true');
      var strip = document.createElement('mk-span');
      strip.className = 'mk-odo-s';
      var cells = cycles * 10 + (+ch) + 1;
      for (var i = 0; i < cells; i++) {
        var cell = document.createElement('mk-span');
        cell.textContent = String(i % 10);
        strip.appendChild(cell);
      }
      strip.style.setProperty('--mk-odo-dur', Math.round(dur * (0.55 + 0.45 * (pos + 1) / digits)) + 'ms');
      strip.style.setProperty('--mk-odo-to', String(cells - 1));
      box.appendChild(strip);
      el.appendChild(box);
      strips.push(strip);
    });
    return MK.onEnter(el, function () {
      setTimeout(function () {
        el.classList.add('mk-in');
        setTimeout(function () { MK.emit(el, 'counted'); }, dur);
      }, MK.ms(el, 'data-count-delay', 0));
    }, { rootMargin: '0px 0px -5% 0px' });
  }

  MK.register({
    name: 'counter',
    selector: '[data-count-to]',
    init: function (el) {
      var raw = el.getAttribute('data-count-to').replace(/[, _]/g, '');
      var to = parseFloat(raw);
      if (isNaN(to)) { MK.warn('data-count-to must be a number', el); return; }
      var from = MK.num(el, 'data-count-from', 0);
      var dur = MK.ms(el, 'data-count-duration', 2000);
      var dec = el.hasAttribute('data-count-decimals')
        ? MK.num(el, 'data-count-decimals', 0)
        : (raw.split('.')[1] || '').length;
      var sep = el.hasAttribute('data-count-separator') ? el.getAttribute('data-count-separator') : ',';
      var prefix = MK.attr(el, 'data-count-prefix', '');
      var suffix = MK.attr(el, 'data-count-suffix', '');

      function format(v) {
        var s = Math.abs(v).toFixed(dec);
        var parts = s.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, sep);
        return (v < 0 ? '-' : '') + prefix + parts.join('.') + suffix;
      }
      el.style.fontVariantNumeric = 'tabular-nums';
      if (MK.reduced) { el.textContent = format(to); return; }
      if (el.getAttribute('data-count-style') === 'odometer') return odometer(el, format(to), dur);
      el.textContent = format(from);

      var raf = 0;
      var off = MK.onEnter(el, function () {
        setTimeout(function () {
          var start = performance.now();
          (function frame(now) {
            var p = MK.clamp((now - start) / dur, 0, 1);
            el.textContent = format(from + (to - from) * MK.easeOutExpo(p));
            if (p < 1) raf = requestAnimationFrame(frame);
            else { el.textContent = format(to); MK.emit(el, 'counted'); }
          })(start);
        }, MK.ms(el, 'data-count-delay', 0));
      }, { rootMargin: '0px 0px -5% 0px' });
      return function () { off(); cancelAnimationFrame(raf); };
    }
  });
})(window.MotionKit);;
/* Motion Kit - parallax: depth on scroll and on mouse move
 *   data-parallax="0.3"          moves at a different speed while scrolling (negative = opposite)
 *   data-parallax-axis="x"       horizontal instead of vertical
 *   data-mouse-parallax="25"     follows the pointer by up to 25px (layer decorative shapes at 10/25/40)
 * Put these on decorative layers/wrappers, not on an element that also has data-motion.
 */
(function (MK) {
  'use strict';

  function state(el) {
    if (!el.__mkPar) el.__mkPar = { sx: 0, sy: 0, mx: 0, my: 0 };
    return el.__mkPar;
  }
  function apply(el) {
    var s = state(el);
    el.style.translate = (s.sx + s.mx).toFixed(2) + 'px ' + (s.sy + s.my).toFixed(2) + 'px';
  }

  MK.register({
    name: 'parallax',
    selector: '[data-parallax]',
    init: function (el) {
      if (MK.reduced) return;
      var speed = MK.num(el, 'data-parallax', 0.2);
      var axis = MK.attr(el, 'data-parallax-axis', 'y');
      var s = state(el);
      var active = false;
      var offView = MK.inView(el, function (v) { active = v; if (v) MK.update(); }, { rootMargin: '25% 0px' });
      var offScroll = MK.onScroll(function (y, vh) {
        if (!active) return;
        var r = el.getBoundingClientRect();
        var baseTop = r.top - s.sy;
        var delta = baseTop + r.height / 2 - vh / 2;
        var v = -delta * speed;
        if (axis === 'x') { s.sx = v; s.sy = 0; } else { s.sy = v; s.sx = 0; }
        apply(el);
      });
      return function () { offView(); offScroll(); el.style.translate = ''; };
    }
  });

  MK.register({
    name: 'mouse-parallax',
    selector: '[data-mouse-parallax]',
    init: function (el) {
      if (MK.reduced || !MK.finePointer) return;
      var depth = MK.num(el, 'data-mouse-parallax', 20);
      var s = state(el);
      var stop = MK.ticker(el, function () {
        var p = MK.pointer;
        var tx = p.active ? ((p.x / window.innerWidth) - 0.5) * 2 * depth : 0;
        var ty = p.active ? ((p.y / window.innerHeight) - 0.5) * 2 * depth : 0;
        var nx = MK.lerp(s.mx, tx, 0.08), ny = MK.lerp(s.my, ty, 0.08);
        if (Math.abs(nx - s.mx) < 0.01 && Math.abs(ny - s.my) < 0.01) return;
        s.mx = nx; s.my = ny;
        apply(el);
      });
      return function () { stop(); el.style.translate = ''; };
    }
  });
})(window.MotionKit);;
/* Motion Kit - scroll: scroll-linked effects
 *   <div data-scroll-progress></div>          reading-progress bar (fixed at top by default)
 *   data-scroll-progress="#article"           progress through one element instead of the page
 *   data-scrub="scale-in|fade-in|slide-left|slide-right|rotate|spin|zoom-out|tilt-3d|blur-in|clip|text-fill"
 *   data-scrub (no value)                     just exposes CSS vars for your own styles:
 *       --mk-p      0 -> 1 while the element travels through the whole viewport
 *       --mk-enter  0 -> 1 while the element enters (top edge from bottom of screen to 40%)
 *   :root always gets --mk-scroll (0 -> 1 page progress) once this module is active.
 */
(function (MK) {
  'use strict';
  var root = document.documentElement;

  function pageProgress() {
    var max = root.scrollHeight - window.innerHeight;
    return max > 0 ? MK.clamp(window.pageYOffset / max, 0, 1) : 0;
  }

  MK.register({
    name: 'scroll-progress',
    selector: '[data-scroll-progress]',
    init: function (el) {
      var target = el.getAttribute('data-scroll-progress');
      var t = target ? document.querySelector(target) : null;
      if (!el.children.length && !el.classList.contains('mk-progress-custom')) el.classList.add('mk-progress');
      return MK.onScroll(function (y, vh) {
        var p;
        if (t) {
          var r = t.getBoundingClientRect();
          p = MK.clamp(-r.top / Math.max(1, r.height - vh), 0, 1);
        } else {
          p = pageProgress();
        }
        el.style.setProperty('--mk-p', p.toFixed(4));
        el.style.scale = p.toFixed(4) + ' 1';
        root.style.setProperty('--mk-scroll', pageProgress().toFixed(4));
      });
    }
  });

  MK.register({
    name: 'scrub',
    selector: '[data-scrub]',
    init: function (el) {
      if (MK.reduced) {
        el.style.setProperty('--mk-p', '0.5');
        el.style.setProperty('--mk-enter', '1');
        return;
      }
      var active = false;
      var offView = MK.inView(el, function (v) { active = v; if (v) MK.update(); }, { rootMargin: '20% 0px' });
      var offScroll = MK.onScroll(function (y, vh) {
        if (!active) return;
        var r = el.getBoundingClientRect();
        var p = MK.clamp((vh - r.top) / (vh + r.height), 0, 1);
        var enter = MK.clamp((vh - r.top) / (vh * 0.6), 0, 1);
        el.style.setProperty('--mk-p', p.toFixed(4));
        el.style.setProperty('--mk-enter', enter.toFixed(4));
      });
      return function () { offView(); offScroll(); };
    }
  });
})(window.MotionKit);;
/* Motion Kit - story: pinned scroll storytelling
 *   <section data-horizontal> <article>..</article> <article>..</article> ... </section>
 *       vertical scrolling moves the panels sideways while the section stays pinned.
 *       Options: data-horizontal-gap="32" (px). Exposes --mk-p (0..1) on the section.
 *   <section data-steps>
 *       <div class="mk-sticky mk-steps-stack"> <img data-step-target="0"> <img data-step-target="1"> </div>
 *       <div> <div data-step>First</div> <div data-step>Second</div> </div>
 *   </section>
 *       the step in the middle of the screen gets .mk-active, and so does its matching
 *       [data-step-target]. The section gets data-active-step="n" and --mk-step: n.
 * NOTE: position: sticky breaks if an ancestor has overflow: hidden. Use overflow-x: clip instead.
 */
(function (MK) {
  'use strict';
  var d = document;

  MK.register({
    name: 'horizontal',
    selector: '[data-horizontal]',
    init: function (section) {
      var track = section.querySelector(':scope .mk-h-track');
      var sticky = section.querySelector(':scope .mk-h-sticky');
      if (!track) {
        sticky = d.createElement('div');
        sticky.className = 'mk-h-sticky';
        track = d.createElement('div');
        track.className = 'mk-h-track';
        while (section.firstChild) track.appendChild(section.firstChild);
        sticky.appendChild(track);
        section.appendChild(sticky);
      }
      var gap = section.getAttribute('data-horizontal-gap');
      if (gap) track.style.gap = /^[0-9.]+$/.test(gap) ? gap + 'px' : gap;
      if (MK.reduced) { section.classList.add('mk-h-native'); return; }
      section.classList.add('mk-h-on');

      var dist = 0;
      function measure() {
        dist = Math.max(0, track.scrollWidth - sticky.clientWidth);
        section.style.height = (dist + window.innerHeight) + 'px';
        MK.update();
      }
      var ro = window.ResizeObserver ? new ResizeObserver(measure) : null;
      if (ro) { ro.observe(track); ro.observe(sticky); }
      window.addEventListener('resize', measure);
      measure();
      var offScroll = MK.onScroll(function (y, vh) {
        var r = section.getBoundingClientRect();
        var p = MK.clamp(-r.top / Math.max(1, r.height - vh), 0, 1);
        track.style.transform = 'translate3d(' + (-p * dist).toFixed(1) + 'px,0,0)';
        section.style.setProperty('--mk-p', p.toFixed(4));
      });
      return function () {
        offScroll();
        if (ro) ro.disconnect();
        window.removeEventListener('resize', measure);
      };
    }
  });

  MK.register({
    name: 'steps',
    selector: '[data-steps]',
    init: function (el) {
      var steps = Array.prototype.slice.call(el.querySelectorAll('[data-step]'));
      if (!steps.length) return;
      var targets = Array.prototype.slice.call(el.querySelectorAll('[data-step-target]'));
      var current = -1;
      function activate(i) {
        if (i === current) return;
        current = i;
        steps.forEach(function (s, k) { s.classList.toggle('mk-active', k === i); });
        targets.forEach(function (t) {
          t.classList.toggle('mk-active', parseInt(t.getAttribute('data-step-target'), 10) === i);
        });
        el.setAttribute('data-active-step', i);
        el.style.setProperty('--mk-step', i);
        MK.emit(el, 'step', { index: i });
      }
      activate(0);
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) activate(steps.indexOf(e.target));
        });
      }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
      steps.forEach(function (s) { io.observe(s); });
      return function () { io.disconnect(); };
    }
  });
})(window.MotionKit);;
/* Motion Kit - scrollfx: scroll-driven layout effects
 *   <div data-stack> <article>..</article> <article>..</article> </div>
 *       cards pin on top of each other while scrolling; covered cards shrink and dim (stacking cards).
 *       Options: data-stack-top="90" (px from the top) data-stack-offset="16" (px between pinned cards), --mk-stack-gap
 *   <section data-expand> <img src="hero.jpg" alt=""> <h2>Overlay text</h2> </section>
 *       a framed image/video grows to full-screen while the section is pinned; overlay content fades in at the end.
 *       The first img/video/picture (or [data-expand-media]) is the media. Option: data-expand="250" (section height in vh)
 *   data-velocity="1"          skews the element with scroll speed (big headings, image strips, marquees)
 *   data-page-color="#0b0b10"  the whole page background fades to this color while the section is centered;
 *                              data-page-text="#fff" changes the text color too (keep those sections transparent)
 */
(function (MK) {
  'use strict';
  var d = document;

  MK.register({
    name: 'stack',
    selector: '[data-stack]',
    init: function (el) {
      var cards = Array.prototype.slice.call(el.children);
      if (cards.length < 2) return;
      el.classList.add('mk-stack');
      var top = MK.num(el, 'data-stack-top', 90), step = MK.num(el, 'data-stack-offset', 16);
      cards.forEach(function (c, i) {
        c.style.setProperty('--mk-stack-top', (top + i * step) + 'px');
        c.style.zIndex = String(i + 1);
      });
      if (MK.reduced) return;
      var active = false;
      var offView = MK.inView(el, function (v) { active = v; if (v) MK.update(); }, { rootMargin: '20% 0px' });
      var offScroll = MK.onScroll(function () {
        if (!active) return;
        var rects = cards.map(function (c) { return c.getBoundingClientRect(); });
        var cover = rects.map(function (r, i) {
          if (i === rects.length - 1) return 0;
          var stickyTop = top + i * step, next = rects[i + 1];
          return MK.clamp(1 - (next.top - stickyTop - step) / Math.max(1, r.height), 0, 1);
        });
        for (var i = 0; i < cards.length; i++) {
          var depth = 0;
          for (var j = i; j < cover.length; j++) depth += cover[j] * (j === i ? 1 : 0.6);
          cards[i].style.setProperty('--mk-depth', Math.min(depth, 4).toFixed(3));
        }
      });
      return function () { offView(); offScroll(); };
    }
  });

  MK.register({
    name: 'expand',
    selector: '[data-expand]',
    init: function (section) {
      var sticky = section.querySelector(':scope > .mk-expand-sticky');
      if (!sticky) {
        sticky = d.createElement('div');
        sticky.className = 'mk-expand-sticky';
        while (section.firstChild) sticky.appendChild(section.firstChild);
        section.appendChild(sticky);
      }
      var media = sticky.querySelector('[data-expand-media]') || sticky.querySelector('img,video,picture,canvas');
      if (!media) return;
      var frame = d.createElement('div');
      frame.className = 'mk-expand-frame';
      media.parentNode.insertBefore(frame, media);
      frame.appendChild(media);
      media.classList.add('mk-expand-media');
      Array.prototype.forEach.call(sticky.children, function (c) { if (c !== frame) c.classList.add('mk-expand-content'); });
      section.classList.add('mk-expand');
      if (MK.reduced) { section.classList.add('mk-expand-static'); return; }
      section.style.setProperty('--mk-expand-h', MK.num(section, 'data-expand', 250) + 'vh');
      var active = false;
      var offView = MK.inView(section, function (v) { active = v; if (v) MK.update(); }, { rootMargin: '10% 0px' });
      var offScroll = MK.onScroll(function (y, vh) {
        if (!active) return;
        var r = section.getBoundingClientRect();
        var p = MK.clamp(-r.top / Math.max(1, r.height - vh), 0, 1);
        var e = MK.easeInOutCubic(MK.clamp(p / 0.72, 0, 1));
        section.style.setProperty('--mk-p', p.toFixed(4));
        section.style.setProperty('--mk-e', e.toFixed(4));
      });
      return function () { offView(); offScroll(); };
    }
  });

  MK.register({
    name: 'velocity',
    selector: '[data-velocity]',
    init: function (el) {
      if (MK.reduced) return;
      var amt = MK.num(el, 'data-velocity', 1), cur = 0, lastY = window.pageYOffset;
      var stop = MK.ticker(el, function () {
        var y = window.pageYOffset, v = y - lastY;
        lastY = y;
        var target = MK.clamp(v * 0.22 * amt, -10, 10);
        cur = MK.lerp(cur, target, 0.14);
        if (Math.abs(cur) < 0.01 && !target) { if (el.style.transform) el.style.transform = ''; return; }
        el.style.transform = 'skewY(' + cur.toFixed(3) + 'deg) scaleY(' + (1 + Math.abs(cur) * 0.006).toFixed(4) + ')';
      });
      return function () { stop(); el.style.transform = ''; };
    }
  });

  var pc = null;
  function pageColors() {
    if (pc) return pc;
    var cs = getComputedStyle(d.body);
    pc = { bg: cs.backgroundColor, fg: cs.color, active: [] };
    d.documentElement.classList.add('mk-page-color');
    return pc;
  }
  function applyPage() {
    var s = pc.active[pc.active.length - 1];
    d.body.style.backgroundColor = s ? s.getAttribute('data-page-color') : '';
    d.body.style.color = s && s.hasAttribute('data-page-text') ? s.getAttribute('data-page-text') : '';
    d.documentElement.style.setProperty('--mk-page-color', s ? s.getAttribute('data-page-color') : pc.bg);
  }
  MK.register({
    name: 'page-color',
    selector: '[data-page-color]',
    init: function (el) {
      var st = pageColors();
      var off = MK.inView(el, function (v) {
        var i = st.active.indexOf(el);
        if (v && i < 0) st.active.push(el);
        if (!v && i >= 0) st.active.splice(i, 1);
        applyPage();
      }, { rootMargin: '-50% 0px -50% 0px' });
      return function () { off(); var i = st.active.indexOf(el); if (i >= 0) st.active.splice(i, 1); applyPage(); };
    }
  });
})(window.MotionKit);;
/* Motion Kit - magnetic
 *   data-magnetic="0.35"   element is pulled toward the cursor (buttons, social icons). Desktop only.
 */
(function (MK) {
  'use strict';
  var d = document;

  MK.register({
    name: 'magnetic',
    selector: '[data-magnetic]',
    init: function (el) {
      if (MK.reduced || !MK.finePointer) return;
      var strength = MK.num(el, 'data-magnetic', 0.35);
      var cur = { x: 0, y: 0 }, tgt = { x: 0, y: 0 }, raf = 0;
      function loop() {
        cur.x = MK.lerp(cur.x, tgt.x, 0.18);
        cur.y = MK.lerp(cur.y, tgt.y, 0.18);
        el.style.translate = cur.x.toFixed(2) + 'px ' + cur.y.toFixed(2) + 'px';
        if (Math.abs(cur.x - tgt.x) > 0.05 || Math.abs(cur.y - tgt.y) > 0.05) raf = requestAnimationFrame(loop);
        else { raf = 0; if (!tgt.x && !tgt.y) el.style.translate = ''; }
      }
      function kick() { if (!raf) raf = requestAnimationFrame(loop); }
      function move(e) {
        var r = el.getBoundingClientRect();
        var cx = r.left + r.width / 2 - cur.x, cy = r.top + r.height / 2 - cur.y;
        tgt.x = (e.clientX - cx) * strength;
        tgt.y = (e.clientY - cy) * strength;
        kick();
      }
      function leave() { tgt.x = 0; tgt.y = 0; kick(); }
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerleave', leave);
      return function () {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerleave', leave);
        cancelAnimationFrame(raf);
        el.style.translate = '';
      };
    }
  });
})(window.MotionKit);;
/* Motion Kit - tilt
 *   data-tilt="12"         3D tilt toward the cursor; data-tilt-glare adds a light sheen
 *   Options: data-tilt-scale="1.03" data-tilt-perspective="900". Desktop only.
 *   Depth: children with data-tilt-depth="40" float that many px above the card while it tilts (layered 3D).
 */
(function (MK) {
  'use strict';
  var d = document;

  MK.register({
    name: 'tilt',
    selector: '[data-tilt]',
    init: function (el) {
      if (MK.reduced || !MK.finePointer) return;
      var max = MK.num(el, 'data-tilt', 10);
      var hoverScale = MK.num(el, 'data-tilt-scale', 1.03);
      var persp = MK.num(el, 'data-tilt-perspective', 900);
      // layered depth: lift marked children off the card in 3D
      Array.prototype.forEach.call(el.querySelectorAll('[data-tilt-depth]'), function (child) {
        child.style.transform = 'translateZ(' + MK.num(child, 'data-tilt-depth', 30) + 'px)';
        for (var p = child.parentElement; p && p !== el; p = p.parentElement) p.style.transformStyle = 'preserve-3d';
      });
      var glare = null;
      if (el.hasAttribute('data-tilt-glare')) {
        MK.ensurePositioned(el);
        glare = d.createElement('mk-span');
        glare.className = 'mk-glare mk-internal';
        glare.setAttribute('aria-hidden', 'true');
        el.appendChild(glare);
      }
      var cur = { rx: 0, ry: 0, s: 1 }, tgt = { rx: 0, ry: 0, s: 1 }, raf = 0;
      function loop() {
        cur.rx = MK.lerp(cur.rx, tgt.rx, 0.14);
        cur.ry = MK.lerp(cur.ry, tgt.ry, 0.14);
        cur.s = MK.lerp(cur.s, tgt.s, 0.14);
        el.style.transform = 'perspective(' + persp + 'px) rotateX(' + cur.rx.toFixed(2) + 'deg) rotateY(' +
          cur.ry.toFixed(2) + 'deg) scale(' + cur.s.toFixed(4) + ')';
        var moving = Math.abs(cur.rx - tgt.rx) > 0.02 || Math.abs(cur.ry - tgt.ry) > 0.02 || Math.abs(cur.s - tgt.s) > 0.0005;
        if (moving) raf = requestAnimationFrame(loop);
        else {
          raf = 0;
          if (!tgt.rx && !tgt.ry && tgt.s === 1) el.style.transform = '';
        }
      }
      function kick() { if (!raf) raf = requestAnimationFrame(loop); }
      function move(e) {
        var r = el.getBoundingClientRect();
        var px = MK.clamp((e.clientX - r.left) / r.width, 0, 1);
        var py = MK.clamp((e.clientY - r.top) / r.height, 0, 1);
        tgt.rx = (0.5 - py) * 2 * max;
        tgt.ry = (px - 0.5) * 2 * max;
        tgt.s = hoverScale;
        if (glare) {
          glare.style.setProperty('--mk-gx', (px * 100).toFixed(1) + '%');
          glare.style.setProperty('--mk-gy', (py * 100).toFixed(1) + '%');
          glare.style.opacity = '1';
        }
        kick();
      }
      function leave() {
        tgt.rx = 0; tgt.ry = 0; tgt.s = 1;
        if (glare) glare.style.opacity = '0';
        kick();
      }
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerleave', leave);
      return function () {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerleave', leave);
        cancelAnimationFrame(raf);
        el.style.transform = '';
        if (glare) glare.remove();
      };
    }
  });
})(window.MotionKit);;
/* Motion Kit - spotlight
 *   data-spotlight           glow + glowing border that follows the cursor inside a card
 *   data-spotlight="group"   same, across every child card of a grid (Linear / Vercel style)
 *   Tint with --mk-spot (glow) and --mk-spot-border (border glow).
 */
(function (MK) {
  'use strict';
  var d = document;

  function addSpot(card) {
    if (card.querySelector(':scope > .mk-spot')) return;
    MK.ensurePositioned(card);
    var fill = d.createElement('mk-span');
    fill.className = 'mk-spot mk-internal';
    var ring = d.createElement('mk-span');
    ring.className = 'mk-spot-border mk-internal';
    fill.setAttribute('aria-hidden', 'true');
    ring.setAttribute('aria-hidden', 'true');
    card.appendChild(fill);
    card.appendChild(ring);
    card.classList.add('mk-spot-host');
  }

  MK.register({
    name: 'spotlight',
    selector: '[data-spotlight]',
    init: function (el) {
      var group = el.getAttribute('data-spotlight') === 'group';
      var cards = group ? Array.prototype.slice.call(el.children) : [el];
      cards.forEach(addSpot);
      if (group) el.classList.add('mk-spot-group');
      if (!MK.finePointer) return;
      function move(e) {
        cards.forEach(function (c) {
          var r = c.getBoundingClientRect();
          c.style.setProperty('--mk-mx', (e.clientX - r.left).toFixed(1) + 'px');
          c.style.setProperty('--mk-my', (e.clientY - r.top).toFixed(1) + 'px');
        });
      }
      function enter() { el.classList.add('mk-spot-on'); }
      function leave() { el.classList.remove('mk-spot-on'); }
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerenter', enter);
      el.addEventListener('pointerleave', leave);
      return function () {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerenter', enter);
        el.removeEventListener('pointerleave', leave);
      };
    }
  });
})(window.MotionKit);;
/* Motion Kit - ripple
 *   data-ripple   material-style click ripple (works on touch too)
 */
(function (MK) {
  'use strict';
  var d = document;

  MK.register({
    name: 'ripple',
    selector: '[data-ripple]',
    init: function (el) {
      MK.ensurePositioned(el);
      el.classList.add('mk-ripple-host');
      function down(e) {
        if (MK.reduced) return;
        var r = el.getBoundingClientRect();
        var size = Math.max(r.width, r.height) * 2.2;
        var s = d.createElement('mk-span');
        s.className = 'mk-ripple mk-internal';
        s.style.width = s.style.height = size + 'px';
        s.style.left = (e.clientX - r.left - size / 2) + 'px';
        s.style.top = (e.clientY - r.top - size / 2) + 'px';
        el.appendChild(s);
        s.addEventListener('animationend', function () { s.remove(); });
        setTimeout(function () { s.remove(); }, 1200);
      }
      el.addEventListener('pointerdown', down);
      return function () { el.removeEventListener('pointerdown', down); };
    }
  });
})(window.MotionKit);;
/* Motion Kit - holo + flashlight: pointer-driven surface effects
 *   data-holo              holographic foil: rainbow sheen + sparkles shift with the cursor angle
 *                          (collectible-card look). Pair with data-tilt="12" for full 3D.
 *   data-flashlight="220"  the section is dark except for a soft spotlight that follows the cursor,
 *                          revealing the content (or put your own cover inside: [data-flashlight-cover]).
 *                          Until the cursor arrives the light wanders on its own (data-flashlight-still to disable).
 *                          Touch screens and reduced motion just show everything.
 * Tune: --mk-holo-opacity (.75), --mk-flash-cover (overlay color, default rgba(4,4,9,.94)).
 */
(function (MK) {
  'use strict';
  var d = document;

  MK.register({
    name: 'holo',
    selector: '[data-holo]',
    init: function (el) {
      MK.ensurePositioned(el);
      el.classList.add('mk-holo-host');
      var sheen = d.createElement('mk-span');
      sheen.className = 'mk-holo mk-internal';
      sheen.setAttribute('aria-hidden', 'true');
      var spark = d.createElement('mk-span');
      spark.className = 'mk-holo-spark mk-internal';
      spark.setAttribute('aria-hidden', 'true');
      el.appendChild(sheen);
      el.appendChild(spark);
      if (MK.reduced) return;
      var cur = { x: 50, y: 50, o: 0 }, tgt = { x: 50, y: 50, o: 0 }, raf = 0;
      function loop() {
        cur.x = MK.lerp(cur.x, tgt.x, 0.16); cur.y = MK.lerp(cur.y, tgt.y, 0.16); cur.o = MK.lerp(cur.o, tgt.o, 0.12);
        el.style.setProperty('--mk-hx', cur.x.toFixed(2) + '%');
        el.style.setProperty('--mk-hy', cur.y.toFixed(2) + '%');
        el.style.setProperty('--mk-ho', cur.o.toFixed(3));
        el.style.setProperty('--mk-hd', (Math.hypot(cur.x - 50, cur.y - 50) / 70).toFixed(3));
        if (Math.abs(cur.x - tgt.x) + Math.abs(cur.y - tgt.y) + Math.abs(cur.o - tgt.o) > 0.02) raf = requestAnimationFrame(loop);
        else raf = 0;
      }
      function kick() { if (!raf) raf = requestAnimationFrame(loop); }
      function move(e) {
        var r = el.getBoundingClientRect();
        tgt.x = MK.clamp(((e.clientX - r.left) / r.width) * 100, 0, 100);
        tgt.y = MK.clamp(((e.clientY - r.top) / r.height) * 100, 0, 100);
        tgt.o = 1;
        kick();
      }
      function leave() { tgt.x = 50; tgt.y = 50; tgt.o = 0; kick(); }
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerleave', leave);
      // touch / no hover: a slow automatic shimmer so the foil still reads as foil
      var auto = null;
      if (!MK.finePointer) {
        auto = MK.ticker(el, function (t) {
          tgt.x = 50 + Math.sin(t * 0.0007) * 40; tgt.y = 50 + Math.cos(t * 0.0005) * 40; tgt.o = 0.7; kick();
        });
      }
      return function () {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerleave', leave);
        if (auto) auto();
        cancelAnimationFrame(raf);
        sheen.remove(); spark.remove();
      };
    }
  });

  MK.register({
    name: 'flashlight',
    selector: '[data-flashlight]',
    init: function (el) {
      if (MK.reduced || !MK.finePointer) return;
      MK.ensurePositioned(el);
      var cover = el.querySelector('[data-flashlight-cover]');
      if (!cover) {
        cover = d.createElement('div');
        cover.className = 'mk-flash-cover mk-internal';
        cover.setAttribute('aria-hidden', 'true');
        el.appendChild(cover);
      }
      cover.classList.add('mk-flash');
      el.classList.add('mk-flash-host');
      var radius = MK.num(el, 'data-flashlight', 220);
      el.style.setProperty('--mk-fl-size', radius + 'px');
      var x = -1, y = -1, tx = 0, ty = 0, hovering = false;
      // until the cursor arrives, the light wanders by itself so visitors discover the effect
      var stop = MK.ticker(el, function (t) {
        if (!hovering && !el.hasAttribute('data-flashlight-still')) {
          var w = el.clientWidth, h = el.clientHeight;
          tx = w * (0.5 + 0.34 * Math.sin(t * 0.00042)); ty = h * (0.5 + 0.26 * Math.sin(t * 0.00063 + 1.2));
          el.classList.add('mk-flash-on');
        }
        if (x < 0) { x = tx; y = ty; }
        x = MK.lerp(x, tx, hovering ? 0.22 : 0.05); y = MK.lerp(y, ty, hovering ? 0.22 : 0.05);
        el.style.setProperty('--mk-fx', x.toFixed(1) + 'px');
        el.style.setProperty('--mk-fy', y.toFixed(1) + 'px');
      });
      function move(e) {
        var r = el.getBoundingClientRect();
        tx = e.clientX - r.left; ty = e.clientY - r.top;
        hovering = true;
        el.classList.add('mk-flash-on');
      }
      function leave() { hovering = false; }
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerleave', leave);
      return function () { stop(); el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); };
    }
  });
})(window.MotionKit);;
/* Motion Kit - cursor: custom cursor follower (desktop only, hidden on touch)
 *   <body data-cursor>            a soft ring trails the native cursor
 *   <body data-cursor="dot">      replaces the native cursor with dot + ring
 *   <body data-cursor="blend">    big circle with mix-blend-mode: difference (inverts what it covers)
 *   <body data-cursor="blob">     liquid "gooey" blob that stretches as it follows the cursor
 *   data-cursor-text="View"       on any element: the ring grows and shows this label on hover
 *   data-cursor-hover             on any element: extra hover target (links/buttons are automatic)
 * Color with --mk-cursor (default: var(--mk-accent)).
 */
(function (MK) {
  'use strict';
  var d = document;
  var HOVER = 'a,button,[role="button"],input,textarea,select,label,summary,[data-cursor-hover],[data-cursor-text],[data-magnetic]';

  MK.register({
    name: 'cursor',
    selector: '[data-cursor]',
    init: function (el) {
      if (MK.reduced || !MK.finePointer || d.querySelector('.mk-cursor')) return;
      var mode = MK.attr(el, 'data-cursor', 'ring');
      var wrap = d.createElement('div');
      wrap.className = 'mk-cursor mk-internal mk-cursor--' + mode;
      wrap.setAttribute('aria-hidden', 'true');
      var ring = d.createElement('div');
      ring.className = 'mk-cursor-ring';
      var label = d.createElement('mk-span');
      label.className = 'mk-cursor-label';
      ring.appendChild(label);
      var dot = d.createElement('div');
      dot.className = 'mk-cursor-dot';
      wrap.appendChild(ring);
      wrap.appendChild(dot);
      // "blob": a chain of circles merged by an SVG goo filter into one liquid cursor
      var blobs = [];
      if (mode === 'blob') {
        var gid = 'mk-goo-' + Math.random().toString(36).slice(2, 7);
        var fx = d.createElementNS('http://www.w3.org/2000/svg', 'svg');
        fx.setAttribute('width', '0'); fx.setAttribute('height', '0');
        fx.style.position = 'absolute';
        fx.innerHTML = '<filter id="' + gid + '"><feGaussianBlur in="SourceGraphic" stdDeviation="9" result="b"/>' +
          '<feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9"/></filter>';
        wrap.appendChild(fx);
        var goo = d.createElement('div');
        goo.className = 'mk-cursor-goo';
        goo.style.filter = 'url(#' + gid + ')';
        for (var bi = 0; bi < 6; bi++) {
          var bl = d.createElement('div');
          bl.className = 'mk-cursor-blob';
          bl.style.setProperty('--s', (1 - bi * 0.12).toFixed(2));
          goo.appendChild(bl);
          blobs.push({ el: bl, x: -100, y: -100 });
        }
        wrap.appendChild(goo);
      }
      d.body.appendChild(wrap);
      if (mode === 'dot' || mode === 'blob') d.documentElement.classList.add('mk-cursor-none');

      var pos = { x: -100, y: -100 }, ringPos = { x: -100, y: -100 }, raf = 0, seen = false;
      function loop() {
        ringPos.x = MK.lerp(ringPos.x, pos.x, 0.2);
        ringPos.y = MK.lerp(ringPos.y, pos.y, 0.2);
        ring.style.transform = 'translate3d(' + ringPos.x.toFixed(1) + 'px,' + ringPos.y.toFixed(1) + 'px,0)';
        dot.style.transform = 'translate3d(' + pos.x + 'px,' + pos.y + 'px,0)';
        var moving = Math.abs(ringPos.x - pos.x) > 0.1 || Math.abs(ringPos.y - pos.y) > 0.1;
        for (var i = 0; i < blobs.length; i++) {
          var b = blobs[i], lead = i ? blobs[i - 1] : pos, k = i ? 0.35 : 0.5;
          b.x = MK.lerp(b.x, lead.x, k); b.y = MK.lerp(b.y, lead.y, k);
          b.el.style.transform = 'translate3d(' + b.x.toFixed(1) + 'px,' + b.y.toFixed(1) + 'px,0)';
          if (Math.abs(b.x - pos.x) > 0.2 || Math.abs(b.y - pos.y) > 0.2) moving = true;
        }
        if (moving) raf = requestAnimationFrame(loop);
        else raf = 0;
      }
      function move(e) {
        pos.x = e.clientX; pos.y = e.clientY;
        if (!seen) {
          seen = true; ringPos.x = pos.x; ringPos.y = pos.y;
          blobs.forEach(function (b) { b.x = pos.x; b.y = pos.y; });
        }
        wrap.classList.add('mk-visible');
        if (!raf) raf = requestAnimationFrame(loop);
      }
      function over(e) {
        var t = e.target.closest ? e.target.closest(HOVER) : null;
        wrap.classList.toggle('mk-hover', !!t);
        var txt = t && t.getAttribute('data-cursor-text');
        label.textContent = txt || '';
        wrap.classList.toggle('mk-has-label', !!txt);
      }
      function down() { wrap.classList.add('mk-press'); }
      function up() { wrap.classList.remove('mk-press'); }
      function out(e) { if (!e.relatedTarget) wrap.classList.remove('mk-visible'); }
      d.addEventListener('pointermove', move, { passive: true });
      d.addEventListener('pointerover', over);
      d.addEventListener('pointerdown', down);
      d.addEventListener('pointerup', up);
      d.addEventListener('pointerout', out);
      return function () {
        d.removeEventListener('pointermove', move);
        d.removeEventListener('pointerover', over);
        d.removeEventListener('pointerdown', down);
        d.removeEventListener('pointerup', up);
        d.removeEventListener('pointerout', out);
        d.documentElement.classList.remove('mk-cursor-none');
        wrap.remove();
      };
    }
  });
})(window.MotionKit);;
/* Motion Kit - trail: cursor trails drawn on a full-screen canvas (desktop only)
 *   <body data-cursor-trail="glow">      a glowing neon ribbon that follows the cursor and fades
 *   <body data-cursor-trail="sparkle">   twinkling star sparkles spill from the cursor
 *   <body data-cursor-trail="comet">     a bright head with a long particle tail
 * Colors: --mk-c1..3. Put it on <body> (or any element: the trail is page-wide either way).
 */
(function (MK) {
  'use strict';
  var d = document;

  MK.register({
    name: 'trail',
    selector: '[data-cursor-trail]',
    init: function (el) {
      if (MK.reduced || !MK.finePointer || d.querySelector('.mk-trail')) return;
      var mode = MK.attr(el, 'data-cursor-trail', 'glow');
      var cols = MK.colors(el, 'data-trail-colors').map(function (c) { return MK.rgb(c).join(','); });
      var canvas = d.createElement('canvas');
      canvas.className = 'mk-trail mk-internal';
      canvas.setAttribute('aria-hidden', 'true');
      d.body.appendChild(canvas);
      var ctx = canvas.getContext('2d'), dpr = 1, W = 0, H = 0;
      function size() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = window.innerWidth; H = window.innerHeight;
        canvas.width = W * dpr; canvas.height = H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      size();
      window.addEventListener('resize', size);
      var pts = [], sparks = [], last = null, raf = 0, idle = 0;

      function onMove(e) {
        var now = performance.now();
        var p = { x: e.clientX, y: e.clientY, t: now };
        if (mode === 'glow') pts.push(p);
        else {
          var dist = last ? Math.hypot(p.x - last.x, p.y - last.y) : 0;
          var n = mode === 'comet' ? Math.min(6, 1 + dist / 6) : Math.min(4, dist / 10);
          for (var i = 0; i < n; i++) {
            var a = Math.random() * Math.PI * 2, sp = mode === 'comet' ? Math.random() * 0.6 : 0.4 + Math.random() * 1.6;
            sparks.push({
              x: p.x + (Math.random() - 0.5) * 6, y: p.y + (Math.random() - 0.5) * 6,
              vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + (mode === 'sparkle' ? 0.2 : 0),
              life: 1, decay: mode === 'comet' ? 0.018 + Math.random() * 0.02 : 0.012 + Math.random() * 0.02,
              s: mode === 'comet' ? 1.5 + Math.random() * 2.5 : 3 + Math.random() * 5, c: cols[(Math.random() * cols.length) | 0],
              r: Math.random() * Math.PI
            });
          }
        }
        last = p;
        idle = 0;
        if (!raf) raf = requestAnimationFrame(frame);
      }
      function star(x, y, s, rot) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rot);
        ctx.beginPath();
        for (var i = 0; i < 4; i++) {
          ctx.lineTo(0, -s);
          ctx.rotate(Math.PI / 4);
          ctx.lineTo(0, -s * 0.28);
          ctx.rotate(Math.PI / 4);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      function frame() {
        raf = 0;
        ctx.clearRect(0, 0, W, H);
        var now = performance.now();
        if (mode === 'glow') {
          while (pts.length && now - pts[0].t > 420) pts.shift();
          if (pts.length > 1) {
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalCompositeOperation = 'lighter';
            for (var i = 1; i < pts.length; i++) {
              var a = pts[i - 1], b = pts[i], k = i / pts.length;
              var c = cols[Math.min(cols.length - 1, Math.floor(k * cols.length))];
              ctx.strokeStyle = 'rgba(' + c + ',' + (k * 0.9).toFixed(3) + ')';
              ctx.lineWidth = 1 + k * 9;
              ctx.shadowColor = 'rgba(' + c + ',0.9)';
              ctx.shadowBlur = 14 * k;
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.stroke();
            }
            ctx.shadowBlur = 0;
            ctx.globalCompositeOperation = 'source-over';
          }
          if (pts.length) raf = requestAnimationFrame(frame);
        } else {
          ctx.globalCompositeOperation = 'lighter';
          for (var j = sparks.length - 1; j >= 0; j--) {
            var s = sparks[j];
            s.x += s.vx; s.y += s.vy; s.vy += mode === 'sparkle' ? 0.03 : 0; s.life -= s.decay; s.r += 0.05;
            if (s.life <= 0) { sparks.splice(j, 1); continue; }
            ctx.fillStyle = 'rgba(' + s.c + ',' + s.life.toFixed(3) + ')';
            if (mode === 'sparkle') star(s.x, s.y, s.s * s.life, s.r);
            else { ctx.beginPath(); ctx.arc(s.x, s.y, s.s * s.life, 0, 6.2832); ctx.fill(); }
          }
          if (mode === 'comet' && last && now - last.t < 120) {
            var g = ctx.createRadialGradient(last.x, last.y, 0, last.x, last.y, 16);
            g.addColorStop(0, 'rgba(255,255,255,0.95)');
            g.addColorStop(1, 'rgba(' + cols[0] + ',0)');
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(last.x, last.y, 16, 0, 6.2832); ctx.fill();
          }
          ctx.globalCompositeOperation = 'source-over';
          if (sparks.length) raf = requestAnimationFrame(frame);
        }
      }
      d.addEventListener('pointermove', onMove, { passive: true });
      return function () {
        d.removeEventListener('pointermove', onMove);
        window.removeEventListener('resize', size);
        cancelAnimationFrame(raf);
        canvas.remove();
      };
    }
  });
})(window.MotionKit);;
/* Motion Kit - image-trail and hover-image: image effects that follow the cursor (agency / portfolio classics)
 *   <section data-image-trail="a.jpg|b.jpg|c.jpg">   moving the cursor over the section leaves a trail of images
 *        Options: data-image-trail-size="220" (px width) data-image-trail-gap="90" (px of movement per image)
 *   <ul data-hover-image> <li data-hover-image="p1.jpg">Project one</li> ... </ul>
 *        a floating preview follows the cursor, tilting with its speed and cross-fading between items.
 *        Options on the list: data-hover-image-size="320"
 * Desktop only. Images are decorative (alt=""); keep real content in the markup.
 */
(function (MK) {
  'use strict';
  var d = document;

  MK.register({
    name: 'image-trail',
    selector: '[data-image-trail]',
    init: function (el) {
      var list = (el.getAttribute('data-image-trail') || '').split('|').map(function (s) { return s.trim(); }).filter(Boolean);
      if (MK.reduced || !MK.finePointer || !list.length) return;
      MK.ensurePositioned(el);
      el.classList.add('mk-itrail-host');
      var layer = d.createElement('div');
      layer.className = 'mk-itrail mk-internal';
      layer.setAttribute('aria-hidden', 'true');
      el.insertBefore(layer, el.firstChild);
      var size = MK.num(el, 'data-image-trail-size', 220), gap = MK.num(el, 'data-image-trail-gap', 90);
      list.forEach(function (src) { var i = new Image(); i.src = src; }); // preload
      var lx = null, ly = null, idx = 0, z = 1;
      function move(e) {
        var r = el.getBoundingClientRect();
        var x = e.clientX - r.left, y = e.clientY - r.top;
        if (lx === null) { lx = x; ly = y; return; }
        if (Math.hypot(x - lx, y - ly) < gap) return;
        var dx = x - lx;
        lx = x; ly = y;
        var img = d.createElement('img');
        img.src = list[idx++ % list.length];
        img.alt = '';
        img.className = 'mk-itrail-img';
        img.style.width = size + 'px';
        img.style.left = x + 'px';
        img.style.top = y + 'px';
        img.style.zIndex = String(z++);
        img.style.setProperty('--mk-r', (MK.clamp(dx * 0.25, -14, 14)).toFixed(1) + 'deg');
        layer.appendChild(img);
        setTimeout(function () { img.classList.add('mk-out'); }, 650);
        setTimeout(function () { img.remove(); }, 1500);
      }
      function leave() { lx = ly = null; }
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerleave', leave);
      return function () { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); layer.remove(); };
    }
  });

  MK.register({
    name: 'hover-image',
    selector: '[data-hover-image=""]',
    init: function (list) {
      var items = Array.prototype.slice.call(list.querySelectorAll('[data-hover-image]')).filter(function (i) { return i !== list; });
      if (MK.reduced || !MK.finePointer || !items.length) return;
      var size = MK.num(list, 'data-hover-image-size', 320);
      var box = d.createElement('div');
      box.className = 'mk-hover-img mk-internal';
      box.setAttribute('aria-hidden', 'true');
      box.style.width = size + 'px';
      var a = d.createElement('img'), b = d.createElement('img');
      a.alt = b.alt = '';
      box.appendChild(a); box.appendChild(b);
      d.body.appendChild(box);
      items.forEach(function (i) { var im = new Image(); im.src = i.getAttribute('data-hover-image'); });
      var x = 0, y = 0, tx = 0, ty = 0, vx = 0, shown = false, front = a, raf = 0, current = null;
      function loop() {
        vx = MK.lerp(vx, tx - x, 0.2);
        x = MK.lerp(x, tx, 0.14); y = MK.lerp(y, ty, 0.14);
        box.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) translate(-50%,-50%) rotate(' +
          MK.clamp(vx * 0.12, -12, 12).toFixed(2) + 'deg)';
        if (shown || Math.abs(tx - x) > 0.5) raf = requestAnimationFrame(loop); else raf = 0;
      }
      function show(item) {
        var src = item.getAttribute('data-hover-image');
        if (current !== src) {
          var back = front === a ? b : a;
          back.src = src;
          back.classList.add('mk-on');
          front.classList.remove('mk-on');
          front = back;
          current = src;
        }
        if (!shown) { x = tx; y = ty; }
        shown = true;
        box.classList.add('mk-visible');
        if (!raf) raf = requestAnimationFrame(loop);
      }
      function over(e) {
        var item = e.target.closest && e.target.closest('[data-hover-image]');
        if (item && item !== list && list.contains(item)) show(item);
      }
      function move(e) { tx = e.clientX; ty = e.clientY; }
      function leave() { shown = false; box.classList.remove('mk-visible'); }
      list.addEventListener('pointerover', over);
      list.addEventListener('pointermove', move);
      list.addEventListener('pointerleave', leave);
      return function () {
        list.removeEventListener('pointerover', over);
        list.removeEventListener('pointermove', move);
        list.removeEventListener('pointerleave', leave);
        cancelAnimationFrame(raf);
        box.remove();
      };
    }
  });
})(window.MotionKit);;
/* Motion Kit - widgets: interactive 3D and physics toys
 *   <div data-carousel> <img ...> <img ...> ... </div>
 *       children form a 3D ring that auto-rotates; drag/swipe to spin it with inertia; hover pauses.
 *       Options: data-carousel="12" (auto speed, degrees per second; 0 = off) data-carousel-gap="24"
 *   <nav data-dock> <a>..</a> <a>..</a> </nav>
 *       macOS-dock magnification: items near the cursor grow and push their neighbours.
 *       Options: data-dock="1.8" (max scale) data-dock-range="150" (px)
 *   data-drag            drag and throw an element (it glides and bounces inside its parent)
 *   data-drag="spring"   springs back home when released (stickers, badges, playful UI)
 */
(function (MK) {
  'use strict';
  var d = document;

  MK.register({
    name: 'carousel',
    selector: '[data-carousel]',
    init: function (el) {
      var items = Array.prototype.slice.call(el.children).filter(function (c) { return !c.classList.contains('mk-carousel-ring'); });
      var ring = el.querySelector(':scope > .mk-carousel-ring');
      if (!ring) {
        if (items.length < 3) return;
        ring = d.createElement('div');
        ring.className = 'mk-carousel-ring';
        items.forEach(function (c) { ring.appendChild(c); });
        el.appendChild(ring);
      }
      items = Array.prototype.slice.call(ring.children);
      el.classList.add('mk-carousel');
      if (MK.reduced) { el.classList.add('mk-carousel-static'); return; }
      var n = items.length, R = 300, angle = 0, vel = 0, dragging = false, hover = false, lastX = 0;
      var auto = MK.num(el, 'data-carousel', 12), gap = MK.num(el, 'data-carousel-gap', 24);
      function layout() {
        var w = items[0].offsetWidth || 200;
        R = Math.round((w / 2 + gap / 2) / Math.tan(Math.PI / n));
        items.forEach(function (c, i) { c.style.transform = 'rotateY(' + (i * 360 / n) + 'deg) translateZ(' + R + 'px)'; });
      }
      layout();
      var ro = window.ResizeObserver ? new ResizeObserver(layout) : null;
      if (ro) ro.observe(items[0]);
      var pressed = false, startX = 0, pid = null;
      function down(e) { pressed = true; startX = lastX = e.clientX; pid = e.pointerId; }
      function move(e) {
        if (!pressed) return;
        // only start dragging after a few px so clicks on links/buttons inside still work
        if (!dragging && Math.abs(e.clientX - startX) > 6) {
          dragging = true; vel = 0;
          if (el.setPointerCapture) try { el.setPointerCapture(pid); } catch (err) {}
          el.classList.add('mk-grabbing');
        }
        if (!dragging) return;
        var dx = e.clientX - lastX;
        lastX = e.clientX;
        angle += dx * 0.25;
        vel = dx * 0.25;
      }
      function up() { pressed = false; dragging = false; el.classList.remove('mk-grabbing'); }
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('pointerenter', function () { hover = true; });
      el.addEventListener('pointerleave', function () { hover = false; });
      var speed = auto;
      var stop = MK.ticker(el, function (t, dt) {
        if (!dragging) {
          vel *= 0.94;
          speed = MK.lerp(speed, hover ? 0 : auto, 0.05);
          angle += vel + speed * (dt / 1000);
        }
        ring.style.transform = 'translateZ(' + (-R) + 'px) rotateY(' + angle.toFixed(2) + 'deg)';
        for (var i = 0; i < n; i++) {
          var a = ((i * 360 / n + angle) % 360 + 360) % 360;
          var facing = Math.cos(a * Math.PI / 180);
          items[i].style.setProperty('--mk-face', ((facing + 1) / 2).toFixed(3));
        }
      });
      return function () { stop(); if (ro) ro.disconnect(); };
    }
  });

  MK.register({
    name: 'dock',
    selector: '[data-dock]',
    init: function (el) {
      var items = Array.prototype.slice.call(el.children);
      el.classList.add('mk-dock');
      if (MK.reduced || !MK.finePointer || !items.length) return;
      var max = MK.num(el, 'data-dock', 1.8), range = MK.num(el, 'data-dock-range', 150);
      var base = [], cur = items.map(function () { return 1; }), tgt = cur.slice(), raf = 0, vertical = false;
      function measure() {
        base = items.map(function (c) {
          var r = c.getBoundingClientRect();
          return { c: r.left + r.width / 2, m: r.top + r.height / 2, w: r.width, h: r.height };
        });
        var er = el.getBoundingClientRect();
        vertical = er.height > er.width * 1.5;
      }
      function loop() {
        var moving = false;
        for (var i = 0; i < items.length; i++) {
          cur[i] = MK.lerp(cur[i], tgt[i], 0.22);
          if (Math.abs(cur[i] - tgt[i]) > 0.002) moving = true;
          var s = cur[i], it = items[i];
          it.style.scale = s.toFixed(3);
          var grow = ((s - 1) * (vertical ? base[i].h : base[i].w) / 2).toFixed(1) + 'px';
          if (vertical) { it.style.marginBlock = grow; } else { it.style.marginInline = grow; }
        }
        raf = moving ? requestAnimationFrame(loop) : 0;
      }
      function kick() { if (!raf) raf = requestAnimationFrame(loop); }
      function enter() { if (cur.every(function (s) { return s < 1.01; })) measure(); }
      function move(e) {
        if (!base.length) measure();
        for (var i = 0; i < items.length; i++) {
          var dist = vertical ? Math.abs(e.clientY - base[i].m) : Math.abs(e.clientX - base[i].c);
          var f = dist >= range ? 0 : (Math.cos((dist / range) * Math.PI) + 1) / 2;
          tgt[i] = 1 + (max - 1) * f;
        }
        kick();
      }
      function leave() { tgt = tgt.map(function () { return 1; }); kick(); }
      el.addEventListener('pointerenter', enter);
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerleave', leave);
      window.addEventListener('resize', measure);
      return function () {
        el.removeEventListener('pointerenter', enter);
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerleave', leave);
        window.removeEventListener('resize', measure);
      };
    }
  });

  MK.register({
    name: 'drag',
    selector: '[data-drag]',
    init: function (el) {
      var spring = el.getAttribute('data-drag') === 'spring';
      el.classList.add('mk-drag');
      var x = 0, y = 0, vx = 0, vy = 0, sx = 0, sy = 0, px = 0, py = 0, dragging = false, raf = 0, lastT = 0;
      function apply() {
        el.style.translate = x.toFixed(1) + 'px ' + y.toFixed(1) + 'px';
        el.style.rotate = MK.reduced ? '' : MK.clamp(vx * 0.6, -18, 18).toFixed(2) + 'deg';
      }
      function bounds() {
        var parent = el.offsetParent || el.parentElement || d.body;
        var pr = parent.getBoundingClientRect(), r = el.getBoundingClientRect();
        return { minX: x - (r.left - pr.left), maxX: x + (pr.right - r.right), minY: y - (r.top - pr.top), maxY: y + (pr.bottom - r.bottom) };
      }
      function loop() {
        raf = 0;
        if (dragging) return;
        if (spring) {
          vx = (vx + -x * 0.08) * 0.82; vy = (vy + -y * 0.08) * 0.82;
        } else {
          vx *= 0.93; vy *= 0.93;
          var b = bounds();
          if (x + vx < b.minX || x + vx > b.maxX) vx *= -0.6;
          if (y + vy < b.minY || y + vy > b.maxY) vy *= -0.6;
        }
        x += vx; y += vy;
        apply();
        if (Math.abs(vx) + Math.abs(vy) > 0.05 || (spring && Math.abs(x) + Math.abs(y) > 0.3)) raf = requestAnimationFrame(loop);
        else if (spring) { x = y = 0; vx = 0; apply(); el.style.rotate = ''; }
      }
      function down(e) {
        dragging = true; sx = e.clientX - x; sy = e.clientY - y; px = e.clientX; py = e.clientY; lastT = performance.now();
        vx = vy = 0;
        el.setPointerCapture && el.setPointerCapture(e.pointerId);
        el.classList.add('mk-dragging');
        e.preventDefault();
      }
      function move(e) {
        if (!dragging) return;
        var now = performance.now(), dt = Math.max(8, now - lastT);
        x = e.clientX - sx; y = e.clientY - sy;
        vx = MK.lerp(vx, (e.clientX - px) * (16 / dt), 0.5);
        vy = MK.lerp(vy, (e.clientY - py) * (16 / dt), 0.5);
        px = e.clientX; py = e.clientY; lastT = now;
        apply();
      }
      function up() {
        if (!dragging) return;
        dragging = false;
        el.classList.remove('mk-dragging');
        if (MK.reduced && !spring) { vx = vy = 0; return; }
        if (!raf) raf = requestAnimationFrame(loop);
      }
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      return function () {
        el.removeEventListener('pointerdown', down);
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
        cancelAnimationFrame(raf);
      };
    }
  });
})(window.MotionKit);;
/* Motion Kit - marquee: seamless infinite scrolling rows (logos, testimonials, big words)
 *   <div data-marquee> <span>Item</span> <span>Item</span> ... </div>
 * Options: data-marquee-speed="60" (px/sec)  data-marquee-direction="left|right|up|down"
 *          data-marquee-pause (slow to a stop on hover)  data-marquee-scroll (speeds up & flips with scroll)
 *          --mk-gap CSS var for spacing (default 3rem). Vertical marquees need a fixed height.
 * Add class "mk-marquee-fade" to fade the edges.
 */
(function (MK) {
  'use strict';
  var d = document;

  MK.register({
    name: 'marquee',
    selector: '[data-marquee]',
    init: function (el) {
      var dir = MK.attr(el, 'data-marquee-direction', MK.attr(el, 'data-marquee', 'left'));
      if (!/^(left|right|up|down)$/.test(dir)) dir = 'left';
      var vertical = dir === 'up' || dir === 'down';
      el.classList.add('mk-marquee', vertical ? 'mk-marquee-v' : 'mk-marquee-h');

      var track = el.querySelector(':scope > .mk-marquee-track');
      var group;
      if (!track) {
        track = d.createElement('div');
        track.className = 'mk-marquee-track';
        group = d.createElement('div');
        group.className = 'mk-marquee-group';
        while (el.firstChild) group.appendChild(el.firstChild);
        track.appendChild(group);
        el.appendChild(track);
      } else {
        group = track.querySelector(':scope > .mk-marquee-group') || track;
      }
      if (MK.reduced) { el.classList.add('mk-marquee-static'); return; }

      var speed = MK.num(el, 'data-marquee-speed', 60);
      var anim = null, clones = [], rate = 1, targetRate = 1, hovering = false;

      function build() {
        clones.forEach(function (c) { c.remove(); });
        clones = [];
        var size = vertical ? group.offsetHeight : group.offsetWidth;
        var box = vertical ? el.clientHeight : el.clientWidth;
        if (!size) return;
        var copies = Math.max(1, Math.ceil(box / size)) + 1;
        for (var i = 0; i < copies; i++) {
          var c = group.cloneNode(true);
          c.setAttribute('aria-hidden', 'true');
          c.setAttribute('inert', '');
          track.appendChild(c);
          clones.push(c);
        }
        if (anim) anim.cancel();
        var shift = vertical ? 'translate3d(0,' + (-size) + 'px,0)' : 'translate3d(' + (-size) + 'px,0,0)';
        anim = track.animate([{ transform: 'translate3d(0,0,0)' }, { transform: shift }], {
          duration: (size / Math.max(1, speed)) * 1000,
          iterations: Infinity,
          easing: 'linear',
          direction: dir === 'right' || dir === 'down' ? 'reverse' : 'normal'
        });
        anim.playbackRate = rate;
      }

      var lastSize = 0;
      var ro = window.ResizeObserver ? new ResizeObserver(function () {
        var s = (vertical ? group.offsetHeight : group.offsetWidth) + 'x' + (vertical ? el.clientHeight : el.clientWidth);
        if (s !== lastSize) { lastSize = s; build(); }
      }) : null;
      if (ro) { ro.observe(el); ro.observe(group); } else build();

      var pauseOnHover = el.hasAttribute('data-marquee-pause');
      var scrollBoost = el.hasAttribute('data-marquee-scroll');
      function enter() { hovering = true; }
      function leave() { hovering = false; }
      if (pauseOnHover) {
        el.addEventListener('pointerenter', enter);
        el.addEventListener('pointerleave', leave);
      }
      var sign = 1, lastY = window.pageYOffset, vel = 0;
      var stopTick = MK.ticker(el, function () {
        if (!anim) return;
        if (scrollBoost) {
          var y = window.pageYOffset;
          vel = MK.lerp(vel, y - lastY, 0.25);
          lastY = y;
          if (Math.abs(vel) > 0.5) sign = vel > 0 ? 1 : -1;
          targetRate = sign * (1 + Math.min(Math.abs(vel) * 0.15, 5));
        } else {
          targetRate = 1;
        }
        if (hovering) targetRate = 0;
        rate = MK.lerp(rate, targetRate, 0.08);
        if (Math.abs(rate - targetRate) < 0.001) rate = targetRate;
        if (anim.playbackRate !== rate) anim.playbackRate = rate;
      });
      var offView = MK.inView(el, function (v) { if (anim) { if (v) anim.play(); else anim.pause(); } });
      return function () {
        stopTick(); offView();
        if (ro) ro.disconnect();
        if (anim) anim.cancel();
        el.removeEventListener('pointerenter', enter);
        el.removeEventListener('pointerleave', leave);
      };
    }
  });
})(window.MotionKit);;
/* Motion Kit - draw: SVG line drawing
 *   <svg data-draw> ...paths with a stroke... </svg>   strokes draw themselves when scrolled into view
 *   data-draw="scroll"          the drawing is scrubbed by scroll position instead
 * Options: data-draw-duration="1800" data-draw-stagger="150" data-draw-delay="0"
 *          data-draw-fill (fade in the shapes' fill after the stroke finishes)
 * Works on path, line, polyline, polygon, circle, ellipse and rect (needs a stroke color).
 */
(function (MK) {
  'use strict';
  var SHAPES = 'path,line,polyline,polygon,circle,ellipse,rect';

  MK.register({
    name: 'draw',
    selector: '[data-draw]',
    init: function (el) {
      var shapes = el.matches(SHAPES) ? [el] : Array.prototype.slice.call(el.querySelectorAll(SHAPES));
      shapes = shapes.filter(function (s) { return typeof s.getTotalLength === 'function'; });
      if (!shapes.length) return;
      var lens = shapes.map(function (s) {
        var len = 0;
        try { len = s.getTotalLength(); } catch (e) {}
        len = Math.ceil(len) + 1;
        s.style.strokeDasharray = len + ' ' + len;
        s.style.strokeDashoffset = MK.reduced ? '0' : String(len);
        return len;
      });
      var withFill = el.hasAttribute('data-draw-fill');
      if (MK.reduced) return;
      if (withFill) shapes.forEach(function (s) { s.style.fillOpacity = '0'; });

      if (el.getAttribute('data-draw') === 'scroll') {
        var active = false;
        var offView = MK.inView(el, function (v) { active = v; if (v) MK.update(); }, { rootMargin: '10% 0px' });
        var offScroll = MK.onScroll(function (y, vh) {
          if (!active) return;
          var r = el.getBoundingClientRect();
          var p = MK.clamp((vh * 0.9 - r.top) / (vh * 0.9 - vh * 0.25 + r.height * 0.5), 0, 1);
          shapes.forEach(function (s, i) {
            s.style.strokeDashoffset = String(lens[i] * (1 - p));
            if (withFill) s.style.fillOpacity = p > 0.98 ? '1' : '0';
          });
        });
        return function () { offView(); offScroll(); };
      }

      var dur = MK.ms(el, 'data-draw-duration', 1800);
      var stagger = MK.ms(el, 'data-draw-stagger', 120);
      var delay = MK.ms(el, 'data-draw-delay', 0);
      return MK.onEnter(el, function () {
        shapes.forEach(function (s, i) {
          var dl = delay + i * stagger;
          s.style.transition = 'stroke-dashoffset ' + dur + 'ms cubic-bezier(.65,0,.35,1) ' + dl + 'ms' +
            (withFill ? ', fill-opacity .8s ease ' + (dl + dur * 0.8) + 'ms' : '');
          // force style flush so the transition starts from the hidden state
          s.getBoundingClientRect();
          s.style.strokeDashoffset = '0';
          if (withFill) s.style.fillOpacity = '1';
        });
        setTimeout(function () { MK.emit(el, 'drawn'); }, delay + dur + stagger * shapes.length);
      });
    }
  });
})(window.MotionKit);;
/* Motion Kit - loader: intro screen that reveals the page (entrance animations wait for it)
 *   <div data-loader="curtain"> <span class="logo">BRAND</span> <span data-loader-count>0</span> </div>
 * Types: fade | curtain (slides up) | split (opens from the middle) | circle (shrinks to a dot) | columns (bars wipe up)
 * Options: data-loader-min="900" (ms it stays at least)  data-loader-max="5000" (failsafe)
 * The element is styled as a full-screen overlay; give it your own background/colors.
 * [data-loader-count] shows 0-100%.
 */
(function (MK) {
  'use strict';
  var root = document.documentElement;

  MK.register({
    name: 'loader',
    selector: '[data-loader]',
    init: function (el) {
      var type = MK.attr(el, 'data-loader', 'fade');
      el.classList.add('mk-loader', 'mk-loader--' + type);
      el.setAttribute('aria-hidden', 'true');
      if (type === 'columns' && !el.querySelector(':scope > .mk-loader-cols')) {
        var cols = document.createElement('div');
        cols.className = 'mk-loader-cols';
        for (var ci = 0; ci < 5; ci++) { var bar = document.createElement('i'); bar.style.setProperty('--i', ci); cols.appendChild(bar); }
        el.insertBefore(cols, el.firstChild);
      }
      var count = el.querySelector('[data-loader-count]');
      var minTime = MK.ms(el, 'data-loader-min', 900);
      var maxTime = MK.ms(el, 'data-loader-max', 5000);
      var t0 = performance.now();
      var loaded = document.readyState === 'complete';
      var p = 0, done = false, raf = 0;

      if (MK.reduced) { el.remove(); return; }
      MK.hold();
      root.classList.add('mk-loading');

      function onLoad() { loaded = true; }
      if (!loaded) window.addEventListener('load', onLoad);

      function finish() {
        if (done) return;
        done = true;
        cancelAnimationFrame(raf);
        if (count) count.textContent = '100';
        el.classList.add('mk-loader-out');
        var removed = false;
        function cleanup() {
          if (removed) return;
          removed = true;
          el.remove();
        }
        el.addEventListener('transitionend', function (e) { if (e.target === el) cleanup(); });
        setTimeout(cleanup, 1600);
        // start the page's entrance animations as the loader leaves
        setTimeout(function () {
          root.classList.remove('mk-loading');
          MK.release();
        }, type === 'fade' ? 150 : 350);
      }

      function frame() {
        var elapsed = performance.now() - t0;
        var target = loaded ? 1 : 0.86;
        p += (target - p) * (loaded ? 0.12 : 0.03);
        if (count) count.textContent = String(Math.min(100, Math.round(p * 100)));
        if ((loaded && p > 0.995 && elapsed >= minTime) || elapsed > maxTime) { finish(); return; }
        raf = requestAnimationFrame(frame);
      }
      raf = requestAnimationFrame(frame);
      setTimeout(finish, maxTime + 100);
      return function () { window.removeEventListener('load', onLoad); finish(); };
    }
  });
})(window.MotionKit);;
/* Motion Kit - transition: animated page-to-page navigation for multi-page sites
 *   <body data-transition="curtain">     fade | curtain | slide | columns | view
 *   "view" uses the browser's native cross-document View Transitions (Chrome/Edge/Safari 18+).
 * Same-site links animate out, the next page animates in. Opt a link out with data-no-transition.
 * Color the overlay with --mk-pt-bg.
 */
(function (MK) {
  'use strict';
  var d = document, root = d.documentElement, KEY = 'mk-pt';

  // sessionStorage is blocked on file:// pages and in some sandboxes, so window.name is the fallback flag
  var NAME_RE = /(^|\|)mk-pt$/;
  function store(v) {
    try { if (v) sessionStorage.setItem(KEY, v); else sessionStorage.removeItem(KEY); } catch (e) {}
    try {
      var n = (window.name || '').replace(NAME_RE, '');
      window.name = v ? (n ? n + '|' : '') + 'mk-pt' : n;
    } catch (e) {}
  }
  function stored() {
    var v = null;
    try { v = sessionStorage.getItem(KEY); } catch (e) {}
    return v || (NAME_RE.test(window.name || '') ? '1' : null);
  }

  MK.register({
    name: 'transition',
    selector: '[data-transition]',
    init: function (el) {
      if (el !== d.body && el !== root) return;
      var type = MK.attr(el, 'data-transition', 'fade');
      if (MK.reduced) { root.classList.remove('mk-pt-in'); store(null); return; }

      if (type === 'view') {
        var st = d.createElement('style');
        st.textContent = '@view-transition{navigation:auto}' +
          '::view-transition-old(root){animation:mk-vt-out .45s cubic-bezier(.65,0,.35,1) both}' +
          '::view-transition-new(root){animation:mk-vt-in .6s cubic-bezier(.16,1,.3,1) both}' +
          '@keyframes mk-vt-out{to{opacity:0;translate:0 -24px}}@keyframes mk-vt-in{from{opacity:0;translate:0 32px}}';
        d.head.appendChild(st);
        return;
      }

      var ov = d.createElement('div');
      ov.className = 'mk-pt mk-internal mk-pt--' + type;
      ov.setAttribute('aria-hidden', 'true');
      if (type === 'columns') for (var ci = 0; ci < 5; ci++) { var bar = d.createElement('i'); bar.style.setProperty('--i', ci); ov.appendChild(bar); }
      d.body.appendChild(ov);

      // entering: if the previous page animated out, start covered and reveal
      if (stored() || root.classList.contains('mk-pt-in')) {
        ov.classList.add('mk-pt-cover');
        root.classList.remove('mk-pt-in');
        store(null);
        MK.hold();
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            ov.classList.remove('mk-pt-cover');
            ov.classList.add('mk-pt-reveal');
            setTimeout(function () { MK.release(); }, 250);
            setTimeout(function () { ov.classList.remove('mk-pt-reveal'); }, 1250);
          });
        });
      }

      function onClick(e) {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        var a = e.target.closest && e.target.closest('a[href]');
        if (!a || a.hasAttribute('download') || a.hasAttribute('data-no-transition')) return;
        if (a.target && a.target !== '_self') return;
        var url;
        try { url = new URL(a.href, location.href); } catch (err) { return; }
        if (url.origin !== location.origin || !/^(https?|file):$/.test(url.protocol)) return;
        if (url.pathname === location.pathname && url.search === location.search) return; // same page / #hash
        e.preventDefault();
        store('1');
        ov.classList.remove('mk-pt-reveal');
        ov.classList.add('mk-pt-leave');
        setTimeout(function () { location.href = url.href; }, type === 'fade' ? 350 : type === 'columns' ? 900 : 650);
      }
      function onShow(e) {
        if (e.persisted) { ov.classList.remove('mk-pt-leave', 'mk-pt-cover'); store(null); }
      }
      d.addEventListener('click', onClick);
      window.addEventListener('pageshow', onShow);
      return function () {
        d.removeEventListener('click', onClick);
        window.removeEventListener('pageshow', onShow);
        ov.remove();
      };
    }
  });
})(window.MotionKit);;
/* Motion Kit - confetti: celebratory bursts
 *   <button data-confetti>Sign up</button>        burst from the element on click
 *   <div data-confetti="view">                     burst once when scrolled into view
 *   MotionKit.confetti({ x: 200, y: 300, count: 120, colors: ['#f00', '#0f0'] })   from JS
 *   <button data-burst>Like</button>               radial spark burst from the click point (small, snappy)
 *   MotionKit.burst({ x, y, count: 26, colors })   from JS
 * Colors default to data-confetti-colors="#a,#b" or --mk-c1..3.
 */
(function (MK) {
  'use strict';
  var d = document, canvas = null, ctx = null, parts = [], raf = 0, dpr = 1;

  function ensure() {
    if (canvas) return;
    canvas = d.createElement('canvas');
    canvas.className = 'mk-confetti mk-internal';
    canvas.setAttribute('aria-hidden', 'true');
    d.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    size();
    window.addEventListener('resize', size);
  }
  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
  }
  function frame() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    var h = window.innerHeight;
    parts = parts.filter(function (p) { return p.y < h + 40 && p.life > 0; });
    parts.forEach(function (p) {
      if (p.spark) {
        p.vx *= 0.9; p.vy *= 0.9; p.x += p.vx; p.y += p.vy; p.life -= 1;
        ctx.globalAlpha = Math.min(1, p.life / 18);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.s;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x - p.vx * 2.2, p.y - p.vy * 2.2); ctx.lineTo(p.x, p.y); ctx.stroke();
        return;
      }
      p.vx *= 0.985; p.vy = p.vy * 0.985 + 0.32;
      p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life -= 1;
      p.tilt += 0.1;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.min(1, p.life / 40);
      ctx.fillStyle = p.color;
      if (p.shape === 0) ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2 * Math.abs(Math.cos(p.tilt)) + 1);
      else { ctx.beginPath(); ctx.arc(0, 0, p.s / 3, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    });
    if (parts.length) raf = requestAnimationFrame(frame);
    else { raf = 0; ctx.clearRect(0, 0, canvas.width, canvas.height); }
  }

  MK.confetti = function (o) {
    if (MK.reduced) return;
    o = o || {};
    ensure();
    var colors = o.colors || ['#8b5cf6', '#06b6d4', '#f472b6', '#facc15', '#22c55e'];
    var n = o.count || 110, spread = (o.spread || 70) * Math.PI / 180;
    var x = o.x != null ? o.x : window.innerWidth / 2, y = o.y != null ? o.y : window.innerHeight / 2;
    for (var i = 0; i < n; i++) {
      var ang = -Math.PI / 2 + (Math.random() - 0.5) * spread * 2;
      var sp = 7 + Math.random() * 9 * (o.power || 1);
      parts.push({
        x: x, y: y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.3, tilt: Math.random() * 6,
        s: 7 + Math.random() * 7, color: colors[i % colors.length], shape: Math.random() < 0.7 ? 0 : 1,
        life: 160 + Math.random() * 60
      });
    }
    if (!raf) raf = requestAnimationFrame(frame);
  };

  MK.burst = function (o) {
    if (MK.reduced) return;
    o = o || {};
    ensure();
    var colors = o.colors || ['#8b5cf6', '#06b6d4', '#f472b6'];
    var n = o.count || 26;
    for (var i = 0; i < n; i++) {
      var ang = (i / n) * Math.PI * 2 + Math.random() * 0.3, sp = 5 + Math.random() * 7 * (o.power || 1);
      parts.push({ spark: true, x: o.x, y: o.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, s: 1.5 + Math.random() * 2,
        color: colors[i % colors.length], life: 26 + Math.random() * 16 });
    }
    if (!raf) raf = requestAnimationFrame(frame);
  };

  MK.register({
    name: 'burst',
    selector: '[data-burst]',
    init: function (el) {
      function go(e) {
        var r = el.getBoundingClientRect();
        var x = e && e.clientX ? e.clientX : r.left + r.width / 2, y = e && e.clientY ? e.clientY : r.top + r.height / 2;
        MK.burst({ x: x, y: y, colors: MK.colors(el, 'data-burst-colors').concat(['#ffffff']) });
      }
      el.addEventListener('click', go);
      return function () { el.removeEventListener('click', go); };
    }
  });

  MK.register({
    name: 'confetti',
    selector: '[data-confetti]',
    init: function (el) {
      function burst() {
        var r = el.getBoundingClientRect();
        var colors = MK.colors(el, 'data-confetti-colors');
        if (!el.hasAttribute('data-confetti-colors')) colors = colors.concat(['#facc15', '#ffffff']);
        MK.confetti({ x: r.left + r.width / 2, y: r.top + r.height / 2, colors: colors });
      }
      if (el.getAttribute('data-confetti') === 'view') return MK.onEnter(el, burst, { rootMargin: '0px 0px -30% 0px' });
      el.addEventListener('click', burst);
      return function () { el.removeEventListener('click', burst); };
    }
  });
})(window.MotionKit);;
/* Motion Kit - bg: animated backgrounds for any section (or <body> for the whole page)
 *   <section data-bg="particles">            canvas / css / webgl layer behind the content
 *   <section data-bg="aurora noise">         stack several (left = bottom layer)
 * Types: particles stars waves matrix grid dots bokeh snow (canvas) | aurora gradient noise (css) | liquid (webgl)
 * Colors: data-bg-colors="#7c3aed,#06b6d4,#f472b6" or CSS vars --mk-c1 --mk-c2 --mk-c3 (set them in :root)
 * Per-type options use data-bg-<option>, e.g. data-bg-speed="1.5" data-bg-density="0.6"
 * Layers pause when off-screen, cap pixel ratio, and render one still frame for reduced motion.
 */
(function (MK) {
  'use strict';
  var d = document;
  MK.bgs = MK.bgs || {};
  MK.defineBg = function (name, def) {
    MK.bgs[name] = def;
    // defined after the kit started: (re)build elements that asked for it
    if (MK.isStarted && MK.isStarted()) {
      Array.prototype.forEach.call(d.querySelectorAll('[data-bg]'), function (el) {
        if ((' ' + el.getAttribute('data-bg') + ' ').indexOf(' ' + name + ' ') >= 0) MK.reinit('bg', el);
      });
    }
  };

  var probe = null;
  // Any CSS color -> [r, g, b] (0-255)
  MK.rgb = function (color) {
    if (!probe) probe = d.createElement('canvas').getContext('2d');
    probe.fillStyle = '#000';
    probe.fillStyle = color;
    var v = probe.fillStyle;
    if (v.charAt(0) === '#') {
      return [parseInt(v.substr(1, 2), 16), parseInt(v.substr(3, 2), 16), parseInt(v.substr(5, 2), 16)];
    }
    var m = v.match(/[\d.]+/g) || [0, 0, 0];
    return [+m[0], +m[1], +m[2]];
  };
  MK.rgba = function (color, a) {
    var c = MK.rgb(color);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  };

  function makeLayer(el, name) {
    var layer = d.createElement('div');
    layer.className = 'mk-bg mk-bg--' + name + ' mk-internal';
    layer.setAttribute('aria-hidden', 'true');
    if (el === d.body || el.hasAttribute('data-bg-fixed')) layer.classList.add('mk-bg-fixed');
    var layers = el.querySelectorAll(':scope > .mk-bg');
    var after = layers.length ? layers[layers.length - 1].nextSibling : el.firstChild;
    el.insertBefore(layer, after);
    return layer;
  }

  function envFor(el, layer, name) {
    return {
      el: el,
      layer: layer,
      name: name,
      colors: MK.colors(el),
      reduced: MK.reduced,
      opt: function (k, fb) { return MK.num(el, 'data-bg-' + k, fb); },
      str: function (k, fb) { return MK.attr(el, 'data-bg-' + k, fb); },
      pointer: { x: -9999, y: -9999, nx: 0.5, ny: 0.5, active: false },
      w: 1, h: 1, dpr: 1
    };
  }

  function runCanvas(def, env) {
    var canvas = d.createElement('canvas');
    env.layer.appendChild(canvas);
    env.canvas = canvas;
    function fallback() {
      canvas.remove();
      var name = def.fallback || 'aurora';
      var fb = MK.bgs[name];
      env.layer.classList.add('mk-bg--' + name);
      return fb && fb.create && !fb.canvas && !fb.webgl ? fb.create(env) : null;
    }
    if (def.webgl) {
      var attrs = def.glAttrs || { antialias: false, premultipliedAlpha: false, alpha: true };
      try {
        env.gl = def.webgl2 ? canvas.getContext('webgl2', attrs)
          : (canvas.getContext('webgl', attrs) || canvas.getContext('experimental-webgl', attrs));
      } catch (e) { env.gl = null; }
      if (!env.gl) return fallback();
    } else {
      env.ctx = canvas.getContext('2d');
    }
    var inst = def.create(env) || {};
    if (inst.unsupported) return fallback();
    var t0 = performance.now();

    function still() {
      if (inst.still) inst.still(); else if (inst.frame) inst.frame(0, 16);
    }
    function resize() {
      var r = env.layer.getBoundingClientRect();
      var w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
      var dpr = Math.min(window.devicePixelRatio || 1, def.maxDpr || 2);
      if (w === env.w && h === env.h && dpr === env.dpr && canvas.width) return;
      env.w = w; env.h = h; env.dpr = dpr;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      if (env.ctx) env.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (env.gl) env.gl.viewport(0, 0, canvas.width, canvas.height);
      if (inst.resize) inst.resize(w, h, dpr);
      if (MK.reduced) still();
    }
    env.w = 0; env.h = 0; env.dpr = 0;
    var ro = window.ResizeObserver ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(env.layer);
    window.addEventListener('resize', resize);
    resize();

    function move(e) {
      var r = env.layer.getBoundingClientRect();
      env.pointer.x = e.clientX - r.left;
      env.pointer.y = e.clientY - r.top;
      env.pointer.nx = MK.clamp(env.pointer.x / r.width, 0, 1);
      env.pointer.ny = MK.clamp(env.pointer.y / r.height, 0, 1);
      env.pointer.active = e.pointerType === 'mouse' && env.pointer.x >= 0 && env.pointer.y >= 0 && env.pointer.x <= r.width && env.pointer.y <= r.height;
    }
    function leave() { env.pointer.active = false; }
    window.addEventListener('pointermove', move, { passive: true });
    d.documentElement.addEventListener('pointerleave', leave);

    var stop = null;
    if (MK.reduced) still();
    else if (inst.frame) stop = MK.ticker(env.layer, function (t, dt) { inst.frame(t - t0, dt); });

    return function () {
      if (stop) stop();
      if (ro) ro.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', move);
      d.documentElement.removeEventListener('pointerleave', leave);
      if (inst.destroy) inst.destroy();
    };
  }

  MK.register({
    name: 'bg',
    selector: '[data-bg]',
    init: function (el) {
      var names = (el.getAttribute('data-bg') || '').trim().split(/\s+/).filter(Boolean);
      el.classList.add('mk-bg-host');
      var cleanups = [];
      names.forEach(function (name) {
        var def = MK.bgs[name];
        if (!def) {
          // may still be registered later with MotionKit.defineBg()
          setTimeout(function () { if (!MK.bgs[name]) MK.warn('unknown data-bg="' + name + '" (is that background included in the bundle?)'); }, 1500);
          return;
        }
        var layer = makeLayer(el, name);
        var env = envFor(el, layer, name);
        var c = def.canvas || def.webgl ? runCanvas(def, env) : def.create(env);
        cleanups.push(function () { if (typeof c === 'function') c(); layer.remove(); });
      });
      return function () { cleanups.forEach(function (f) { f(); }); };
    }
  });
})(window.MotionKit);;
/* bg: gl - tiny engine for full-screen fragment-shader backgrounds.
 * MotionKit.shaderBg(name, { fs, maxDpr, fallback, uniforms: { u_x: function (env) { return 1.0; } } })
 * Every shader gets: u_res (px), u_time (s), u_mouse (0-1, y up, eased), u_hover (0-1 eased while the
 * pointer is over the layer), u_c1..u_c3 (palette as vec3), plus hash(), noise(), fbm() helpers.
 */
(function (MK) {
  'use strict';
  var VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  var LIB = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform vec2 u_res;uniform float u_time;uniform vec2 u_mouse;uniform float u_hover;',
    'uniform vec3 u_c1;uniform vec3 u_c2;uniform vec3 u_c3;',
    'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);',
    'return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x),u.y);}',
    'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.02+vec2(1.3,.7);a*=.5;}return v;}',
    ''
  ].join('\n');

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      MK.warn('shader compile failed:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  MK.shaderBg = function (name, cfg) {
    MK.defineBg(name, {
      webgl: true,
      maxDpr: cfg.maxDpr || 1,
      fallback: cfg.fallback || 'aurora',
      create: function (env) {
        var gl = env.gl;
        var vs = compile(gl, gl.VERTEX_SHADER, VS), fs = compile(gl, gl.FRAGMENT_SHADER, LIB + cfg.fs);
        if (!vs || !fs) return { unsupported: true };
        var prog = gl.createProgram();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.bindAttribLocation(prog, 0, 'p');
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { MK.warn('shader link failed:', gl.getProgramInfoLog(prog)); return { unsupported: true }; }
        gl.useProgram(prog);
        var buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        var loc = function (n) { return gl.getUniformLocation(prog, n); };
        var U = { res: loc('u_res'), time: loc('u_time'), mouse: loc('u_mouse'), hover: loc('u_hover') };
        var c = env.colors.map(function (col) { return MK.rgb(col).map(function (v) { return v / 255; }); });
        gl.uniform3fv(loc('u_c1'), c[0]);
        gl.uniform3fv(loc('u_c2'), c[1] || c[0]);
        gl.uniform3fv(loc('u_c3'), c[2] || c[1] || c[0]);
        var custom = cfg.uniforms || {};
        var customLoc = {};
        Object.keys(custom).forEach(function (k) { customLoc[k] = loc(k); });
        var speed = env.opt('speed', 1), seed = Math.random() * 100;
        var mx = 0.5, my = 0.5, hover = 0;

        function draw(tSec) {
          var P = env.pointer;
          mx = MK.lerp(mx, P.active ? P.nx : 0.5, 0.06);
          my = MK.lerp(my, P.active ? 1 - P.ny : 0.5, 0.06);
          hover = MK.lerp(hover, P.active ? 1 : 0, 0.05);
          gl.uniform2f(U.res, env.canvas.width, env.canvas.height);
          gl.uniform1f(U.time, tSec * speed + seed);
          gl.uniform2f(U.mouse, mx, my);
          gl.uniform1f(U.hover, hover);
          Object.keys(custom).forEach(function (k) {
            var v = custom[k](env);
            if (typeof v === 'number') gl.uniform1f(customLoc[k], v);
            else if (v && v.length === 2) gl.uniform2f(customLoc[k], v[0], v[1]);
            else if (v && v.length === 3) gl.uniform3f(customLoc[k], v[0], v[1], v[2]);
          });
          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
        }
        return {
          frame: function (t) { draw(t / 1000); },
          still: function () { draw(8); },
          destroy: function () { gl.deleteProgram(prog); gl.deleteBuffer(buf); }
        };
      }
    });
  };
})(window.MotionKit);;
/* bg: particles - drifting dots joined by lines, reacts to the cursor.
 * Options: data-bg-density="1" data-bg-speed="1" data-bg-link="130" data-bg-interact="grab|repel|none" */
(function (MK) {
  'use strict';
  MK.defineBg('particles', {
    canvas: true,
    create: function (env) {
      var pts = [];
      var link = env.opt('link', 130), speed = env.opt('speed', 1), density = env.opt('density', 1);
      var mode = env.str('interact', 'grab');
      function resize(w, h) {
        var n = Math.round(MK.clamp(w * h / 11000, 24, 150) * density);
        while (pts.length < n) {
          pts.push({
            x: Math.random() * w, y: Math.random() * h,
            vx: (Math.random() - 0.5) * 0.45, vy: (Math.random() - 0.5) * 0.45,
            r: 1 + Math.random() * 1.8, c: env.colors[pts.length % env.colors.length]
          });
        }
        pts.length = n;
        pts.forEach(function (p) { if (p.x > w) p.x = Math.random() * w; if (p.y > h) p.y = Math.random() * h; });
      }
      function frame(t, dt) {
        var ctx = env.ctx, w = env.w, h = env.h, k = (dt / 16) * speed, P = env.pointer;
        ctx.clearRect(0, 0, w, h);
        var i, j, p, q, dx, dy, dd;
        for (i = 0; i < pts.length; i++) {
          p = pts[i];
          p.x += p.vx * k; p.y += p.vy * k;
          if (p.x < 0) { p.x = 0; p.vx *= -1; } else if (p.x > w) { p.x = w; p.vx *= -1; }
          if (p.y < 0) { p.y = 0; p.vy *= -1; } else if (p.y > h) { p.y = h; p.vy *= -1; }
          if (P.active && mode !== 'none') {
            dx = p.x - P.x; dy = p.y - P.y; dd = Math.sqrt(dx * dx + dy * dy);
            if (dd < 160 && dd > 0.1) {
              var f = (1 - dd / 160) * (mode === 'repel' ? 2.2 : -0.35) * k;
              p.x += (dx / dd) * f; p.y += (dy / dd) * f;
            }
          }
        }
        ctx.lineWidth = 1;
        var L2 = link * link;
        for (i = 0; i < pts.length; i++) {
          p = pts[i];
          for (j = i + 1; j < pts.length; j++) {
            q = pts[j];
            dx = p.x - q.x; dy = p.y - q.y; dd = dx * dx + dy * dy;
            if (dd < L2) {
              ctx.globalAlpha = (1 - Math.sqrt(dd) / link) * 0.35;
              ctx.strokeStyle = p.c;
              ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
            }
          }
          if (P.active && mode === 'grab') {
            dx = p.x - P.x; dy = p.y - P.y; dd = Math.sqrt(dx * dx + dy * dy);
            if (dd < 190) {
              ctx.globalAlpha = (1 - dd / 190) * 0.6;
              ctx.strokeStyle = p.c;
              ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(P.x, P.y); ctx.stroke();
            }
          }
        }
        ctx.globalAlpha = 0.9;
        for (i = 0; i < pts.length; i++) {
          p = pts[i];
          ctx.fillStyle = p.c;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      return { resize: resize, frame: frame };
    }
  });
})(window.MotionKit);;
/* bg: stars - warp-speed starfield flying toward the viewer (put it on a dark section).
 * Options: data-bg-speed="1" data-bg-density="1" */
(function (MK) {
  'use strict';
  MK.defineBg('stars', {
    canvas: true,
    create: function (env) {
      var stars = [], speed = env.opt('speed', 1), density = env.opt('density', 1);
      var cx = 0, cy = 0;
      function spawn(s, z) {
        s.x = (Math.random() - 0.5) * 2;
        s.y = (Math.random() - 0.5) * 2;
        s.z = z == null ? Math.random() : z;
        s.pz = s.z;
        s.c = Math.random() < 0.8 ? '#ffffff' : env.colors[(Math.random() * env.colors.length) | 0];
        return s;
      }
      function resize(w, h) {
        var n = Math.round(MK.clamp(w * h / 1400, 160, 900) * density);
        while (stars.length < n) stars.push(spawn({}));
        stars.length = n;
      }
      function draw(dz, streaks) {
        var ctx = env.ctx, w = env.w, h = env.h, P = env.pointer;
        var tx = w / 2 + (P.active ? (P.x - w / 2) * 0.08 : 0);
        var ty = h / 2 + (P.active ? (P.y - h / 2) * 0.08 : 0);
        cx = MK.lerp(cx || tx, tx, 0.05); cy = MK.lerp(cy || ty, ty, 0.05);
        var scale = Math.max(w, h) * 0.5;
        ctx.clearRect(0, 0, w, h);
        for (var i = 0; i < stars.length; i++) {
          var s = stars[i];
          s.pz = s.z;
          s.z -= dz;
          if (s.z <= 0.02) { spawn(s, 1); continue; }
          var sx = cx + (s.x / s.z) * scale, sy = cy + (s.y / s.z) * scale;
          if (sx < -10 || sx > w + 10 || sy < -10 || sy > h + 10) { spawn(s, 1); continue; }
          var size = (1 - s.z) * 2.8 + 0.7;
          ctx.globalAlpha = Math.min(1, 0.3 + (1 - s.z) * 1.2);
          if (!streaks) { size = Math.max(size, 1.4); ctx.globalAlpha = 0.35 + (1 - s.z) * 0.65; }
          ctx.fillStyle = s.c;
          ctx.beginPath(); ctx.arc(sx, sy, Math.max(0.6, size / 2), 0, 6.2832); ctx.fill();
          if (streaks && s.z < 0.6) {
            // tail for near stars = sense of speed
            var px = cx + (s.x / (s.pz + dz * 5)) * scale, py = cy + (s.y / (s.pz + dz * 5)) * scale;
            ctx.strokeStyle = s.c; ctx.lineWidth = size * 0.7;
            ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(sx, sy); ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;
      }
      return {
        resize: resize,
        frame: function (t, dt) { draw(0.0022 * speed * (dt / 16), true); },
        still: function () { draw(0, false); }
      };
    }
  });
})(window.MotionKit);;
/* bg: waves - layered flowing sine waves along the bottom of the section.
 * Options: data-bg-layers="3" data-bg-amp="1" data-bg-speed="1" data-bg-height="0.45" (share of section height) */
(function (MK) {
  'use strict';
  MK.defineBg('waves', {
    canvas: true,
    create: function (env) {
      var layers = Math.round(MK.clamp(env.opt('layers', 3), 1, 6));
      var amp = env.opt('amp', 1), speed = env.opt('speed', 1), band = env.opt('height', 0.45);
      function frame(t) {
        var ctx = env.ctx, w = env.w, h = env.h;
        ctx.clearRect(0, 0, w, h);
        for (var i = 0; i < layers; i++) {
          var y0 = h * (1 - band) + (h * band) * (i / (layers + 0.5)) * 0.6;
          var A = h * band * 0.18 * amp * (1 - i * 0.15);
          var k = (Math.PI * 2) / (w * (0.8 + i * 0.3));
          var s = t * 0.0007 * speed * (1 + i * 0.35);
          ctx.beginPath();
          ctx.moveTo(0, h);
          for (var x = 0; x <= w + 12; x += 12) {
            var y = y0 + Math.sin(x * k + s + i * 1.7) * A + Math.sin(x * k * 2.3 - s * 1.3 + i) * A * 0.35;
            ctx.lineTo(x, y);
          }
          ctx.lineTo(w, h);
          ctx.closePath();
          ctx.globalAlpha = 0.22 + (i / layers) * 0.3;
          ctx.fillStyle = env.colors[i % env.colors.length];
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      return { frame: frame };
    }
  });
})(window.MotionKit);;
/* bg: matrix - falling "code rain" glyphs (hacker / cyber / dev themes). Uses --mk-c1 as glyph color.
 * Options: data-bg-size="16" (font px) data-bg-speed="1" data-bg-chars="01" */
(function (MK) {
  'use strict';
  MK.defineBg('matrix', {
    canvas: true,
    create: function (env) {
      var fs = env.opt('size', 16), speed = env.opt('speed', 1);
      var chars = env.str('chars', 'アイウエオカキクケコサシスセソタチツテト0123456789ABCDEF<>*+=');
      var drops = [], last = -1e9;
      function resize(w, h) {
        var cols = Math.ceil(w / fs);
        drops = [];
        for (var i = 0; i < cols; i++) drops.push(Math.random() * -h / fs);
        env.ctx.clearRect(0, 0, w, h);
      }
      function step() {
        var ctx = env.ctx, w = env.w, h = env.h;
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'source-over';
        ctx.font = fs + 'px monospace';
        for (var i = 0; i < drops.length; i++) {
          var y = drops[i] * fs;
          if (y > 0) {
            var ch = chars.charAt((Math.random() * chars.length) | 0);
            ctx.fillStyle = Math.random() < 0.08 ? '#ffffff' : env.colors[0];
            ctx.globalAlpha = 0.85;
            ctx.fillText(ch, i * fs, y);
          }
          if (y > h && Math.random() > 0.975) drops[i] = 0;
          drops[i]++;
        }
        ctx.globalAlpha = 1;
      }
      return {
        resize: resize,
        frame: function (t) {
          if (t - last < 55 / speed) return;
          last = t;
          step();
        },
        still: function () { for (var i = 0; i < 40; i++) step(); }
      };
    }
  });
})(window.MotionKit);;
/* bg: grid - retro/synthwave perspective grid rolling toward the viewer (gaming, web3, music).
 * Options: data-bg-speed="1" data-bg-horizon="0.45" (0-1 from top) data-bg-lines="22" */
(function (MK) {
  'use strict';
  MK.defineBg('grid', {
    canvas: true,
    create: function (env) {
      var speed = env.opt('speed', 1), horizonAt = env.opt('horizon', 0.45), cols = env.opt('lines', 22);
      function frame(t) {
        var ctx = env.ctx, w = env.w, h = env.h;
        var hz = h * horizonAt, depth = h - hz, cx = w / 2;
        ctx.clearRect(0, 0, w, h);
        var glow = ctx.createLinearGradient(0, hz - h * 0.25, 0, hz + 4);
        glow.addColorStop(0, MK.rgba(env.colors[1] || env.colors[0], 0));
        glow.addColorStop(1, MK.rgba(env.colors[1] || env.colors[0], 0.35));
        ctx.fillStyle = glow;
        ctx.fillRect(0, hz - h * 0.25, w, h * 0.25 + 4);

        ctx.strokeStyle = env.colors[0];
        ctx.lineWidth = 1.2;
        for (var i = -cols; i <= cols; i++) {
          var xb = cx + i * (w / cols) * 1.6;
          ctx.globalAlpha = 0.55;
          ctx.beginPath(); ctx.moveTo(cx + i * (w / cols) * 0.06, hz); ctx.lineTo(xb, h); ctx.stroke();
        }
        var rows = 18, off = (t * 0.00018 * speed) % 1;
        for (var k = 0; k < rows; k++) {
          var s = (k + off) / rows;
          var y = hz + depth * Math.pow(s, 2.6);
          ctx.globalAlpha = Math.min(1, s * 1.4) * 0.75;
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = MK.rgba(env.colors[0], 0.9);
        ctx.fillRect(0, hz - 1, w, 2);
      }
      return { frame: frame };
    }
  });
})(window.MotionKit);;
/* bg: dots - interactive dot matrix: dots swell and glow near the cursor, with a slow idle ripple.
 * Options: data-bg-gap="28" (px between dots) data-bg-radius="170" (cursor influence) */
(function (MK) {
  'use strict';
  MK.defineBg('dots', {
    canvas: true,
    create: function (env) {
      var gap = env.opt('gap', 28), radius = env.opt('radius', 170);
      var px = -9999, py = -9999, amt = 0;
      function frame(t) {
        var ctx = env.ctx, w = env.w, h = env.h, P = env.pointer;
        ctx.clearRect(0, 0, w, h);
        if (P.active) { px = MK.lerp(px < -999 ? P.x : px, P.x, 0.2); py = MK.lerp(py < -999 ? P.y : py, P.y, 0.2); }
        amt = MK.lerp(amt, P.active ? 1 : 0, 0.08);
        var cx = w / 2, cy = h / 2;
        var c0 = env.colors[0], c1 = env.colors[1] || c0;
        for (var y = gap / 2; y < h; y += gap) {
          for (var x = gap / 2; x < w; x += gap) {
            var dx = x - px, dy = y - py;
            var inf = amt * Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / radius);
            var dc = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
            var wave = (Math.sin(dc * 0.018 - t * 0.0016) + 1) * 0.5;
            ctx.globalAlpha = 0.24 + wave * 0.22 + inf * 0.7;
            ctx.fillStyle = inf > 0.08 ? c0 : c1;
            var r = 1.1 + wave * 0.6 + inf * 2.6;
            ctx.fillRect(x - r, y - r, r * 2, r * 2);
          }
        }
        ctx.globalAlpha = 1;
      }
      return { frame: frame };
    }
  });
})(window.MotionKit);;
/* bg: bokeh - soft glowing orbs drifting and breathing (elegant, wellness, luxury, events).
 * Options: data-bg-count="16" data-bg-speed="1" */
(function (MK) {
  'use strict';
  MK.defineBg('bokeh', {
    canvas: true,
    create: function (env) {
      var orbs = [], speed = env.opt('speed', 1);
      var count = Math.round(env.opt('count', 16));
      function resize(w, h) {
        var base = Math.min(w, h);
        while (orbs.length < count) {
          var col = MK.rgb(env.colors[orbs.length % env.colors.length]);
          orbs.push({
            x: Math.random() * w, y: Math.random() * h,
            r: base * (0.06 + Math.random() * 0.16),
            vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
            a: 0.18 + Math.random() * 0.3, ph: Math.random() * 6.28, rgb: col.join(',')
          });
        }
      }
      function frame(t, dt) {
        var ctx = env.ctx, w = env.w, h = env.h, k = (dt / 16) * speed;
        ctx.clearRect(0, 0, w, h);
        for (var i = 0; i < orbs.length; i++) {
          var o = orbs[i];
          o.x += o.vx * k; o.y += o.vy * k;
          if (o.x < -o.r) o.x = w + o.r; else if (o.x > w + o.r) o.x = -o.r;
          if (o.y < -o.r) o.y = h + o.r; else if (o.y > h + o.r) o.y = -o.r;
          var a = o.a * (0.7 + 0.3 * Math.sin(t * 0.0009 + o.ph));
          var g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
          g.addColorStop(0, 'rgba(' + o.rgb + ',' + a.toFixed(3) + ')');
          g.addColorStop(0.55, 'rgba(' + o.rgb + ',' + (a * 0.45).toFixed(3) + ')');
          g.addColorStop(1, 'rgba(' + o.rgb + ',0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 6.2832); ctx.fill();
        }
      }
      return { resize: resize, frame: frame };
    }
  });
})(window.MotionKit);;
/* bg: snow - gently falling, swaying particles (winter, holidays, festivals; tint for petals/embers).
 * Options: data-bg-density="1" data-bg-speed="1" data-bg-rise (float upward like embers/bubbles) */
(function (MK) {
  'use strict';
  MK.defineBg('snow', {
    canvas: true,
    create: function (env) {
      var flakes = [], speed = env.opt('speed', 1), density = env.opt('density', 1);
      var rise = env.el.hasAttribute('data-bg-rise');
      function mk(w, h, top) {
        return {
          x: Math.random() * w, y: top ? (rise ? h + 10 : -10) : Math.random() * h,
          r: 1 + Math.random() * 3, v: 0.3 + Math.random() * 0.9, ph: Math.random() * 6.28,
          c: Math.random() < 0.7 ? '#ffffff' : env.colors[(Math.random() * env.colors.length) | 0],
          a: 0.4 + Math.random() * 0.5
        };
      }
      function resize(w, h) {
        var n = Math.round(MK.clamp(w * h / 9000, 30, 220) * density);
        while (flakes.length < n) flakes.push(mk(w, h, false));
        flakes.length = n;
      }
      function frame(t, dt) {
        var ctx = env.ctx, w = env.w, h = env.h, k = (dt / 16) * speed;
        ctx.clearRect(0, 0, w, h);
        for (var i = 0; i < flakes.length; i++) {
          var f = flakes[i];
          f.y += (rise ? -f.v : f.v) * k;
          f.x += Math.sin(t * 0.001 + f.ph) * 0.35 * k;
          if ((!rise && f.y > h + 10) || (rise && f.y < -10) || f.x < -10 || f.x > w + 10) { flakes[i] = mk(w, h, true); continue; }
          ctx.globalAlpha = f.a;
          ctx.fillStyle = f.c;
          ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.2832); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      return { resize: resize, frame: frame };
    }
  });
})(window.MotionKit);;
/* bg: aurora - big soft color blobs slowly drifting (pure CSS, very cheap). Great hero default.
 * Tune with CSS: --mk-aurora-opacity (default .6), --mk-aurora-speed (default 1) */
(function (MK) {
  'use strict';
  MK.defineBg('aurora', {
    create: function (env) {
      for (var i = 0; i < 4; i++) {
        var b = document.createElement('mk-span');
        b.className = 'mk-aurora-blob';
        b.style.setProperty('--c', env.colors[i % env.colors.length]);
        env.layer.appendChild(b);
      }
    }
  });
})(window.MotionKit);;
/* bg: gradient - slowly rotating, blurred multi-color mesh gradient (pure CSS).
 * Tune with CSS: --mk-gradient-speed (default 1), --mk-gradient-opacity (default 1) */
(function (MK) {
  'use strict';
  MK.defineBg('gradient', {
    create: function (env) {
      var c = env.colors;
      var a = document.createElement('mk-span');
      a.className = 'mk-gradient-a';
      a.style.background = 'conic-gradient(from 0deg at 50% 50%, ' + [c[0], c[1] || c[0], c[2] || c[0], c[0]].join(', ') + ')';
      var b = document.createElement('mk-span');
      b.className = 'mk-gradient-b';
      b.style.background = 'radial-gradient(circle at 30% 40%, ' + (c[2] || c[0]) + ', transparent 55%), radial-gradient(circle at 70% 60%, ' + (c[1] || c[0]) + ', transparent 50%)';
      env.layer.appendChild(a);
      env.layer.appendChild(b);
    }
  });
})(window.MotionKit);;
/* bg: noise - animated film grain over the section background (pairs well with aurora / gradient).
 * Tune with CSS: --mk-noise-opacity (default .14) */
(function (MK) {
  'use strict';
  MK.defineBg('noise', {
    create: function (env) {
      var g = document.createElement('mk-span');
      g.className = 'mk-noise-grain';
      env.layer.appendChild(g);
    }
  });
})(window.MotionKit);;
/* bg: liquid - WebGL flowing "liquid metal / silk" gradient built from --mk-c1..3 (AI, SaaS, creative).
 * Reacts softly to the cursor. Falls back to aurora when WebGL is unavailable.
 * Options: data-bg-speed="1" data-bg-scale="1.6" (bigger = busier pattern), --mk-liquid-opacity */
(function (MK) {
  'use strict';
  MK.shaderBg('liquid', {
    maxDpr: 0.75,
    uniforms: { u_scale: function (env) { return env.opt('scale', 1.6); } },
    fs: [
      'uniform float u_scale;',
      'void main(){',
      '  vec2 uv=gl_FragCoord.xy/u_res;',
      '  vec2 p=uv*vec2(u_res.x/u_res.y,1.)*u_scale;',
      '  float t=u_time*.06;',
      '  vec2 m=(u_mouse-.5)*.6*(.4+u_hover);',
      '  vec2 q=vec2(fbm(p+t),fbm(p+vec2(5.2,1.3)-t));',
      '  vec2 r=vec2(fbm(p+3.*q+vec2(1.7,9.2)+t*1.6+m),fbm(p+3.*q+vec2(8.3,2.8)-t*1.2-m));',
      '  float f=fbm(p+2.6*r);',
      '  vec3 col=mix(u_c1,u_c2,smoothstep(.15,.85,f));',
      '  col=mix(col,u_c3,smoothstep(.35,1.,length(r)*.85));',
      '  col*=.72+.5*f;',
      '  gl_FragColor=vec4(col,1.);',
      '}'
    ].join('\n')
  });
})(window.MotionKit);;
/* bg: fluid - real-time WebGL2 fluid simulation ("splash cursor"): moving the pointer (or a finger)
 * swirls glowing ink in the palette colors. On <body> it becomes a full-page interactive layer.
 * Options: data-bg-fade="1.2" (ink fade speed) data-bg-curl="28" (swirliness) data-bg-radius="0.22"
 *          data-bg-auto (keep making gentle splashes when idle, default on; data-bg-auto="false" to disable)
 * Needs WebGL2 + float render targets; falls back to aurora otherwise.
 */
(function (MK) {
  'use strict';
  var HEAD = '#version 300 es\nprecision highp float;\nprecision highp sampler2D;\n';
  var VS = HEAD + [
    'in vec2 aPosition;',
    'out vec2 vUv,vL,vR,vT,vB;',
    'uniform vec2 texelSize;',
    'void main(){',
    '  vUv=aPosition*.5+.5;',
    '  vL=vUv-vec2(texelSize.x,0.);vR=vUv+vec2(texelSize.x,0.);',
    '  vT=vUv+vec2(0.,texelSize.y);vB=vUv-vec2(0.,texelSize.y);',
    '  gl_Position=vec4(aPosition,0.,1.);',
    '}'
  ].join('\n');
  var FIN = 'in vec2 vUv,vL,vR,vT,vB;out vec4 o;\n';
  var FS = {
    clear: 'uniform sampler2D uTexture;uniform float value;void main(){o=value*texture(uTexture,vUv);}',
    splat: 'uniform sampler2D uTarget;uniform float aspectRatio;uniform vec3 color;uniform vec2 point;uniform float radius;' +
      'void main(){vec2 p=vUv-point;p.x*=aspectRatio;vec3 s=exp(-dot(p,p)/radius)*color;o=vec4(texture(uTarget,vUv).xyz+s,1.);}',
    advection: 'uniform sampler2D uVelocity;uniform sampler2D uSource;uniform vec2 texelSize;uniform float dt;uniform float dissipation;' +
      'void main(){vec2 c=vUv-dt*texture(uVelocity,vUv).xy*texelSize;o=texture(uSource,c)/(1.+dissipation*dt);}',
    divergence: 'uniform sampler2D uVelocity;void main(){float L=texture(uVelocity,vL).x;float R=texture(uVelocity,vR).x;' +
      'float T=texture(uVelocity,vT).y;float B=texture(uVelocity,vB).y;vec2 C=texture(uVelocity,vUv).xy;' +
      'if(vL.x<0.)L=-C.x;if(vR.x>1.)R=-C.x;if(vT.y>1.)T=-C.y;if(vB.y<0.)B=-C.y;o=vec4(.5*(R-L+T-B),0.,0.,1.);}',
    curl: 'uniform sampler2D uVelocity;void main(){float L=texture(uVelocity,vL).y;float R=texture(uVelocity,vR).y;' +
      'float T=texture(uVelocity,vT).x;float B=texture(uVelocity,vB).x;o=vec4(.5*(R-L-T+B),0.,0.,1.);}',
    vorticity: 'uniform sampler2D uVelocity;uniform sampler2D uCurl;uniform float curl;uniform float dt;' +
      'void main(){float L=texture(uCurl,vL).x;float R=texture(uCurl,vR).x;float T=texture(uCurl,vT).x;float B=texture(uCurl,vB).x;' +
      'float C=texture(uCurl,vUv).x;vec2 f=.5*vec2(abs(T)-abs(B),abs(R)-abs(L));f/=length(f)+.0001;f*=curl*C;f.y*=-1.;' +
      'vec2 v=texture(uVelocity,vUv).xy+f*dt;o=vec4(clamp(v,-1000.,1000.),0.,1.);}',
    pressure: 'uniform sampler2D uPressure;uniform sampler2D uDivergence;void main(){float L=texture(uPressure,vL).x;' +
      'float R=texture(uPressure,vR).x;float T=texture(uPressure,vT).x;float B=texture(uPressure,vB).x;' +
      'o=vec4((L+R+B+T-texture(uDivergence,vUv).x)*.25,0.,0.,1.);}',
    gradient: 'uniform sampler2D uPressure;uniform sampler2D uVelocity;void main(){float L=texture(uPressure,vL).x;' +
      'float R=texture(uPressure,vR).x;float T=texture(uPressure,vT).x;float B=texture(uPressure,vB).x;' +
      'vec2 v=texture(uVelocity,vUv).xy-vec2(R-L,T-B);o=vec4(v,0.,1.);}',
    display: 'uniform sampler2D uTexture;uniform vec2 texelSize;void main(){vec3 c=texture(uTexture,vUv).rgb;' +
      'vec3 l=texture(uTexture,vL).rgb;vec3 r=texture(uTexture,vR).rgb;vec3 t=texture(uTexture,vT).rgb;vec3 b=texture(uTexture,vB).rgb;' +
      'vec3 n=normalize(vec3(length(r)-length(l),length(t)-length(b),length(texelSize)));' +
      'c*=clamp(dot(n,vec3(0.,0.,1.))+.7,.7,1.);c=min(c,vec3(1.));float a=max(c.r,max(c.g,c.b));o=vec4(c,a);}'
  };

  MK.defineBg('fluid', {
    webgl: true,
    webgl2: true,
    maxDpr: 1,
    fallback: 'aurora',
    glAttrs: { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false },
    create: function (env) {
      var gl = env.gl;
      if (!gl.getExtension('EXT_color_buffer_float')) return { unsupported: true };
      gl.getExtension('OES_texture_float_linear');
      var small = Math.min(window.innerWidth, window.innerHeight) < 600;
      var cfg = {
        sim: 128, dye: small ? 512 : 1024, fade: env.opt('fade', 1.2), velFade: 0.25, pressure: 0.8, iters: 20,
        curl: env.opt('curl', 28), radius: env.opt('radius', 0.22) / 100, force: 6000,
        auto: env.str('auto', 'true') !== 'false'
      };

      function shader(type, src) {
        var s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { MK.warn('fluid shader:', gl.getShaderInfoLog(s)); return null; }
        return s;
      }
      var vs = shader(gl.VERTEX_SHADER, VS);
      if (!vs) return { unsupported: true };
      var P = {}, ok = true;
      Object.keys(FS).forEach(function (k) {
        var fs = shader(gl.FRAGMENT_SHADER, HEAD + FIN + FS[k]);
        if (!fs) { ok = false; return; }
        var prog = gl.createProgram();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.bindAttribLocation(prog, 0, 'aPosition');
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { ok = false; return; }
        var u = {}, n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
        for (var i = 0; i < n; i++) { var info = gl.getActiveUniform(prog, i); u[info.name] = gl.getUniformLocation(prog, info.name); }
        P[k] = { prog: prog, u: u };
      });
      if (!ok) return { unsupported: true };

      var vb = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vb);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
      var ib = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(0);

      function fbo(w, h) {
        gl.activeTexture(gl.TEXTURE0);
        var tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
        var fb = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        var complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
        gl.viewport(0, 0, w, h);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        return {
          tex: tex, fb: fb, w: w, h: h, tx: 1 / w, ty: 1 / h, ok: complete,
          attach: function (id) { gl.activeTexture(gl.TEXTURE0 + id); gl.bindTexture(gl.TEXTURE_2D, tex); return id; },
          free: function () { gl.deleteTexture(tex); gl.deleteFramebuffer(fb); }
        };
      }
      function dbl(w, h) {
        var a = fbo(w, h), b = fbo(w, h);
        return {
          get read() { return a; }, get write() { return b; }, ok: a.ok && b.ok,
          swap: function () { var t = a; a = b; b = t; },
          free: function () { a.free(); b.free(); }
        };
      }
      function res(r) {
        var ar = env.canvas.width / Math.max(1, env.canvas.height);
        if (ar < 1) ar = 1 / ar;
        var lo = Math.round(r), hi = Math.round(r * ar);
        return env.canvas.width > env.canvas.height ? [hi, lo] : [lo, hi];
      }
      var vel, dye, pres, div, curlF, supported = true;
      function init() {
        [vel, dye, pres, div, curlF].forEach(function (f) { if (f) f.free(); });
        var s = res(cfg.sim), dr = res(cfg.dye);
        vel = dbl(s[0], s[1]);
        pres = dbl(s[0], s[1]);
        div = fbo(s[0], s[1]);
        curlF = fbo(s[0], s[1]);
        dye = dbl(dr[0], dr[1]);
        supported = vel.ok && pres.ok && div.ok && curlF.ok && dye.ok;
      }
      function blit(target) {
        if (target) { gl.viewport(0, 0, target.w, target.h); gl.bindFramebuffer(gl.FRAMEBUFFER, target.fb); }
        else { gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight); gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
      }
      function use(p) { gl.useProgram(p.prog); return p.u; }

      var palette = env.colors.map(function (c) { return MK.rgb(c).map(function (v) { return v / 255; }); });
      var ci = 0;
      function color() {
        var c = palette[ci++ % palette.length], k = 0.16 + Math.random() * 0.08;
        return [c[0] * k, c[1] * k, c[2] * k];
      }
      function splat(x, y, dx, dy, c) {
        var ar = env.canvas.width / Math.max(1, env.canvas.height);
        var u = use(P.splat);
        gl.uniform1i(u.uTarget, vel.read.attach(0));
        gl.uniform1f(u.aspectRatio, ar);
        gl.uniform2f(u.point, x, y);
        gl.uniform3f(u.color, dx, dy, 0);
        gl.uniform1f(u.radius, ar > 1 ? cfg.radius * ar : cfg.radius);
        blit(vel.write); vel.swap();
        gl.uniform1i(u.uTarget, dye.read.attach(0));
        gl.uniform3f(u.color, c[0], c[1], c[2]);
        blit(dye.write); dye.swap();
      }
      function randomSplats(n) {
        for (var i = 0; i < n; i++) {
          var c = color();
          splat(Math.random(), Math.random(), 1000 * (Math.random() - 0.5), 1000 * (Math.random() - 0.5), [c[0] * 8, c[1] * 8, c[2] * 8]);
        }
      }
      function step(dt) {
        gl.disable(gl.BLEND);
        var u = use(P.curl);
        gl.uniform2f(u.texelSize, vel.read.tx, vel.read.ty);
        gl.uniform1i(u.uVelocity, vel.read.attach(0));
        blit(curlF);
        u = use(P.vorticity);
        gl.uniform2f(u.texelSize, vel.read.tx, vel.read.ty);
        gl.uniform1i(u.uVelocity, vel.read.attach(0));
        gl.uniform1i(u.uCurl, curlF.attach(1));
        gl.uniform1f(u.curl, cfg.curl);
        gl.uniform1f(u.dt, dt);
        blit(vel.write); vel.swap();
        u = use(P.divergence);
        gl.uniform2f(u.texelSize, vel.read.tx, vel.read.ty);
        gl.uniform1i(u.uVelocity, vel.read.attach(0));
        blit(div);
        u = use(P.clear);
        gl.uniform1i(u.uTexture, pres.read.attach(0));
        gl.uniform1f(u.value, cfg.pressure);
        blit(pres.write); pres.swap();
        u = use(P.pressure);
        gl.uniform2f(u.texelSize, vel.read.tx, vel.read.ty);
        gl.uniform1i(u.uDivergence, div.attach(0));
        for (var i = 0; i < cfg.iters; i++) {
          gl.uniform1i(u.uPressure, pres.read.attach(1));
          blit(pres.write); pres.swap();
        }
        u = use(P.gradient);
        gl.uniform2f(u.texelSize, vel.read.tx, vel.read.ty);
        gl.uniform1i(u.uPressure, pres.read.attach(0));
        gl.uniform1i(u.uVelocity, vel.read.attach(1));
        blit(vel.write); vel.swap();
        u = use(P.advection);
        gl.uniform2f(u.texelSize, vel.read.tx, vel.read.ty);
        gl.uniform1i(u.uVelocity, vel.read.attach(0));
        gl.uniform1i(u.uSource, vel.read.attach(0));
        gl.uniform1f(u.dt, dt);
        gl.uniform1f(u.dissipation, cfg.velFade);
        blit(vel.write); vel.swap();
        gl.uniform1i(u.uVelocity, vel.read.attach(0));
        gl.uniform1i(u.uSource, dye.read.attach(1));
        gl.uniform1f(u.dissipation, cfg.fade);
        blit(dye.write); dye.swap();
      }
      function render() {
        var u = use(P.display);
        gl.uniform2f(u.texelSize, 1 / gl.drawingBufferWidth, 1 / gl.drawingBufferHeight);
        gl.uniform1i(u.uTexture, dye.read.attach(0));
        blit(null);
      }

      // pointer input (mouse, pen and touch) relative to the layer
      var ptr = { x: 0, y: 0, px: 0, py: 0, moved: false, down: false, seen: false }, lastInput = 0;
      function onMove(e) {
        var r = env.layer.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) { ptr.seen = false; return; }
        var x = (e.clientX - r.left) / r.width, y = 1 - (e.clientY - r.top) / r.height;
        if (!ptr.seen) { ptr.px = x; ptr.py = y; ptr.seen = true; }
        ptr.x = x; ptr.y = y; ptr.moved = true;
        lastInput = performance.now();
      }
      function onDown(e) {
        onMove(e);
        if (!ptr.seen) return;
        var c = color();
        splat(ptr.x, ptr.y, 900 * (Math.random() - 0.5), 900 * (Math.random() - 0.5), [c[0] * 10, c[1] * 10, c[2] * 10]);
      }
      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener('pointerdown', onDown, { passive: true });

      var lastSize = '', nextAuto = 0, pColor = color(), colorAt = 0;
      function ensureSize() {
        var s = env.canvas.width + 'x' + env.canvas.height;
        if (s !== lastSize) { lastSize = s; init(); randomSplats(4); }
      }
      function frame(t, dtMs) {
        ensureSize();
        if (!supported) return;
        var dt = Math.min((dtMs || 16) / 1000, 1 / 60);
        if (ptr.moved) {
          ptr.moved = false;
          if (t - colorAt > 200) { pColor = color(); colorAt = t; }
          var ar = env.canvas.width / Math.max(1, env.canvas.height);
          var dx = ptr.x - ptr.px, dy = ptr.y - ptr.py;
          if (ar < 1) dx *= ar; else dy /= ar;
          if (Math.abs(dx) + Math.abs(dy) > 0) splat(ptr.x, ptr.y, dx * cfg.force, dy * cfg.force, pColor);
          ptr.px = ptr.x; ptr.py = ptr.y;
        }
        if (cfg.auto && performance.now() - lastInput > 2500 && t > nextAuto) {
          nextAuto = t + 1400 + Math.random() * 1400;
          var c = color();
          var x = 0.15 + Math.random() * 0.7, y = 0.15 + Math.random() * 0.7, a = Math.random() * Math.PI * 2;
          splat(x, y, Math.cos(a) * 520, Math.sin(a) * 520, [c[0] * 5, c[1] * 5, c[2] * 5]);
        }
        step(dt);
        render();
      }
      return {
        frame: frame,
        still: function () {
          ensureSize();
          if (!supported) return;
          randomSplats(6);
          for (var i = 0; i < 40; i++) step(1 / 60);
          render();
        },
        destroy: function () {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerdown', onDown);
          [vel, dye, pres, div, curlF].forEach(function (f) { if (f) f.free(); });
          Object.keys(P).forEach(function (k) { gl.deleteProgram(P[k].prog); });
        }
      };
    }
  });
})(window.MotionKit);;
/* bg: blobs - WebGL lava-lamp metaballs that merge and split; the cursor adds its own blob.
 * Options: data-bg-speed="1" data-bg-size="1" (blob size multiplier). Dim any background with --mk-bg-opacity. */
(function (MK) {
  'use strict';
  MK.shaderBg('blobs', {
    maxDpr: 1,
    uniforms: { u_size: function (env) { return env.opt('size', 1); } },
    fs: [
      'uniform float u_size;',
      'float ball(vec2 p,vec2 c,float r){vec2 d=p-c;return r*r/(dot(d,d)+1e-4);}',
      'void main(){',
      '  float ar=u_res.x/u_res.y;',
      '  vec2 uv=gl_FragCoord.xy/u_res;',
      '  vec2 p=vec2(uv.x*ar,uv.y);',
      '  float t=u_time*.22;',
      '  float f=0.;vec3 acc=vec3(0.);',
      '  for(int i=0;i<7;i++){',
      '    float fi=float(i);',
      '    vec2 c=vec2(ar*(.5+.42*sin(t*(.7+fi*.137)+fi*2.1)),.5+.40*sin(t*(.53+fi*.113)+fi*1.3+1.7));',
      '    float r=(.125+.05*sin(fi*1.7+t*.9))*u_size;',
      '    float v=ball(p,c,r);',
      '    float k=mod(fi,3.);',
      '    vec3 col=k<1.?u_c1:(k<2.?u_c2:u_c3);',
      '    f+=v;acc+=col*v;',
      '  }',
      '  vec2 m=vec2(u_mouse.x*ar,u_mouse.y);',
      '  float mv=ball(p,m,(.13*u_hover+.0001)*u_size);',
      '  f+=mv;acc+=mix(u_c1,u_c3,.5)*mv;',
      '  vec3 col=acc/max(f,1e-4);',
      '  float body=smoothstep(.9,1.,f);',
      '  float inner=smoothstep(1.,4.,f);',
      '  float edge=smoothstep(1.,1.12,f);',
      '  vec3 lit=col*(.5+.6*inner)*(.7+.3*edge)+vec3(1.)*pow(inner,2.5)*.22;',
      '  float halo=smoothstep(.3,.9,f)*(1.-body)*.4;',
      '  gl_FragColor=vec4(mix(col,lit,body),clamp(body+halo,0.,1.));',
      '}'
    ].join('\n')
  });
})(window.MotionKit);;
/* bg: orb - glowing "AI orb": a swirling liquid sphere with rim light that leans toward the cursor,
 * swells and speeds up on hover. Put it on a square-ish element (e.g. 420x420) or a hero section.
 * Options: data-bg-speed="1" data-bg-size="1" (orb radius multiplier) */
(function (MK) {
  'use strict';
  MK.shaderBg('orb', {
    maxDpr: 1.5,
    uniforms: { u_size: function (env) { return env.opt('size', 1); } },
    fs: [
      'uniform float u_size;',
      'void main(){',
      '  float s=min(u_res.x,u_res.y);',
      '  vec2 p=(gl_FragCoord.xy-.5*u_res)/s;',
      '  vec2 m=(u_mouse-.5)*u_res/s;',
      '  p-=m*.07*u_hover;',
      '  float t=u_time*(.35+.5*u_hover);',
      '  float R=(.3+.012*sin(u_time*1.6)+.03*u_hover)*u_size;',
      '  float d=length(p);',
      '  vec2 q=p*3.2/u_size;',
      '  vec2 w=vec2(fbm(q+vec2(t,-t*.7)),fbm(q+vec2(-t*.8,t)+4.3));',
      '  float n=fbm(q+w*2.2+t*.3);',
      '  vec3 inner=mix(u_c1,u_c2,smoothstep(.25,.75,n));',
      '  inner=mix(inner,u_c3,smoothstep(.55,.9,w.x));',
      '  float z=sqrt(max(R*R-d*d,0.))/R;',
      '  float body=smoothstep(R+.004,R-.004,d);',
      '  float rim=pow(1.-z,3.);',
      '  vec3 col=inner*(.45+.75*z)+rim*mix(u_c2,vec3(1.),.35)*1.4;',
      '  vec2 hp=p-vec2(-.32,.36)*R;',
      '  col+=vec3(1.)*smoothstep(R*.42,0.,length(hp))*.45*z;',
      '  float glow=exp(-max(d-R,0.)*9./R)*(1.-body);',
      '  vec3 gcol=mix(u_c1,u_c2,.5+.5*sin(u_time*.7));',
      '  gl_FragColor=vec4(mix(gcol,col,body),max(body,glow*(.55+.25*u_hover)));',
      '}'
    ].join('\n')
  });
})(window.MotionKit);;
/* bg: beams - volumetric light rays pouring down from above the section; the source follows the cursor.
 * Best on dark heroes. Options: data-bg-speed="1" */
(function (MK) {
  'use strict';
  MK.shaderBg('beams', {
    maxDpr: 1,
    fs: [
      'void main(){',
      '  vec2 uv=gl_FragCoord.xy/u_res;',
      '  float ar=u_res.x/u_res.y;',
      '  vec2 src=vec2(.5+(u_mouse.x-.5)*.35*u_hover,1.25);',
      '  vec2 d=uv-src;d.x*=ar;',
      '  float ang=atan(d.x,-d.y);',
      '  float dist=length(d);',
      '  float t=u_time*.35;',
      '  float r=pow(.5+.5*sin(ang*14.+t+1.5*sin(ang*5.-t*.7)),8.)*.6;',
      '  r+=pow(.5+.5*sin(ang*23.-t*1.4+2.),14.)*.45;',
      '  r+=pow(.5+.5*sin(ang*7.+t*.5+4.),5.)*.4;',
      '  float n=fbm(vec2(ang*4.,dist*3.-t*1.5));',
      '  float fall=smoothstep(1.9,.2,dist)*smoothstep(1.1,.1,abs(ang));',
      '  float v=r*fall*(.5+.9*n);',
      '  vec3 col=mix(u_c1,u_c2,clamp(uv.x+.3*sin(t),0.,1.));',
      '  col=mix(col,u_c3,n*.35)+vec3(.25)*v;',
      '  gl_FragColor=vec4(col,clamp(v*1.2,0.,1.));',
      '}'
    ].join('\n')
  });
})(window.MotionKit);;
/* bg: tunnel - endless neon wormhole flying toward the viewer; steers with the cursor (gaming, sci-fi, music).
 * Options: data-bg-speed="1" */
(function (MK) {
  'use strict';
  MK.shaderBg('tunnel', {
    maxDpr: 1,
    fs: [
      'void main(){',
      '  vec2 p=(gl_FragCoord.xy-.5*u_res)/u_res.y;',
      '  p-=(u_mouse-.5)*.25*u_hover;',
      '  float r=length(p)+1e-4;',
      '  float a=atan(p.y,p.x)/3.14159265;',
      '  float t=u_time*.55;',
      '  float depth=.35/r+t;',
      '  float rings=pow(abs(sin(depth*6.2831853)),18.);',
      '  float spokes=pow(abs(sin(a*25.1327412)),24.);',
      '  float grid=max(rings,spokes);',
      '  float band=.5+.5*sin(depth*1.7+a*6.2831853);',
      '  vec3 col=mix(u_c1,u_c2,band);',
      '  col=mix(col,u_c3,grid);',
      '  float fog=smoothstep(.02,.5,r);',
      '  vec3 c=col*(.18+1.1*grid)*fog;',
      '  c+=u_c2*exp(-r*9.)*.9;',
      '  c*=1.+.3*u_hover;',
      '  gl_FragColor=vec4(c,1.);',
      '}'
    ].join('\n')
  });
})(window.MotionKit);;
/* bg: globe - rotating 3D dotted Earth (real continents) with glowing connection arcs and pulses
 * (SaaS, logistics, travel, global brands). Tilts toward the cursor; data-bg-drag lets users spin it.
 * Options: data-bg-speed="1" data-bg-arcs="10" data-bg-size="1" data-bg-x="0.5" data-bg-y="0.5" (center)
 * Land data: Natural Earth 110m (public domain), 2-degree grid, generated by tools/gen-land.mjs.
 */
(function (MK) {
  'use strict';
  var LAND = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOAfAP8DAAAAAAAAAAAAAAAAAAAAAADo//z//wcAAAAAAAACAAAAAAAAAAAAhvvw//8PAPABAAAAwAMAAAAAAAAAwADkw////wEABAAAAABgAAAAAAAAAADAUT8A/v8PAAAAAAwA/j8AuAEAAAAAcBHtDcD/fwAAAAAwAPz/fwMAABCAAQD5w/wD8P8FAAAMAIL7DwCAAOx/AH8ggLFFDv8A4P//B/D/SAAAAAAAQIAPAAAAAODBB+D//x8AKAAEAAAAAAAAcwAAAABAB/7Af/j/YCgAAAAAAAAAAADw/////wEs4AEAAHz+////////////gL////8HeAAcAADg5///////////9ADgAf7/f4AnAAAAAH78////////H0QAAAiA//8f8AcAAIBB4////////38ADwAQAOD//5//AQAAHAT/////////A3AAAAAA/v//+T8AAGDz//////////8DAQAAAMD/////AwAAsP//////////LwAAAAAA6P///2IAAAD+//////////8CAAAAAAD///8/CAAA4P//////////JwAAAAAA8P///wYAAAD+/unz/////z8AAAAAAAD///8HAAAA/pgPPP//////MQAAAAAA8P//PwAAAMBD9v7n/////wcBAAAAAAD///8AAAAAPkD7f/7///8hEAAAAAAA4P//DwAAAIDhAv/n////f8YAAAAAAAD8//8AAAAA+AdE//////8jDwAAAAAAgP//AwAAAMD/APD/////PxgAAAAAAADw/x8AAAAA/n/v//////8HAAAAAAAAAPwDAgAAAOD////7////fwAAAAAAAACgHyAAAACA//9/f/7///8DAAAAAAAAAPQBAAAAAPj//+cv+P//PwAAAAAAAAAAHjAAAADA/////g/+//8EAAAAAAAAAOBhCAAAAP7//99/4D//AAAAAAAAAAAAPAMEAADA////+Qf84BcAAAAAAAAAAAA/AAAAAPz//58fgAf+QAAAAAAAAAAAAA8AAADg////ewA4gA8EAAAAAAAAAADAAAAAAPz//38BgAP4QQAAAAAAAAAAAAgPAADA////zwAwgAwQAAAAAAAAAAAA9Q8AAPj///8HAAVIAAAAAAAAAAAAAID/AQAA////fwBAAAAQAAAAAAAAAAAA+P8AAGDh//8DAAA0GAAAAAAAAAAAAID/HwAAAPj/HwAAgMIBAAAAAAAAAAAA/P8BAACA//8AAAAYXgAAAAAAAAAAAMD/fwAAAPz/BwAAAOOBAQAAAAAAAAAA/P8/AACA/z8AAABgbtQBAAAAAAAAAOD//w8AAPD/AwAAAAQIeAAAAAAAAAAA/P//AQAA/z8AAACAA4APAQAAAAAAAID//w8AAPD/AwAAAAARsEAAAAAAAAAA+P9/AAAA/j8AAAAAAAAAAAAAAAAAAAD//wcAAPD/QwAAAACAIwAAAAAAAAAA8P9/AAAA/z8EAAAAAD8GIAAAAAAAAAD8/wMAAPD/cQAAAAD4ZwAAAAAAAAAAgP8/AAAA/w8HAAAAgP8HAAAAAAAAAAD4/wMAAOD/MAAAAAD//wEBAAAAAAAAgP8PAAAA/g8DAAAA+P8fAAAAAAAAAAD4PwAAAOB/EAAAAID//wMAAAAAAAAAgP8DAAAA/AMAAAAA+P9/AAAAAAAAAAD8HwAAAMA/AAAAAID//wcAAAAAAAAAwP8BAAAA+AEAAAAA8P9/AAAAAAAAAAD8DwAAAIAPAAAAAAAP/gMAAAAAAAAAwB8AAAAAAAAAAAAAEIAfAAEAAAAAAAD+AwAAAAAAAAAAAAAA8AEgAAAAAAAA4AcAAAAAAAAAAAAAAAAAAAYAAAAAAABeAAAAAAAAAAAAAAAAwAAwAAAAAAAAwAMAAAAAAAAAAAAAAAAIgAEAAAAAAAAeAAAAAAAAAAAAAAAAAAAMAAAAAAAA4AEAAAAAAAAAAAAAAAAAAAAAAAAAAAAPAAAAAAAAAAABAAAAAAAAAAAAAAAAcAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  var W = 180, H = 90, POINTS = null;

  function points() {
    if (POINTS) return POINTS;
    var bin = atob(LAND), pts = [];
    for (var j = 0; j < H; j++) {
      var lat = (90 - (j + 0.5) * 2) * Math.PI / 180;
      // fewer dots near the poles so spacing stays even on the sphere
      var step = Math.max(1, Math.round(1 / Math.max(Math.cos(lat), 0.2)));
      for (var i = 0; i < W; i += step) {
        var k = j * W + i;
        if (!(bin.charCodeAt(k >> 3) & (1 << (k & 7)))) continue;
        var lon = (-180 + (i + 0.5) * 2) * Math.PI / 180;
        pts.push([Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)]);
      }
    }
    POINTS = pts;
    return pts;
  }
  function slerp(a, b, t) {
    var dot = MK.clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1);
    var om = Math.acos(dot), so = Math.sin(om) || 1e-6;
    var k1 = Math.sin((1 - t) * om) / so, k2 = Math.sin(t * om) / so;
    return [a[0] * k1 + b[0] * k2, a[1] * k1 + b[1] * k2, a[2] * k1 + b[2] * k2];
  }

  MK.defineBg('globe', {
    canvas: true,
    create: function (env) {
      var pts = points();
      var speed = env.opt('speed', 1), size = env.opt('size', 1), nArcs = Math.round(env.opt('arcs', 10));
      var cxr = env.opt('x', 0.5), cyr = env.opt('y', 0.5);
      var c1 = MK.rgb(env.colors[0]).join(','), c2 = MK.rgb(env.colors[1] || env.colors[0]).join(','), c3 = MK.rgb(env.colors[2] || env.colors[0]).join(',');
      var rotY = 0, tiltX = 0.35, dragV = 0, dragging = false, lastX = 0, mx = 0, my = 0;
      var arcs = [];
      function newArc(now) {
        var a = pts[(Math.random() * pts.length) | 0], b = pts[(Math.random() * pts.length) | 0];
        var d = Math.acos(MK.clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1));
        if (d < 0.35 || d > 1.9) return newArc(now);
        return { a: a, b: b, h: 0.12 + d * 0.16, start: now + Math.random() * 1800, dur: 1600 + d * 900 };
      }
      if (env.el.hasAttribute('data-bg-drag')) {
        env.el.style.touchAction = 'pan-y';
        env.el.addEventListener('pointerdown', function (e) { dragging = true; lastX = e.clientX; });
        window.addEventListener('pointerup', function () { dragging = false; });
        window.addEventListener('pointermove', function (e) {
          if (!dragging) return;
          dragV = (e.clientX - lastX) * 0.005;
          rotY += dragV;
          lastX = e.clientX;
        });
      }
      function project(p, cosY, sinY, cosX, sinX) {
        var x = p[0] * cosY + p[2] * sinY, z = -p[0] * sinY + p[2] * cosY;
        var y = p[1] * cosX - z * sinX, z2 = p[1] * sinX + z * cosX;
        return [x, y, z2];
      }
      function draw(t, dt, animate) {
        var ctx = env.ctx, w = env.w, h = env.h, P = env.pointer;
        var R = Math.min(w, h) * 0.42 * size, cx = w * cxr, cy = h * cyr;
        if (animate) {
          mx = MK.lerp(mx, P.active ? P.nx - 0.5 : 0, 0.04);
          my = MK.lerp(my, P.active ? P.ny - 0.5 : 0, 0.04);
          if (!dragging) { rotY += (dt / 1000) * 0.18 * speed + dragV; dragV *= 0.94; }
        }
        var ry = rotY + mx * 0.6, tx = tiltX + my * 0.4;
        var cosY = Math.cos(ry), sinY = Math.sin(ry), cosX = Math.cos(tx), sinX = Math.sin(tx);
        ctx.clearRect(0, 0, w, h);
        // atmosphere
        var g = ctx.createRadialGradient(cx, cy, R * 0.85, cx, cy, R * 1.28);
        g.addColorStop(0, 'rgba(' + c1 + ',0.28)');
        g.addColorStop(1, 'rgba(' + c1 + ',0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cx, cy, R * 1.28, 0, 6.2832); ctx.fill();
        var body = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
        body.addColorStop(0, 'rgba(' + c2 + ',0.10)');
        body.addColorStop(1, 'rgba(' + c1 + ',0.04)');
        ctx.fillStyle = body;
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.fill();
        // land dots (front brighter, back very faint)
        ctx.fillStyle = 'rgb(' + c1 + ')';
        var dot = Math.max(1, R / 170);
        for (var i = 0; i < pts.length; i++) {
          var q = project(pts[i], cosY, sinY, cosX, sinX);
          if (q[2] < -0.05) continue;
          var f = q[2];
          ctx.globalAlpha = f < 0 ? 0.06 : 0.22 + 0.78 * f;
          var s = dot * (0.7 + 0.6 * Math.max(f, 0));
          ctx.fillRect(cx + q[0] * R - s / 2, cy - q[1] * R - s / 2, s, s);
        }
        ctx.globalAlpha = 1;
        // arcs + pulses
        var now = t;
        while (arcs.length < nArcs) arcs.push(newArc(now));
        ctx.lineWidth = Math.max(1, R / 220);
        for (var a = 0; a < arcs.length; a++) {
          var arc = arcs[a], pr = (now - arc.start) / arc.dur;
          if (pr < 0) continue;
          if (pr > 1.6) { arcs[a] = newArc(now); continue; }
          var head = Math.min(pr, 1), tail = Math.max(0, pr - 0.6);
          var prev = null;
          for (var sgi = 0; sgi <= 28; sgi++) {
            var st = tail + (head - tail) * (sgi / 28);
            var v = slerp(arc.a, arc.b, st), lift = 1 + arc.h * Math.sin(Math.PI * st);
            var qq = project([v[0] * lift, v[1] * lift, v[2] * lift], cosY, sinY, cosX, sinX);
            var sx = cx + qq[0] * R, sy = cy - qq[1] * R;
            if (prev && qq[2] > -0.1 && prev[2] > -0.1) {
              ctx.strokeStyle = 'rgba(' + (sgi % 2 ? c2 : c3) + ',' + (0.25 + 0.75 * (sgi / 28)).toFixed(2) + ')';
              ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(sx, sy); ctx.stroke();
            }
            prev = [sx, sy, qq[2]];
          }
          [arc.a, arc.b].forEach(function (end, ei) {
            var qe = project(end, cosY, sinY, cosX, sinX);
            if (qe[2] < 0) return;
            var ex = cx + qe[0] * R, ey = cy - qe[1] * R;
            var ph = ei ? Math.max(0, pr - 0.95) * 2 : pr;
            if (ph <= 0 || ph > 1) return;
            ctx.strokeStyle = 'rgba(' + c3 + ',' + (1 - ph).toFixed(2) + ')';
            ctx.beginPath(); ctx.arc(ex, ey, 2 + ph * R * 0.06, 0, 6.2832); ctx.stroke();
            ctx.fillStyle = 'rgb(' + c3 + ')';
            ctx.fillRect(ex - 1.5, ey - 1.5, 3, 3);
          });
        }
      }
      return {
        frame: function (t, dt) { draw(t, dt, true); },
        still: function () { draw(900, 16, false); }
      };
    }
  });
})(window.MotionKit);;
/* bg: galaxy - a spiral galaxy of thousands of glowing stars rotating in 3D; the cursor tilts the view
 * (space, AI, gaming, astronomy, "cosmic" brands). Dark sections only.
 * Options: data-bg-arms="3" data-bg-speed="1" data-bg-density="1" data-bg-tilt="62" (degrees) */
(function (MK) {
  'use strict';
  MK.defineBg('galaxy', {
    canvas: true,
    create: function (env) {
      var arms = Math.round(MK.clamp(env.opt('arms', 3), 1, 6)), speed = env.opt('speed', 1), density = env.opt('density', 1);
      var baseTilt = env.opt('tilt', 62) * Math.PI / 180;
      var cols = [env.colors[2] || env.colors[0], '#ffffff', env.colors[0], env.colors[1] || env.colors[0]];
      var buckets = [[], [], [], []], dust = [], built = 0, tx = 0, ty = 0;
      function build(w, h) {
        var n = Math.round(MK.clamp(w * h / 260, 1500, 4200) * density);
        buckets = [[], [], [], []];
        for (var i = 0; i < n; i++) {
          var r = Math.pow(Math.random(), 1.5);
          var arm = i % arms;
          var ang = (arm / arms) * Math.PI * 2 + r * 5.2 + (Math.random() - 0.5) * (0.9 - r * 0.45);
          var spread = (Math.random() - 0.5) * 0.16 * (1 - r * 0.5);
          var s = {
            r: r + spread * 0.3, a: ang, z: (Math.random() - 0.5) * 0.09 * (1 - r) * (1 - r),
            size: 0.6 + Math.random() * 1.5 * (1 - r * 0.45), b: 0.3 + Math.random() * 0.7,
            w: (0.06 + 0.09 / (0.18 + r)) * (0.8 + Math.random() * 0.4)
          };
          // core stars are hot white/pink, arms palette 1, rim palette 2
          var bucket = r < 0.12 ? (Math.random() < 0.5 ? 0 : 1) : (r < 0.62 ? (Math.random() < 0.18 ? 1 : 2) : 3);
          buckets[bucket].push(s);
        }
        dust = [];
        for (var k = 0; k < 180; k++) dust.push([Math.random() * w, Math.random() * h, Math.random() * 0.5 + 0.2]);
        built = w * h;
      }
      function draw(dt) {
        var ctx = env.ctx, w = env.w, h = env.h, P = env.pointer;
        if (built !== w * h) build(w, h);
        tx = MK.lerp(tx, P.active ? (P.ny - 0.5) * 0.5 : 0, 0.04);
        ty = MK.lerp(ty, P.active ? (P.nx - 0.5) * 0.5 : 0, 0.04);
        var tilt = baseTilt + tx, ct = Math.cos(tilt), st = Math.sin(tilt), cy_ = Math.cos(ty), sy_ = Math.sin(ty);
        var scale = Math.min(w, h) * 0.5, cx = w / 2, cy = h / 2;
        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#ffffff';
        for (var d = 0; d < dust.length; d++) { ctx.globalAlpha = dust[d][2] * 0.5; ctx.fillRect(dust[d][0], dust[d][1], 1, 1); }
        ctx.globalCompositeOperation = 'lighter';
        var core = ctx.createRadialGradient(cx, cy, 0, cx, cy, scale * 0.35);
        core.addColorStop(0, MK.rgba(cols[0], 0.55));
        core.addColorStop(0.4, MK.rgba(cols[2], 0.18));
        core.addColorStop(1, MK.rgba(cols[2], 0));
        ctx.globalAlpha = 1;
        ctx.fillStyle = core;
        ctx.fillRect(cx - scale, cy - scale, scale * 2, scale * 2);
        var k = (dt / 1000) * speed;
        for (var bi = 0; bi < 4; bi++) {
          ctx.fillStyle = cols[bi];
          var list = buckets[bi];
          for (var i = 0; i < list.length; i++) {
            var s = list[i];
            s.a += s.w * k;
            var x = Math.cos(s.a) * s.r, y = Math.sin(s.a) * s.r, z = s.z;
            var x2 = x * cy_ + z * sy_, z1 = -x * sy_ + z * cy_;
            var y2 = y * ct - z1 * st, z2 = y * st + z1 * ct;
            var f = 1 / (1 + z2 * 0.5);
            var px = cx + x2 * scale * f, py = cy + y2 * scale * f;
            ctx.globalAlpha = s.b * (0.55 + 0.45 * f);
            var sz = s.size * f;
            ctx.fillRect(px, py, sz, sz);
          }
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
      return { frame: function (t, dt) { draw(dt); }, still: function () { draw(0); } };
    }
  });
})(window.MotionKit);;
/* bg: warp - a glowing grid that bends like spacetime around the cursor (gravity well) and ripples
 * gently when idle (tech, science, fintech, dev tools).
 * Options: data-bg-gap="38" (px between lines) data-bg-strength="1" data-bg-repel (push instead of pull) */
(function (MK) {
  'use strict';
  MK.defineBg('warp', {
    canvas: true,
    create: function (env) {
      var gap = env.opt('gap', 38), strength = env.opt('strength', 1), sign = env.el.hasAttribute('data-bg-repel') ? -1 : 1;
      var mx = -9999, my = -9999, amt = 0;
      function frame(t) {
        var ctx = env.ctx, w = env.w, h = env.h, P = env.pointer;
        // idle: a slow autopilot 'star' drifts across so the grid is always alive
        var tx = P.active ? P.x : w * (0.5 + 0.34 * Math.sin(t * 0.00031)), ty = P.active ? P.y : h * (0.5 + 0.3 * Math.sin(t * 0.00047 + 1.3));
        mx = mx < -999 ? tx : MK.lerp(mx, tx, P.active ? 0.12 : 0.03); my = my < -999 ? ty : MK.lerp(my, ty, P.active ? 0.12 : 0.03);
        amt = MK.lerp(amt, P.active ? 1 : 0.6, 0.05);
        var R = Math.min(w, h) * 0.34, pull = 46 * strength * amt * sign, s2 = 2 * (R * 0.55) * (R * 0.55);
        function disp(x, y) {
          var dx = mx - x, dy = my - y, d2 = dx * dx + dy * dy;
          var f = pull * Math.exp(-d2 / s2), d = Math.sqrt(d2) + 1e-3;
          var wave = Math.sin(x * 0.012 + t * 0.0011) * 2.2 + Math.cos(y * 0.014 - t * 0.0009) * 2.2;
          return [x + (dx / d) * f + wave * 0.35, y + (dy / d) * f + wave];
        }
        function lines() {
          ctx.beginPath();
          var x, y, p;
          for (y = gap / 2; y < h + gap; y += gap) {
            for (x = -12; x <= w + 12; x += 14) { p = disp(x, y); if (x < -11) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]); }
          }
          for (x = gap / 2; x < w + gap; x += gap) {
            for (y = -12; y <= h + 12; y += 14) { p = disp(x, y); if (y < -11) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]); }
          }
        }
        ctx.clearRect(0, 0, w, h);
        lines();
        ctx.lineWidth = 1;
        ctx.strokeStyle = MK.rgba(env.colors[1] || env.colors[0], 0.13);
        ctx.stroke();
        if (amt > 0.02) {
          var g = ctx.createRadialGradient(mx, my, 0, mx, my, R * 1.1);
          g.addColorStop(0, MK.rgba(env.colors[2] || env.colors[0], 0.95 * amt));
          g.addColorStop(0.35, MK.rgba(env.colors[0], 0.6 * amt));
          g.addColorStop(1, MK.rgba(env.colors[0], 0));
          ctx.strokeStyle = g;
          ctx.lineWidth = 1.4;
          ctx.stroke();
        }
      }
      return { frame: frame };
    }
  });
})(window.MotionKit);;
/* bg: flow - generative art: thousands of particles drift through a noise flow field leaving silky trails;
 * the cursor stirs a vortex (creative studios, art, music, luxury on dark backgrounds).
 * Options: data-bg-density="1" data-bg-speed="1" data-bg-trail="0.06" (lower = longer trails) */
(function (MK) {
  'use strict';
  // small, fast value noise
  var perm = new Uint8Array(512);
  (function () { var p = []; for (var i = 0; i < 256; i++) p[i] = i; for (i = 255; i > 0; i--) { var j = (Math.random() * (i + 1)) | 0, t = p[i]; p[i] = p[j]; p[j] = t; } for (i = 0; i < 512; i++) perm[i] = p[i & 255]; })();
  function vnoise(x, y) {
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    xi &= 255; yi &= 255;
    var a = perm[perm[xi] + yi] / 255, b = perm[perm[xi + 1] + yi] / 255, c = perm[perm[xi] + yi + 1] / 255, d = perm[perm[xi + 1] + yi + 1] / 255;
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  MK.defineBg('flow', {
    canvas: true,
    create: function (env) {
      var density = env.opt('density', 1), speed = env.opt('speed', 1), trail = env.opt('trail', 0.06);
      var ps = [], cols = env.colors, sized = 0;
      function spawn(p, w, h) {
        p.x = Math.random() * w; p.y = Math.random() * h; p.age = 0; p.life = 120 + Math.random() * 220;
        p.c = (Math.random() * cols.length) | 0;
        return p;
      }
      function resize(w, h) {
        var n = Math.round(MK.clamp(w * h / 700, 400, 2400) * density);
        ps = [];
        for (var i = 0; i < n; i++) spawn(ps[i] = {}, w, h).age = Math.random() * 200;
        sized = w * h;
        env.ctx.clearRect(0, 0, w, h);
      }
      function step(t, k, ctx) {
        var w = env.w, h = env.h, P = env.pointer, z = t * 0.00004;
        for (var ci = 0; ci < cols.length; ci++) {
          ctx.strokeStyle = cols[ci];
          ctx.beginPath();
          for (var i = ci; i < ps.length; i += cols.length) {
            var p = ps[i];
            var a = vnoise(p.x * 0.0028 + z, p.y * 0.0028 - z) * Math.PI * 4;
            var vx = Math.cos(a), vy = Math.sin(a);
            if (P.active) {
              var dx = p.x - P.x, dy = p.y - P.y, d2 = dx * dx + dy * dy;
              if (d2 < 32000) { var f = (1 - d2 / 32000) * 2.4; vx += (-dy / Math.sqrt(d2 + 1)) * f; vy += (dx / Math.sqrt(d2 + 1)) * f; }
            }
            var nx = p.x + vx * 1.6 * k, ny = p.y + vy * 1.6 * k;
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(nx, ny);
            p.x = nx; p.y = ny; p.age += k;
            if (p.age > p.life || nx < -5 || nx > w + 5 || ny < -5 || ny > h + 5) spawn(p, w, h);
          }
          ctx.stroke();
        }
      }
      function frame(t, dt) {
        var ctx = env.ctx, w = env.w, h = env.h;
        if (sized !== w * h) resize(w, h);
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0,0,0,' + trail + ')';
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'source-over';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.55;
        step(t, (dt / 16) * speed, ctx);
        ctx.globalAlpha = 1;
      }
      return {
        resize: resize,
        frame: frame,
        still: function () { for (var i = 0; i < 60; i++) frame(i * 16, 16); }
      };
    }
  });
})(window.MotionKit);
