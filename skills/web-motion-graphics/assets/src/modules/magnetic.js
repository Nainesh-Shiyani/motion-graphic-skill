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
})(window.MotionKit);
