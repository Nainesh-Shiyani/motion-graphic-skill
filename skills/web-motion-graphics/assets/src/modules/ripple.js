/* Motion Kit - ripple
 *   data-ripple   material-style click ripple (works on touch too)
 */
(function (MK) {
  'use strict';
  var d = document;

  MK.register({
    name: 'ripple',
    selector: '[data-ripple]',
    init: function (el) {
      MK.ensurePositioned(el);
      el.classList.add('mk-ripple-host');
      function down(e) {
        if (MK.reduced) return;
        var r = el.getBoundingClientRect();
        var size = Math.max(r.width, r.height) * 2.2;
        var s = d.createElement('mk-span');
        s.className = 'mk-ripple mk-internal';
        s.style.width = s.style.height = size + 'px';
        s.style.left = (e.clientX - r.left - size / 2) + 'px';
        s.style.top = (e.clientY - r.top - size / 2) + 'px';
        el.appendChild(s);
        s.addEventListener('animationend', function () { s.remove(); });
        setTimeout(function () { s.remove(); }, 1200);
      }
      el.addEventListener('pointerdown', down);
      return function () { el.removeEventListener('pointerdown', down); };
    }
  });
})(window.MotionKit);
