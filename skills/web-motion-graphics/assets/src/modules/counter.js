/* Motion Kit - counter: numbers that count up when scrolled into view
 *   <span data-count-to="12500" data-count-prefix="$" data-count-suffix="+">12,500</span>
 * Options: data-count-from="0" data-count-duration="2000" data-count-decimals="1"
 *          data-count-separator="," (use "" for none) data-count-delay="0"
 * Keep the final number as the element's text so it reads correctly without JavaScript.
 */
(function (MK) {
  'use strict';
  // data-count-style="odometer": every digit is a strip of 0-9 that rolls into place like a slot machine
  function odometer(el, text, dur) {
    el.setAttribute('aria-label', text);
    el.textContent = '';
    el.classList.add('mk-odo');
    var digits = text.replace(/\D/g, '').length, seen = 0, strips = [];
    Array.from(text).forEach(function (ch) {
      if (!/\d/.test(ch)) {
        var c = document.createElement('mk-span');
        c.className = 'mk-odo-c';
        c.setAttribute('aria-hidden', 'true');
        c.textContent = ch;
        el.appendChild(c);
        return;
      }
      var pos = seen++, cycles = 1 + Math.max(0, Math.min(3, digits - pos - 1));
      var box = document.createElement('mk-span');
      box.className = 'mk-odo-d';
      box.setAttribute('aria-hidden', 'true');
      var strip = document.createElement('mk-span');
      strip.className = 'mk-odo-s';
      var cells = cycles * 10 + (+ch) + 1;
      for (var i = 0; i < cells; i++) {
        var cell = document.createElement('mk-span');
        cell.textContent = String(i % 10);
        strip.appendChild(cell);
      }
      strip.style.setProperty('--mk-odo-dur', Math.round(dur * (0.55 + 0.45 * (pos + 1) / digits)) + 'ms');
      strip.style.setProperty('--mk-odo-to', String(cells - 1));
      box.appendChild(strip);
      el.appendChild(box);
      strips.push(strip);
    });
    return MK.onEnter(el, function () {
      setTimeout(function () {
        el.classList.add('mk-in');
        setTimeout(function () { MK.emit(el, 'counted'); }, dur);
      }, MK.ms(el, 'data-count-delay', 0));
    }, { rootMargin: '0px 0px -5% 0px' });
  }

  MK.register({
    name: 'counter',
    selector: '[data-count-to]',
    init: function (el) {
      var raw = el.getAttribute('data-count-to').replace(/[, _]/g, '');
      var to = parseFloat(raw);
      if (isNaN(to)) { MK.warn('data-count-to must be a number', el); return; }
      var from = MK.num(el, 'data-count-from', 0);
      var dur = MK.ms(el, 'data-count-duration', 2000);
      var dec = el.hasAttribute('data-count-decimals')
        ? MK.num(el, 'data-count-decimals', 0)
        : (raw.split('.')[1] || '').length;
      var sep = el.hasAttribute('data-count-separator') ? el.getAttribute('data-count-separator') : ',';
      var prefix = MK.attr(el, 'data-count-prefix', '');
      var suffix = MK.attr(el, 'data-count-suffix', '');

      function format(v) {
        var s = Math.abs(v).toFixed(dec);
        var parts = s.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, sep);
        return (v < 0 ? '-' : '') + prefix + parts.join('.') + suffix;
      }
      el.style.fontVariantNumeric = 'tabular-nums';
      if (MK.reduced) { el.textContent = format(to); return; }
      if (el.getAttribute('data-count-style') === 'odometer') return odometer(el, format(to), dur);
      el.textContent = format(from);

      var raf = 0;
      var off = MK.onEnter(el, function () {
        setTimeout(function () {
          var start = performance.now();
          (function frame(now) {
            var p = MK.clamp((now - start) / dur, 0, 1);
            el.textContent = format(from + (to - from) * MK.easeOutExpo(p));
            if (p < 1) raf = requestAnimationFrame(frame);
            else { el.textContent = format(to); MK.emit(el, 'counted'); }
          })(start);
        }, MK.ms(el, 'data-count-delay', 0));
      }, { rootMargin: '0px 0px -5% 0px' });
      return function () { off(); cancelAnimationFrame(raf); };
    }
  });
})(window.MotionKit);
