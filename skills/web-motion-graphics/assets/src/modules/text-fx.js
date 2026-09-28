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
})(window.MotionKit);
