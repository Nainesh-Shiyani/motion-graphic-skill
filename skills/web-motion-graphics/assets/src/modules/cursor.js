/* Motion Kit - cursor: custom cursor follower (desktop only, hidden on touch)
 *   <body data-cursor>            a soft ring trails the native cursor
 *   <body data-cursor="dot">      replaces the native cursor with dot + ring
 *   <body data-cursor="blend">    big circle with mix-blend-mode: difference (inverts what it covers)
 *   <body data-cursor="blob">     liquid "gooey" blob that stretches as it follows the cursor
 *   data-cursor-text="View"       on any element: the ring grows and shows this label on hover
 *   data-cursor-hover             on any element: extra hover target (links/buttons are automatic)
 * Color with --mk-cursor (default: var(--mk-accent)).
 */
(function (MK) {
  'use strict';
  var d = document;
  var HOVER = 'a,button,[role="button"],input,textarea,select,label,summary,[data-cursor-hover],[data-cursor-text],[data-magnetic]';

  MK.register({
    name: 'cursor',
    selector: '[data-cursor]',
    init: function (el) {
      if (MK.reduced || !MK.finePointer || d.querySelector('.mk-cursor')) return;
      var mode = MK.attr(el, 'data-cursor', 'ring');
      var wrap = d.createElement('div');
      wrap.className = 'mk-cursor mk-internal mk-cursor--' + mode;
      wrap.setAttribute('aria-hidden', 'true');
      var ring = d.createElement('div');
      ring.className = 'mk-cursor-ring';
      var label = d.createElement('mk-span');
      label.className = 'mk-cursor-label';
      ring.appendChild(label);
      var dot = d.createElement('div');
      dot.className = 'mk-cursor-dot';
      wrap.appendChild(ring);
      wrap.appendChild(dot);
      // "blob": a chain of circles merged by an SVG goo filter into one liquid cursor
      var blobs = [];
      if (mode === 'blob') {
        var gid = 'mk-goo-' + Math.random().toString(36).slice(2, 7);
        var fx = d.createElementNS('http://www.w3.org/2000/svg', 'svg');
        fx.setAttribute('width', '0'); fx.setAttribute('height', '0');
        fx.style.position = 'absolute';
        fx.innerHTML = '<filter id="' + gid + '"><feGaussianBlur in="SourceGraphic" stdDeviation="9" result="b"/>' +
          '<feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9"/></filter>';
        wrap.appendChild(fx);
        var goo = d.createElement('div');
        goo.className = 'mk-cursor-goo';
        goo.style.filter = 'url(#' + gid + ')';
        for (var bi = 0; bi < 6; bi++) {
          var bl = d.createElement('div');
          bl.className = 'mk-cursor-blob';
          bl.style.setProperty('--s', (1 - bi * 0.12).toFixed(2));
          goo.appendChild(bl);
          blobs.push({ el: bl, x: -100, y: -100 });
        }
        wrap.appendChild(goo);
      }
      d.body.appendChild(wrap);
      if (mode === 'dot' || mode === 'blob') d.documentElement.classList.add('mk-cursor-none');

      var pos = { x: -100, y: -100 }, ringPos = { x: -100, y: -100 }, raf = 0, seen = false;
      function loop() {
        ringPos.x = MK.lerp(ringPos.x, pos.x, 0.2);
        ringPos.y = MK.lerp(ringPos.y, pos.y, 0.2);
        ring.style.transform = 'translate3d(' + ringPos.x.toFixed(1) + 'px,' + ringPos.y.toFixed(1) + 'px,0)';
        dot.style.transform = 'translate3d(' + pos.x + 'px,' + pos.y + 'px,0)';
        var moving = Math.abs(ringPos.x - pos.x) > 0.1 || Math.abs(ringPos.y - pos.y) > 0.1;
        for (var i = 0; i < blobs.length; i++) {
          var b = blobs[i], lead = i ? blobs[i - 1] : pos, k = i ? 0.35 : 0.5;
          b.x = MK.lerp(b.x, lead.x, k); b.y = MK.lerp(b.y, lead.y, k);
          b.el.style.transform = 'translate3d(' + b.x.toFixed(1) + 'px,' + b.y.toFixed(1) + 'px,0)';
          if (Math.abs(b.x - pos.x) > 0.2 || Math.abs(b.y - pos.y) > 0.2) moving = true;
        }
        if (moving) raf = requestAnimationFrame(loop);
        else raf = 0;
      }
      function move(e) {
        pos.x = e.clientX; pos.y = e.clientY;
        if (!seen) {
          seen = true; ringPos.x = pos.x; ringPos.y = pos.y;
          blobs.forEach(function (b) { b.x = pos.x; b.y = pos.y; });
        }
        wrap.classList.add('mk-visible');
        if (!raf) raf = requestAnimationFrame(loop);
      }
      function over(e) {
        var t = e.target.closest ? e.target.closest(HOVER) : null;
        wrap.classList.toggle('mk-hover', !!t);
        var txt = t && t.getAttribute('data-cursor-text');
        label.textContent = txt || '';
        wrap.classList.toggle('mk-has-label', !!txt);
      }
      function down() { wrap.classList.add('mk-press'); }
      function up() { wrap.classList.remove('mk-press'); }
      function out(e) { if (!e.relatedTarget) wrap.classList.remove('mk-visible'); }
      d.addEventListener('pointermove', move, { passive: true });
      d.addEventListener('pointerover', over);
      d.addEventListener('pointerdown', down);
      d.addEventListener('pointerup', up);
      d.addEventListener('pointerout', out);
      return function () {
        d.removeEventListener('pointermove', move);
        d.removeEventListener('pointerover', over);
        d.removeEventListener('pointerdown', down);
        d.removeEventListener('pointerup', up);
        d.removeEventListener('pointerout', out);
        d.documentElement.classList.remove('mk-cursor-none');
        wrap.remove();
      };
    }
  });
})(window.MotionKit);
