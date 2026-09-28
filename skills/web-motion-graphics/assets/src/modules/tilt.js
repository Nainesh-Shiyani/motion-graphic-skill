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
})(window.MotionKit);
