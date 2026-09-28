/* Motion Kit - spotlight
 *   data-spotlight           glow + glowing border that follows the cursor inside a card
 *   data-spotlight="group"   same, across every child card of a grid (Linear / Vercel style)
 *   Tint with --mk-spot (glow) and --mk-spot-border (border glow).
 */
(function (MK) {
  'use strict';
  var d = document;

  function addSpot(card) {
    if (card.querySelector(':scope > .mk-spot')) return;
    MK.ensurePositioned(card);
    var fill = d.createElement('mk-span');
    fill.className = 'mk-spot mk-internal';
    var ring = d.createElement('mk-span');
    ring.className = 'mk-spot-border mk-internal';
    fill.setAttribute('aria-hidden', 'true');
    ring.setAttribute('aria-hidden', 'true');
    card.appendChild(fill);
    card.appendChild(ring);
    card.classList.add('mk-spot-host');
  }

  MK.register({
    name: 'spotlight',
    selector: '[data-spotlight]',
    init: function (el) {
      var group = el.getAttribute('data-spotlight') === 'group';
      var cards = group ? Array.prototype.slice.call(el.children) : [el];
      cards.forEach(addSpot);
      if (group) el.classList.add('mk-spot-group');
      if (!MK.finePointer) return;
      function move(e) {
        cards.forEach(function (c) {
          var r = c.getBoundingClientRect();
          c.style.setProperty('--mk-mx', (e.clientX - r.left).toFixed(1) + 'px');
          c.style.setProperty('--mk-my', (e.clientY - r.top).toFixed(1) + 'px');
        });
      }
      function enter() { el.classList.add('mk-spot-on'); }
      function leave() { el.classList.remove('mk-spot-on'); }
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerenter', enter);
      el.addEventListener('pointerleave', leave);
      return function () {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerenter', enter);
        el.removeEventListener('pointerleave', leave);
      };
    }
  });
})(window.MotionKit);
