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
})(window, document);
