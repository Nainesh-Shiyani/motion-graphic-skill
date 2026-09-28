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
})(window.MotionKit);
