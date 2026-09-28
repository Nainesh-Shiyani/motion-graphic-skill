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
})(window.MotionKit);
