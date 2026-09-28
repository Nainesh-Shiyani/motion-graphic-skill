/* Motion Kit - story: pinned scroll storytelling
 *   <section data-horizontal> <article>..</article> <article>..</article> ... </section>
 *       vertical scrolling moves the panels sideways while the section stays pinned.
 *       Options: data-horizontal-gap="32" (px). Exposes --mk-p (0..1) on the section.
 *   <section data-steps>
 *       <div class="mk-sticky mk-steps-stack"> <img data-step-target="0"> <img data-step-target="1"> </div>
 *       <div> <div data-step>First</div> <div data-step>Second</div> </div>
 *   </section>
 *       the step in the middle of the screen gets .mk-active, and so does its matching
 *       [data-step-target]. The section gets data-active-step="n" and --mk-step: n.
 * NOTE: position: sticky breaks if an ancestor has overflow: hidden. Use overflow-x: clip instead.
 */
(function (MK) {
  'use strict';
  var d = document;

  MK.register({
    name: 'horizontal',
    selector: '[data-horizontal]',
    init: function (section) {
      var track = section.querySelector(':scope .mk-h-track');
      var sticky = section.querySelector(':scope .mk-h-sticky');
      if (!track) {
        sticky = d.createElement('div');
        sticky.className = 'mk-h-sticky';
        track = d.createElement('div');
        track.className = 'mk-h-track';
        while (section.firstChild) track.appendChild(section.firstChild);
        sticky.appendChild(track);
        section.appendChild(sticky);
      }
      var gap = section.getAttribute('data-horizontal-gap');
      if (gap) track.style.gap = /^[0-9.]+$/.test(gap) ? gap + 'px' : gap;
      if (MK.reduced) { section.classList.add('mk-h-native'); return; }
      section.classList.add('mk-h-on');

      var dist = 0;
      function measure() {
        dist = Math.max(0, track.scrollWidth - sticky.clientWidth);
        section.style.height = (dist + window.innerHeight) + 'px';
        MK.update();
      }
      var ro = window.ResizeObserver ? new ResizeObserver(measure) : null;
      if (ro) { ro.observe(track); ro.observe(sticky); }
      window.addEventListener('resize', measure);
      measure();
      var offScroll = MK.onScroll(function (y, vh) {
        var r = section.getBoundingClientRect();
        var p = MK.clamp(-r.top / Math.max(1, r.height - vh), 0, 1);
        track.style.transform = 'translate3d(' + (-p * dist).toFixed(1) + 'px,0,0)';
        section.style.setProperty('--mk-p', p.toFixed(4));
      });
      return function () {
        offScroll();
        if (ro) ro.disconnect();
        window.removeEventListener('resize', measure);
      };
    }
  });

  MK.register({
    name: 'steps',
    selector: '[data-steps]',
    init: function (el) {
      var steps = Array.prototype.slice.call(el.querySelectorAll('[data-step]'));
      if (!steps.length) return;
      var targets = Array.prototype.slice.call(el.querySelectorAll('[data-step-target]'));
      var current = -1;
      function activate(i) {
        if (i === current) return;
        current = i;
        steps.forEach(function (s, k) { s.classList.toggle('mk-active', k === i); });
        targets.forEach(function (t) {
          t.classList.toggle('mk-active', parseInt(t.getAttribute('data-step-target'), 10) === i);
        });
        el.setAttribute('data-active-step', i);
        el.style.setProperty('--mk-step', i);
        MK.emit(el, 'step', { index: i });
      }
      activate(0);
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) activate(steps.indexOf(e.target));
        });
      }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
      steps.forEach(function (s) { io.observe(s); });
      return function () { io.disconnect(); };
    }
  });
})(window.MotionKit);
