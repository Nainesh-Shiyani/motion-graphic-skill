/* Motion Kit - text add-on: typewriter
 *   data-text="typewriter"  types the text; data-words="a|b|c" types, deletes and cycles words
 *   Options: data-text-speed="60" data-text-pause="1600" data-text-delay data-text-loop data-text-nocaret
 */
(function (MK) {
  'use strict';
  var d = document;
  var U = MK.textUtil, span = U.span, addSr = U.addSr, words = U.words;
  function typewriter(el) {
    var list = words(el);
    if (!list.length) list = [el.textContent.replace(/\s+/g, ' ').trim()];
    var loop = list.length > 1 || el.hasAttribute('data-text-loop');
    var speed = MK.ms(el, 'data-text-speed', 60);
    var pause = MK.ms(el, 'data-text-pause', 1600);
    el.textContent = '';
    addSr(el, list.join(', '));
    var out = span('mk-tw');
    out.setAttribute('aria-hidden', 'true');
    var caret = span('mk-caret');
    caret.setAttribute('aria-hidden', 'true');
    el.appendChild(out);
    if (!el.hasAttribute('data-text-nocaret')) el.appendChild(caret);
    if (MK.reduced) { out.textContent = list[0]; return; }

    var wi = 0, ci = 0, deleting = false, timer = 0;
    function step() {
      var word = list[wi];
      if (!deleting) {
        ci++;
        out.textContent = word.slice(0, ci);
        if (ci >= word.length) {
          if (!loop) { el.classList.add('mk-typed'); MK.emit(el, 'text'); return; }
          deleting = true;
          timer = setTimeout(step, pause);
          return;
        }
        timer = setTimeout(step, speed * (0.6 + Math.random() * 0.8));
      } else {
        ci--;
        out.textContent = word.slice(0, ci);
        if (ci <= 0) {
          deleting = false;
          wi = (wi + 1) % list.length;
          timer = setTimeout(step, 380);
          return;
        }
        timer = setTimeout(step, speed * 0.45);
      }
    }
    var off = MK.onEnter(el, function () { timer = setTimeout(step, MK.ms(el, 'data-text-delay', 250)); });
    return function () { off(); clearTimeout(timer); };
  }

  MK.textModes.typewriter = typewriter;
})(window.MotionKit);
