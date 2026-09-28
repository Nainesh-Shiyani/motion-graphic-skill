/* Motion Kit - scrollfx: scroll-driven layout effects
 *   <div data-stack> <article>..</article> <article>..</article> </div>
 *       cards pin on top of each other while scrolling; covered cards shrink and dim (stacking cards).
 *       Options: data-stack-top="90" (px from the top) data-stack-offset="16" (px between pinned cards), --mk-stack-gap
 *   <section data-expand> <img src="hero.jpg" alt=""> <h2>Overlay text</h2> </section>
 *       a framed image/video grows to full-screen while the section is pinned; overlay content fades in at the end.
 *       The first img/video/picture (or [data-expand-media]) is the media. Option: data-expand="250" (section height in vh)
 *   data-velocity="1"          skews the element with scroll speed (big headings, image strips, marquees)
 *   data-page-color="#0b0b10"  the whole page background fades to this color while the section is centered;
 *                              data-page-text="#fff" changes the text color too (keep those sections transparent)
 */
(function (MK) {
  'use strict';
  var d = document;

  MK.register({
    name: 'stack',
    selector: '[data-stack]',
    init: function (el) {
      var cards = Array.prototype.slice.call(el.children);
      if (cards.length < 2) return;
      el.classList.add('mk-stack');
      var top = MK.num(el, 'data-stack-top', 90), step = MK.num(el, 'data-stack-offset', 16);
      cards.forEach(function (c, i) {
        c.style.setProperty('--mk-stack-top', (top + i * step) + 'px');
        c.style.zIndex = String(i + 1);
      });
      if (MK.reduced) return;
      var active = false;
      var offView = MK.inView(el, function (v) { active = v; if (v) MK.update(); }, { rootMargin: '20% 0px' });
      var offScroll = MK.onScroll(function () {
        if (!active) return;
        var rects = cards.map(function (c) { return c.getBoundingClientRect(); });
        var cover = rects.map(function (r, i) {
          if (i === rects.length - 1) return 0;
          var stickyTop = top + i * step, next = rects[i + 1];
          return MK.clamp(1 - (next.top - stickyTop - step) / Math.max(1, r.height), 0, 1);
        });
        for (var i = 0; i < cards.length; i++) {
          var depth = 0;
          for (var j = i; j < cover.length; j++) depth += cover[j] * (j === i ? 1 : 0.6);
          cards[i].style.setProperty('--mk-depth', Math.min(depth, 4).toFixed(3));
        }
      });
      return function () { offView(); offScroll(); };
    }
  });

  MK.register({
    name: 'expand',
    selector: '[data-expand]',
    init: function (section) {
      var sticky = section.querySelector(':scope > .mk-expand-sticky');
      if (!sticky) {
        sticky = d.createElement('div');
        sticky.className = 'mk-expand-sticky';
        while (section.firstChild) sticky.appendChild(section.firstChild);
        section.appendChild(sticky);
      }
      var media = sticky.querySelector('[data-expand-media]') || sticky.querySelector('img,video,picture,canvas');
      if (!media) return;
      var frame = d.createElement('div');
      frame.className = 'mk-expand-frame';
      media.parentNode.insertBefore(frame, media);
      frame.appendChild(media);
      media.classList.add('mk-expand-media');
      Array.prototype.forEach.call(sticky.children, function (c) { if (c !== frame) c.classList.add('mk-expand-content'); });
      section.classList.add('mk-expand');
      if (MK.reduced) { section.classList.add('mk-expand-static'); return; }
      section.style.setProperty('--mk-expand-h', MK.num(section, 'data-expand', 250) + 'vh');
      var active = false;
      var offView = MK.inView(section, function (v) { active = v; if (v) MK.update(); }, { rootMargin: '10% 0px' });
      var offScroll = MK.onScroll(function (y, vh) {
        if (!active) return;
        var r = section.getBoundingClientRect();
        var p = MK.clamp(-r.top / Math.max(1, r.height - vh), 0, 1);
        var e = MK.easeInOutCubic(MK.clamp(p / 0.72, 0, 1));
        section.style.setProperty('--mk-p', p.toFixed(4));
        section.style.setProperty('--mk-e', e.toFixed(4));
      });
      return function () { offView(); offScroll(); };
    }
  });

  MK.register({
    name: 'velocity',
    selector: '[data-velocity]',
    init: function (el) {
      if (MK.reduced) return;
      var amt = MK.num(el, 'data-velocity', 1), cur = 0, lastY = window.pageYOffset;
      var stop = MK.ticker(el, function () {
        var y = window.pageYOffset, v = y - lastY;
        lastY = y;
        var target = MK.clamp(v * 0.22 * amt, -10, 10);
        cur = MK.lerp(cur, target, 0.14);
        if (Math.abs(cur) < 0.01 && !target) { if (el.style.transform) el.style.transform = ''; return; }
        el.style.transform = 'skewY(' + cur.toFixed(3) + 'deg) scaleY(' + (1 + Math.abs(cur) * 0.006).toFixed(4) + ')';
      });
      return function () { stop(); el.style.transform = ''; };
    }
  });

  var pc = null;
  function pageColors() {
    if (pc) return pc;
    var cs = getComputedStyle(d.body);
    pc = { bg: cs.backgroundColor, fg: cs.color, active: [] };
    d.documentElement.classList.add('mk-page-color');
    return pc;
  }
  function applyPage() {
    var s = pc.active[pc.active.length - 1];
    d.body.style.backgroundColor = s ? s.getAttribute('data-page-color') : '';
    d.body.style.color = s && s.hasAttribute('data-page-text') ? s.getAttribute('data-page-text') : '';
    d.documentElement.style.setProperty('--mk-page-color', s ? s.getAttribute('data-page-color') : pc.bg);
  }
  MK.register({
    name: 'page-color',
    selector: '[data-page-color]',
    init: function (el) {
      var st = pageColors();
      var off = MK.inView(el, function (v) {
        var i = st.active.indexOf(el);
        if (v && i < 0) st.active.push(el);
        if (!v && i >= 0) st.active.splice(i, 1);
        applyPage();
      }, { rootMargin: '-50% 0px -50% 0px' });
      return function () { off(); var i = st.active.indexOf(el); if (i >= 0) st.active.splice(i, 1); applyPage(); };
    }
  });
})(window.MotionKit);
