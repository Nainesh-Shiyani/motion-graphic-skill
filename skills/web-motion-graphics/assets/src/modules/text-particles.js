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
})(window.MotionKit);
