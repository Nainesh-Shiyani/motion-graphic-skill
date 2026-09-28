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
})(window.MotionKit);
