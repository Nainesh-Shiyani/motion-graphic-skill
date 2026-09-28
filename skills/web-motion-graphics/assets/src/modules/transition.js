/* Motion Kit - transition: animated page-to-page navigation for multi-page sites
 *   <body data-transition="curtain">     fade | curtain | slide | columns | view
 *   "view" uses the browser's native cross-document View Transitions (Chrome/Edge/Safari 18+).
 * Same-site links animate out, the next page animates in. Opt a link out with data-no-transition.
 * Color the overlay with --mk-pt-bg.
 */
(function (MK) {
  'use strict';
  var d = document, root = d.documentElement, KEY = 'mk-pt';

  // sessionStorage is blocked on file:// pages and in some sandboxes, so window.name is the fallback flag
  var NAME_RE = /(^|\|)mk-pt$/;
  function store(v) {
    try { if (v) sessionStorage.setItem(KEY, v); else sessionStorage.removeItem(KEY); } catch (e) {}
    try {
      var n = (window.name || '').replace(NAME_RE, '');
      window.name = v ? (n ? n + '|' : '') + 'mk-pt' : n;
    } catch (e) {}
  }
  function stored() {
    var v = null;
    try { v = sessionStorage.getItem(KEY); } catch (e) {}
    return v || (NAME_RE.test(window.name || '') ? '1' : null);
  }

  MK.register({
    name: 'transition',
    selector: '[data-transition]',
    init: function (el) {
      if (el !== d.body && el !== root) return;
      var type = MK.attr(el, 'data-transition', 'fade');
      if (MK.reduced) { root.classList.remove('mk-pt-in'); store(null); return; }

      if (type === 'view') {
        var st = d.createElement('style');
        st.textContent = '@view-transition{navigation:auto}' +
          '::view-transition-old(root){animation:mk-vt-out .45s cubic-bezier(.65,0,.35,1) both}' +
          '::view-transition-new(root){animation:mk-vt-in .6s cubic-bezier(.16,1,.3,1) both}' +
          '@keyframes mk-vt-out{to{opacity:0;translate:0 -24px}}@keyframes mk-vt-in{from{opacity:0;translate:0 32px}}';
        d.head.appendChild(st);
        return;
      }

      var ov = d.createElement('div');
      ov.className = 'mk-pt mk-internal mk-pt--' + type;
      ov.setAttribute('aria-hidden', 'true');
      if (type === 'columns') for (var ci = 0; ci < 5; ci++) { var bar = d.createElement('i'); bar.style.setProperty('--i', ci); ov.appendChild(bar); }
      d.body.appendChild(ov);

      // entering: if the previous page animated out, start covered and reveal
      if (stored() || root.classList.contains('mk-pt-in')) {
        ov.classList.add('mk-pt-cover');
        root.classList.remove('mk-pt-in');
        store(null);
        MK.hold();
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            ov.classList.remove('mk-pt-cover');
            ov.classList.add('mk-pt-reveal');
            setTimeout(function () { MK.release(); }, 250);
            setTimeout(function () { ov.classList.remove('mk-pt-reveal'); }, 1250);
          });
        });
      }

      function onClick(e) {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        var a = e.target.closest && e.target.closest('a[href]');
        if (!a || a.hasAttribute('download') || a.hasAttribute('data-no-transition')) return;
        if (a.target && a.target !== '_self') return;
        var url;
        try { url = new URL(a.href, location.href); } catch (err) { return; }
        if (url.origin !== location.origin || !/^(https?|file):$/.test(url.protocol)) return;
        if (url.pathname === location.pathname && url.search === location.search) return; // same page / #hash
        e.preventDefault();
        store('1');
        ov.classList.remove('mk-pt-reveal');
        ov.classList.add('mk-pt-leave');
        setTimeout(function () { location.href = url.href; }, type === 'fade' ? 350 : type === 'columns' ? 900 : 650);
      }
      function onShow(e) {
        if (e.persisted) { ov.classList.remove('mk-pt-leave', 'mk-pt-cover'); store(null); }
      }
      d.addEventListener('click', onClick);
      window.addEventListener('pageshow', onShow);
      return function () {
        d.removeEventListener('click', onClick);
        window.removeEventListener('pageshow', onShow);
        ov.remove();
      };
    }
  });
})(window.MotionKit);
