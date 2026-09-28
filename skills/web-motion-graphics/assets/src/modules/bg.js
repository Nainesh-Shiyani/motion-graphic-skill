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
})(window.MotionKit);
