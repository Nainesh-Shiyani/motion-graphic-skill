/* Motion Kit - image-trail and hover-image: image effects that follow the cursor (agency / portfolio classics)
 *   <section data-image-trail="a.jpg|b.jpg|c.jpg">   moving the cursor over the section leaves a trail of images
 *        Options: data-image-trail-size="220" (px width) data-image-trail-gap="90" (px of movement per image)
 *   <ul data-hover-image> <li data-hover-image="p1.jpg">Project one</li> ... </ul>
 *        a floating preview follows the cursor, tilting with its speed and cross-fading between items.
 *        Options on the list: data-hover-image-size="320"
 * Desktop only. Images are decorative (alt=""); keep real content in the markup.
 */
(function (MK) {
  'use strict';
  var d = document;

  MK.register({
    name: 'image-trail',
    selector: '[data-image-trail]',
    init: function (el) {
      var list = (el.getAttribute('data-image-trail') || '').split('|').map(function (s) { return s.trim(); }).filter(Boolean);
      if (MK.reduced || !MK.finePointer || !list.length) return;
      MK.ensurePositioned(el);
      el.classList.add('mk-itrail-host');
      var layer = d.createElement('div');
      layer.className = 'mk-itrail mk-internal';
      layer.setAttribute('aria-hidden', 'true');
      el.insertBefore(layer, el.firstChild);
      var size = MK.num(el, 'data-image-trail-size', 220), gap = MK.num(el, 'data-image-trail-gap', 90);
      list.forEach(function (src) { var i = new Image(); i.src = src; }); // preload
      var lx = null, ly = null, idx = 0, z = 1;
      function move(e) {
        var r = el.getBoundingClientRect();
        var x = e.clientX - r.left, y = e.clientY - r.top;
        if (lx === null) { lx = x; ly = y; return; }
        if (Math.hypot(x - lx, y - ly) < gap) return;
        var dx = x - lx;
        lx = x; ly = y;
        var img = d.createElement('img');
        img.src = list[idx++ % list.length];
        img.alt = '';
        img.className = 'mk-itrail-img';
        img.style.width = size + 'px';
        img.style.left = x + 'px';
        img.style.top = y + 'px';
        img.style.zIndex = String(z++);
        img.style.setProperty('--mk-r', (MK.clamp(dx * 0.25, -14, 14)).toFixed(1) + 'deg');
        layer.appendChild(img);
        setTimeout(function () { img.classList.add('mk-out'); }, 650);
        setTimeout(function () { img.remove(); }, 1500);
      }
      function leave() { lx = ly = null; }
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerleave', leave);
      return function () { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); layer.remove(); };
    }
  });

  MK.register({
    name: 'hover-image',
    selector: '[data-hover-image=""]',
    init: function (list) {
      var items = Array.prototype.slice.call(list.querySelectorAll('[data-hover-image]')).filter(function (i) { return i !== list; });
      if (MK.reduced || !MK.finePointer || !items.length) return;
      var size = MK.num(list, 'data-hover-image-size', 320);
      var box = d.createElement('div');
      box.className = 'mk-hover-img mk-internal';
      box.setAttribute('aria-hidden', 'true');
      box.style.width = size + 'px';
      var a = d.createElement('img'), b = d.createElement('img');
      a.alt = b.alt = '';
      box.appendChild(a); box.appendChild(b);
      d.body.appendChild(box);
      items.forEach(function (i) { var im = new Image(); im.src = i.getAttribute('data-hover-image'); });
      var x = 0, y = 0, tx = 0, ty = 0, vx = 0, shown = false, front = a, raf = 0, current = null;
      function loop() {
        vx = MK.lerp(vx, tx - x, 0.2);
        x = MK.lerp(x, tx, 0.14); y = MK.lerp(y, ty, 0.14);
        box.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) translate(-50%,-50%) rotate(' +
          MK.clamp(vx * 0.12, -12, 12).toFixed(2) + 'deg)';
        if (shown || Math.abs(tx - x) > 0.5) raf = requestAnimationFrame(loop); else raf = 0;
      }
      function show(item) {
        var src = item.getAttribute('data-hover-image');
        if (current !== src) {
          var back = front === a ? b : a;
          back.src = src;
          back.classList.add('mk-on');
          front.classList.remove('mk-on');
          front = back;
          current = src;
        }
        if (!shown) { x = tx; y = ty; }
        shown = true;
        box.classList.add('mk-visible');
        if (!raf) raf = requestAnimationFrame(loop);
      }
      function over(e) {
        var item = e.target.closest && e.target.closest('[data-hover-image]');
        if (item && item !== list && list.contains(item)) show(item);
      }
      function move(e) { tx = e.clientX; ty = e.clientY; }
      function leave() { shown = false; box.classList.remove('mk-visible'); }
      list.addEventListener('pointerover', over);
      list.addEventListener('pointermove', move);
      list.addEventListener('pointerleave', leave);
      return function () {
        list.removeEventListener('pointerover', over);
        list.removeEventListener('pointermove', move);
        list.removeEventListener('pointerleave', leave);
        cancelAnimationFrame(raf);
        box.remove();
      };
    }
  });
})(window.MotionKit);
