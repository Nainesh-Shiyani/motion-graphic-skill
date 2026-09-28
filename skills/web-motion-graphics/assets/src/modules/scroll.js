/* Motion Kit - scroll: scroll-linked effects
 *   <div data-scroll-progress></div>          reading-progress bar (fixed at top by default)
 *   data-scroll-progress="#article"           progress through one element instead of the page
 *   data-scrub="scale-in|fade-in|slide-left|slide-right|rotate|spin|zoom-out|tilt-3d|blur-in|clip|text-fill"
 *   data-scrub (no value)                     just exposes CSS vars for your own styles:
 *       --mk-p      0 -> 1 while the element travels through the whole viewport
 *       --mk-enter  0 -> 1 while the element enters (top edge from bottom of screen to 40%)
 *   :root always gets --mk-scroll (0 -> 1 page progress) once this module is active.
 */
(function (MK) {
  'use strict';
  var root = document.documentElement;

  function pageProgress() {
    var max = root.scrollHeight - window.innerHeight;
    return max > 0 ? MK.clamp(window.pageYOffset / max, 0, 1) : 0;
  }

  MK.register({
    name: 'scroll-progress',
    selector: '[data-scroll-progress]',
    init: function (el) {
      var target = el.getAttribute('data-scroll-progress');
      var t = target ? document.querySelector(target) : null;
      if (!el.children.length && !el.classList.contains('mk-progress-custom')) el.classList.add('mk-progress');
      return MK.onScroll(function (y, vh) {
        var p;
        if (t) {
          var r = t.getBoundingClientRect();
          p = MK.clamp(-r.top / Math.max(1, r.height - vh), 0, 1);
        } else {
          p = pageProgress();
        }
        el.style.setProperty('--mk-p', p.toFixed(4));
        el.style.scale = p.toFixed(4) + ' 1';
        root.style.setProperty('--mk-scroll', pageProgress().toFixed(4));
      });
    }
  });

  MK.register({
    name: 'scrub',
    selector: '[data-scrub]',
    init: function (el) {
      if (MK.reduced) {
        el.style.setProperty('--mk-p', '0.5');
        el.style.setProperty('--mk-enter', '1');
        return;
      }
      var active = false;
      var offView = MK.inView(el, function (v) { active = v; if (v) MK.update(); }, { rootMargin: '20% 0px' });
      var offScroll = MK.onScroll(function (y, vh) {
        if (!active) return;
        var r = el.getBoundingClientRect();
        var p = MK.clamp((vh - r.top) / (vh + r.height), 0, 1);
        var enter = MK.clamp((vh - r.top) / (vh * 0.6), 0, 1);
        el.style.setProperty('--mk-p', p.toFixed(4));
        el.style.setProperty('--mk-enter', enter.toFixed(4));
      });
      return function () { offView(); offScroll(); };
    }
  });
})(window.MotionKit);
