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
})(window.MotionKit);
