/* Motion Kit - circle-text: rotating circular text badge ("SCROLL DOWN * SCROLL DOWN *")
 *   <a class="badge" href="#work" data-circle-text="Scroll to explore * ">↓</a>
 * The text is laid out around a circle that fills the element (give it a width/height, e.g. 130px),
 * rotates slowly, spins faster while scrolling and on hover. Existing children stay centered.
 * Options: data-circle-speed="1" (turns per ~20s)  data-circle-size="0.11" (font size relative to diameter)
 */
(function (MK) {
  'use strict';
  var d = document, NS = 'http://www.w3.org/2000/svg', uid = 0;

  MK.register({
    name: 'circle-text',
    selector: '[data-circle-text]',
    init: function (el) {
      var text = el.getAttribute('data-circle-text') || el.textContent.trim();
      if (!text) return;
      el.classList.add('mk-circle');
      if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', text.replace(/\s*[*•·]\s*/g, ' ').trim());
      var id = 'mk-circle-path-' + (++uid);
      var svg = d.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 200 200');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('class', 'mk-circle-svg mk-internal');
      var path = d.createElementNS(NS, 'path');
      path.setAttribute('id', id);
      path.setAttribute('d', 'M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0');
      path.setAttribute('fill', 'none');
      var t = d.createElementNS(NS, 'text');
      t.setAttribute('font-size', String(200 * MK.num(el, 'data-circle-size', 0.11)));
      var tp = d.createElementNS(NS, 'textPath');
      tp.setAttribute('href', '#' + id);
      tp.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#' + id);
      tp.setAttribute('textLength', String(Math.floor(2 * Math.PI * 78) - 2));
      tp.setAttribute('lengthAdjust', 'spacing');
      tp.textContent = text;
      t.appendChild(tp);
      svg.appendChild(path);
      svg.appendChild(t);
      el.insertBefore(svg, el.firstChild);
      if (MK.reduced) return;
      var rot = 0, boost = 0, hover = false, lastY = window.pageYOffset;
      var base = MK.num(el, 'data-circle-speed', 1) * 18; // deg per second
      function enter() { hover = true; }
      function leave() { hover = false; }
      el.addEventListener('pointerenter', enter);
      el.addEventListener('pointerleave', leave);
      var stop = MK.ticker(el, function (now, dt) {
        var y = window.pageYOffset, v = Math.abs(y - lastY);
        lastY = y;
        boost = MK.lerp(boost, Math.min(v * 6, 360) + (hover ? 140 : 0), 0.08);
        rot = (rot + (base + boost) * (dt / 1000)) % 360;
        svg.style.rotate = rot.toFixed(2) + 'deg';
      });
      return function () { stop(); el.removeEventListener('pointerenter', enter); el.removeEventListener('pointerleave', leave); svg.remove(); };
    }
  });
})(window.MotionKit);
