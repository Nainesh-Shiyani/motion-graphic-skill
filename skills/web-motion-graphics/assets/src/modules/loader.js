/* Motion Kit - loader: intro screen that reveals the page (entrance animations wait for it)
 *   <div data-loader="curtain"> <span class="logo">BRAND</span> <span data-loader-count>0</span> </div>
 * Types: fade | curtain (slides up) | split (opens from the middle) | circle (shrinks to a dot) | columns (bars wipe up)
 * Options: data-loader-min="900" (ms it stays at least)  data-loader-max="5000" (failsafe)
 * The element is styled as a full-screen overlay; give it your own background/colors.
 * [data-loader-count] shows 0-100%.
 */
(function (MK) {
  'use strict';
  var root = document.documentElement;

  MK.register({
    name: 'loader',
    selector: '[data-loader]',
    init: function (el) {
      var type = MK.attr(el, 'data-loader', 'fade');
      el.classList.add('mk-loader', 'mk-loader--' + type);
      el.setAttribute('aria-hidden', 'true');
      if (type === 'columns' && !el.querySelector(':scope > .mk-loader-cols')) {
        var cols = document.createElement('div');
        cols.className = 'mk-loader-cols';
        for (var ci = 0; ci < 5; ci++) { var bar = document.createElement('i'); bar.style.setProperty('--i', ci); cols.appendChild(bar); }
        el.insertBefore(cols, el.firstChild);
      }
      var count = el.querySelector('[data-loader-count]');
      var minTime = MK.ms(el, 'data-loader-min', 900);
      var maxTime = MK.ms(el, 'data-loader-max', 5000);
      var t0 = performance.now();
      var loaded = document.readyState === 'complete';
      var p = 0, done = false, raf = 0;

      if (MK.reduced) { el.remove(); return; }
      MK.hold();
      root.classList.add('mk-loading');

      function onLoad() { loaded = true; }
      if (!loaded) window.addEventListener('load', onLoad);

      function finish() {
        if (done) return;
        done = true;
        cancelAnimationFrame(raf);
        if (count) count.textContent = '100';
        el.classList.add('mk-loader-out');
        var removed = false;
        function cleanup() {
          if (removed) return;
          removed = true;
          el.remove();
        }
        el.addEventListener('transitionend', function (e) { if (e.target === el) cleanup(); });
        setTimeout(cleanup, 1600);
        // start the page's entrance animations as the loader leaves
        setTimeout(function () {
          root.classList.remove('mk-loading');
          MK.release();
        }, type === 'fade' ? 150 : 350);
      }

      function frame() {
        var elapsed = performance.now() - t0;
        var target = loaded ? 1 : 0.86;
        p += (target - p) * (loaded ? 0.12 : 0.03);
        if (count) count.textContent = String(Math.min(100, Math.round(p * 100)));
        if ((loaded && p > 0.995 && elapsed >= minTime) || elapsed > maxTime) { finish(); return; }
        raf = requestAnimationFrame(frame);
      }
      raf = requestAnimationFrame(frame);
      setTimeout(finish, maxTime + 100);
      return function () { window.removeEventListener('load', onLoad); finish(); };
    }
  });
})(window.MotionKit);
