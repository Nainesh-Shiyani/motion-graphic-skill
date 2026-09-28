/* Motion Kit - reveal: scroll-triggered entrance animations
 *   <div data-motion="fade-up">                         single element
 *   <ul data-motion-children="zoom-in">                  every direct child, auto-staggered
 *   <div data-motion-stagger="100"> <div data-motion>... children entering together are staggered
 * Options: data-motion-delay="200" data-motion-duration="1200" data-motion-distance="80px"
 *          data-motion-ease="smooth|snappy|bounce|in-out|linear" data-motion-repeat
 */
(function (MK) {
  'use strict';
  var io = null;

  function finish(el) {
    el.classList.add('mk-done');
    MK.emit(el, 'revealed');
  }

  function play(list) {
    var groups = new Map();
    list.forEach(function (el) {
      var parent = el.parentElement && el.parentElement.closest('[data-motion-stagger]');
      var key = parent || el;
      if (!groups.has(key)) groups.set(key, { step: parent ? MK.num(parent, 'data-motion-stagger', 90) : 0, els: [] });
      groups.get(key).els.push(el);
    });
    groups.forEach(function (g) {
      var els = g.els;
      // keep the whole group's stagger under ~1s so long grids don't feel slow
      var step = els.length > 1 ? Math.min(g.step, 1000 / (els.length - 1)) : 0;
      els.sort(function (a, b) {
        return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
      });
      els.forEach(function (el, i) {
        var delay = MK.ms(el, 'data-motion-delay', 0) + i * step;
        el.style.setProperty('--mk-delay', delay + 'ms');
        el.classList.remove('mk-done');
        el.classList.add('mk-in');
        var dur = MK.ms(el, 'data-motion-duration', 900);
        clearTimeout(el.__mkRevealT);
        el.__mkRevealT = setTimeout(function () { finish(el); }, delay + dur + 150);
      });
    });
  }

  function getIO() {
    if (io) return io;
    io = new IntersectionObserver(function (entries) {
      var entering = [];
      entries.forEach(function (e) {
        var el = e.target;
        if (e.isIntersecting) {
          if (!el.classList.contains('mk-in')) entering.push(el);
          if (!el.hasAttribute('data-motion-repeat')) io.unobserve(el);
        } else if (el.hasAttribute('data-motion-repeat') && el.classList.contains('mk-in')) {
          clearTimeout(el.__mkRevealT);
          el.classList.remove('mk-in', 'mk-done');
        }
      });
      if (entering.length) MK.whenReady(function () { play(entering); });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });
    return io;
  }

  function setup(el) {
    if (MK.reduced) { el.classList.add('mk-in', 'mk-done'); return; }
    var dur = MK.ms(el, 'data-motion-duration', 0);
    if (dur) el.style.setProperty('--mk-dur', dur + 'ms');
    var dist = el.getAttribute('data-motion-distance');
    if (dist) el.style.setProperty('--mk-dist', /^[0-9.]+$/.test(dist) ? dist + 'px' : dist);
    var ease = MK.ease(el.getAttribute('data-motion-ease'));
    if (ease) el.style.setProperty('--mk-ease', ease);
    el.addEventListener('animationend', function (e) {
      if (e.target === el && el.classList.contains('mk-in')) { clearTimeout(el.__mkRevealT); finish(el); }
    });
    getIO().observe(el);
    return function () { if (io) io.unobserve(el); clearTimeout(el.__mkRevealT); };
  }

  MK.register({
    name: 'reveal',
    selector: '[data-motion],[data-motion-children]',
    init: function (el) {
      var cleanups = [];
      if (el.hasAttribute('data-motion-children')) {
        var preset = el.getAttribute('data-motion-children') || 'fade-up';
        if (!el.hasAttribute('data-motion-stagger')) el.setAttribute('data-motion-stagger', '90');
        Array.prototype.forEach.call(el.children, function (child) {
          if (!child.hasAttribute('data-motion')) child.setAttribute('data-motion', preset);
          MK.initEl('reveal', child);
        });
      }
      if (el.hasAttribute('data-motion')) {
        var c = setup(el);
        if (c) cleanups.push(c);
      }
      return function () { cleanups.forEach(function (f) { f(); }); };
    }
  });
})(window.MotionKit);
