/* Motion Kit - text add-on: rotate
 *   data-text="rotate" data-words="a|b|c"  cycles words with a vertical slide (width animates)
 *   Options: data-text-interval="2200"
 */
(function (MK) {
  'use strict';
  var d = document;
  var U = MK.textUtil, span = U.span, addSr = U.addSr, words = U.words;
  function rotate(el) {
    var list = words(el);
    if (!list.length) { MK.warn('data-text="rotate" needs data-words="a|b|c"', el); return; }
    var interval = MK.ms(el, 'data-text-interval', 2200);
    el.textContent = '';
    addSr(el, list.join(', '));
    var box = span('mk-rot');
    box.setAttribute('aria-hidden', 'true');
    var cur = span('mk-rot-word', list[0]);
    box.appendChild(cur);
    el.appendChild(box);
    if (MK.reduced || list.length < 2) return;

    var i = 0, timer = 0, busy = false;
    var ease = 'cubic-bezier(.16,1,.3,1)';
    function next() {
      if (busy || d.hidden) return;
      busy = true;
      i = (i + 1) % list.length;
      var nxt = span('mk-rot-word mk-rot-next', list[i]);
      box.appendChild(nxt);
      var fromW = box.getBoundingClientRect().width;
      var toW = nxt.getBoundingClientRect().width;
      var opts = { duration: 650, easing: ease, fill: 'forwards' };
      box.animate([{ width: fromW + 'px' }, { width: toW + 'px' }], { duration: 650, easing: ease });
      cur.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-105%)', opacity: 0 }], opts);
      var a = nxt.animate([{ transform: 'translateY(105%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], opts);
      a.onfinish = function () {
        cur.remove();
        nxt.classList.remove('mk-rot-next');
        a.cancel();
        cur = nxt;
        busy = false;
      };
    }
    var offView = MK.inView(el, function (v) {
      clearInterval(timer);
      if (v) timer = setInterval(next, interval);
    });
    return function () { offView(); clearInterval(timer); };
  }

  MK.textModes.rotate = rotate;
})(window.MotionKit);
