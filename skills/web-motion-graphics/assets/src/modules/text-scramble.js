/* Motion Kit - text add-on: scramble
 *   data-text="scramble"  decoding / hacker effect; data-text-trigger="hover" replays on hover (nav links)
 *   Options: data-text-chars, data-text-duration, data-text-delay
 */
(function (MK) {
  'use strict';
  var d = document;
  var U = MK.textUtil, span = U.span, addSr = U.addSr, words = U.words;
  function scramble(el) {
    var glyphs = MK.attr(el, 'data-text-chars', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=?!<>');
    var original = el.textContent.replace(/\s+/g, ' ').trim();
    if (!el.querySelector(':scope > .mk-scr')) {
      var holder = span('mk-scr');
      holder.setAttribute('aria-hidden', 'true');
      while (el.firstChild) holder.appendChild(el.firstChild);
      el.appendChild(holder);
      addSr(el, original);
    }
    var nodes = [];
    var walker = d.createTreeWalker(el.querySelector(':scope > .mk-scr'), NodeFilter.SHOW_TEXT);
    var n;
    while ((n = walker.nextNode())) if (n.nodeValue.trim()) nodes.push({ n: n, orig: n.nodeValue });
    var total = nodes.reduce(function (s, o) { return s + o.orig.length; }, 0);
    var dur = MK.ms(el, 'data-text-duration', MK.clamp(total * 45, 700, 2200));
    var running = false, raf = 0;

    function run() {
      if (running || MK.reduced) return;
      running = true;
      var start = performance.now(), lastRand = 0, cache = [];
      function frame(now) {
        var p = MK.clamp((now - start) / dur, 0, 1);
        var resolved = Math.floor(MK.easeInOutCubic(p) * total);
        var reroll = now - lastRand > 50;
        if (reroll) lastRand = now;
        var k = 0;
        nodes.forEach(function (o) {
          var s = '';
          for (var i = 0; i < o.orig.length; i++, k++) {
            var ch = o.orig[i];
            if (k < resolved || /\s/.test(ch)) { s += ch; continue; }
            if (reroll || !cache[k]) cache[k] = glyphs[(Math.random() * glyphs.length) | 0];
            s += cache[k];
          }
          o.n.nodeValue = s;
        });
        if (p < 1) raf = requestAnimationFrame(frame);
        else { nodes.forEach(function (o) { o.n.nodeValue = o.orig; }); running = false; MK.emit(el, 'text'); }
      }
      raf = requestAnimationFrame(frame);
    }

    var trigger = MK.attr(el, 'data-text-trigger', 'view');
    var offs = [];
    if (trigger === 'hover') {
      el.addEventListener('pointerenter', run);
      el.addEventListener('focus', run);
      offs.push(function () { el.removeEventListener('pointerenter', run); el.removeEventListener('focus', run); });
    } else {
      offs.push(MK.onEnter(el, function () { setTimeout(run, MK.ms(el, 'data-text-delay', 0)); }));
    }
    return function () { offs.forEach(function (f) { f(); }); cancelAnimationFrame(raf); };
  }

  MK.textModes.scramble = scramble;
})(window.MotionKit);
