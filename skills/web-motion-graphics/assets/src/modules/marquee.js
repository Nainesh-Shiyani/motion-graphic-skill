/* Motion Kit - marquee: seamless infinite scrolling rows (logos, testimonials, big words)
 *   <div data-marquee> <span>Item</span> <span>Item</span> ... </div>
 * Options: data-marquee-speed="60" (px/sec)  data-marquee-direction="left|right|up|down"
 *          data-marquee-pause (slow to a stop on hover)  data-marquee-scroll (speeds up & flips with scroll)
 *          --mk-gap CSS var for spacing (default 3rem). Vertical marquees need a fixed height.
 * Add class "mk-marquee-fade" to fade the edges.
 */
(function (MK) {
  'use strict';
  var d = document;

  MK.register({
    name: 'marquee',
    selector: '[data-marquee]',
    init: function (el) {
      var dir = MK.attr(el, 'data-marquee-direction', MK.attr(el, 'data-marquee', 'left'));
      if (!/^(left|right|up|down)$/.test(dir)) dir = 'left';
      var vertical = dir === 'up' || dir === 'down';
      el.classList.add('mk-marquee', vertical ? 'mk-marquee-v' : 'mk-marquee-h');

      var track = el.querySelector(':scope > .mk-marquee-track');
      var group;
      if (!track) {
        track = d.createElement('div');
        track.className = 'mk-marquee-track';
        group = d.createElement('div');
        group.className = 'mk-marquee-group';
        while (el.firstChild) group.appendChild(el.firstChild);
        track.appendChild(group);
        el.appendChild(track);
      } else {
        group = track.querySelector(':scope > .mk-marquee-group') || track;
      }
      if (MK.reduced) { el.classList.add('mk-marquee-static'); return; }

      var speed = MK.num(el, 'data-marquee-speed', 60);
      var anim = null, clones = [], rate = 1, targetRate = 1, hovering = false;

      function build() {
        clones.forEach(function (c) { c.remove(); });
        clones = [];
        var size = vertical ? group.offsetHeight : group.offsetWidth;
        var box = vertical ? el.clientHeight : el.clientWidth;
        if (!size) return;
        var copies = Math.max(1, Math.ceil(box / size)) + 1;
        for (var i = 0; i < copies; i++) {
          var c = group.cloneNode(true);
          c.setAttribute('aria-hidden', 'true');
          c.setAttribute('inert', '');
          track.appendChild(c);
          clones.push(c);
        }
        if (anim) anim.cancel();
        var shift = vertical ? 'translate3d(0,' + (-size) + 'px,0)' : 'translate3d(' + (-size) + 'px,0,0)';
        anim = track.animate([{ transform: 'translate3d(0,0,0)' }, { transform: shift }], {
          duration: (size / Math.max(1, speed)) * 1000,
          iterations: Infinity,
          easing: 'linear',
          direction: dir === 'right' || dir === 'down' ? 'reverse' : 'normal'
        });
        anim.playbackRate = rate;
      }

      var lastSize = 0;
      var ro = window.ResizeObserver ? new ResizeObserver(function () {
        var s = (vertical ? group.offsetHeight : group.offsetWidth) + 'x' + (vertical ? el.clientHeight : el.clientWidth);
        if (s !== lastSize) { lastSize = s; build(); }
      }) : null;
      if (ro) { ro.observe(el); ro.observe(group); } else build();

      var pauseOnHover = el.hasAttribute('data-marquee-pause');
      var scrollBoost = el.hasAttribute('data-marquee-scroll');
      function enter() { hovering = true; }
      function leave() { hovering = false; }
      if (pauseOnHover) {
        el.addEventListener('pointerenter', enter);
        el.addEventListener('pointerleave', leave);
      }
      var sign = 1, lastY = window.pageYOffset, vel = 0;
      var stopTick = MK.ticker(el, function () {
        if (!anim) return;
        if (scrollBoost) {
          var y = window.pageYOffset;
          vel = MK.lerp(vel, y - lastY, 0.25);
          lastY = y;
          if (Math.abs(vel) > 0.5) sign = vel > 0 ? 1 : -1;
          targetRate = sign * (1 + Math.min(Math.abs(vel) * 0.15, 5));
        } else {
          targetRate = 1;
        }
        if (hovering) targetRate = 0;
        rate = MK.lerp(rate, targetRate, 0.08);
        if (Math.abs(rate - targetRate) < 0.001) rate = targetRate;
        if (anim.playbackRate !== rate) anim.playbackRate = rate;
      });
      var offView = MK.inView(el, function (v) { if (anim) { if (v) anim.play(); else anim.pause(); } });
      return function () {
        stopTick(); offView();
        if (ro) ro.disconnect();
        if (anim) anim.cancel();
        el.removeEventListener('pointerenter', enter);
        el.removeEventListener('pointerleave', leave);
      };
    }
  });
})(window.MotionKit);
