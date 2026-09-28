/* Motion Kit - confetti: celebratory bursts
 *   <button data-confetti>Sign up</button>        burst from the element on click
 *   <div data-confetti="view">                     burst once when scrolled into view
 *   MotionKit.confetti({ x: 200, y: 300, count: 120, colors: ['#f00', '#0f0'] })   from JS
 *   <button data-burst>Like</button>               radial spark burst from the click point (small, snappy)
 *   MotionKit.burst({ x, y, count: 26, colors })   from JS
 * Colors default to data-confetti-colors="#a,#b" or --mk-c1..3.
 */
(function (MK) {
  'use strict';
  var d = document, canvas = null, ctx = null, parts = [], raf = 0, dpr = 1;

  function ensure() {
    if (canvas) return;
    canvas = d.createElement('canvas');
    canvas.className = 'mk-confetti mk-internal';
    canvas.setAttribute('aria-hidden', 'true');
    d.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    size();
    window.addEventListener('resize', size);
  }
  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
  }
  function frame() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    var h = window.innerHeight;
    parts = parts.filter(function (p) { return p.y < h + 40 && p.life > 0; });
    parts.forEach(function (p) {
      if (p.spark) {
        p.vx *= 0.9; p.vy *= 0.9; p.x += p.vx; p.y += p.vy; p.life -= 1;
        ctx.globalAlpha = Math.min(1, p.life / 18);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.s;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x - p.vx * 2.2, p.y - p.vy * 2.2); ctx.lineTo(p.x, p.y); ctx.stroke();
        return;
      }
      p.vx *= 0.985; p.vy = p.vy * 0.985 + 0.32;
      p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life -= 1;
      p.tilt += 0.1;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.min(1, p.life / 40);
      ctx.fillStyle = p.color;
      if (p.shape === 0) ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2 * Math.abs(Math.cos(p.tilt)) + 1);
      else { ctx.beginPath(); ctx.arc(0, 0, p.s / 3, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    });
    if (parts.length) raf = requestAnimationFrame(frame);
    else { raf = 0; ctx.clearRect(0, 0, canvas.width, canvas.height); }
  }

  MK.confetti = function (o) {
    if (MK.reduced) return;
    o = o || {};
    ensure();
    var colors = o.colors || ['#8b5cf6', '#06b6d4', '#f472b6', '#facc15', '#22c55e'];
    var n = o.count || 110, spread = (o.spread || 70) * Math.PI / 180;
    var x = o.x != null ? o.x : window.innerWidth / 2, y = o.y != null ? o.y : window.innerHeight / 2;
    for (var i = 0; i < n; i++) {
      var ang = -Math.PI / 2 + (Math.random() - 0.5) * spread * 2;
      var sp = 7 + Math.random() * 9 * (o.power || 1);
      parts.push({
        x: x, y: y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.3, tilt: Math.random() * 6,
        s: 7 + Math.random() * 7, color: colors[i % colors.length], shape: Math.random() < 0.7 ? 0 : 1,
        life: 160 + Math.random() * 60
      });
    }
    if (!raf) raf = requestAnimationFrame(frame);
  };

  MK.burst = function (o) {
    if (MK.reduced) return;
    o = o || {};
    ensure();
    var colors = o.colors || ['#8b5cf6', '#06b6d4', '#f472b6'];
    var n = o.count || 26;
    for (var i = 0; i < n; i++) {
      var ang = (i / n) * Math.PI * 2 + Math.random() * 0.3, sp = 5 + Math.random() * 7 * (o.power || 1);
      parts.push({ spark: true, x: o.x, y: o.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, s: 1.5 + Math.random() * 2,
        color: colors[i % colors.length], life: 26 + Math.random() * 16 });
    }
    if (!raf) raf = requestAnimationFrame(frame);
  };

  MK.register({
    name: 'burst',
    selector: '[data-burst]',
    init: function (el) {
      function go(e) {
        var r = el.getBoundingClientRect();
        var x = e && e.clientX ? e.clientX : r.left + r.width / 2, y = e && e.clientY ? e.clientY : r.top + r.height / 2;
        MK.burst({ x: x, y: y, colors: MK.colors(el, 'data-burst-colors').concat(['#ffffff']) });
      }
      el.addEventListener('click', go);
      return function () { el.removeEventListener('click', go); };
    }
  });

  MK.register({
    name: 'confetti',
    selector: '[data-confetti]',
    init: function (el) {
      function burst() {
        var r = el.getBoundingClientRect();
        var colors = MK.colors(el, 'data-confetti-colors');
        if (!el.hasAttribute('data-confetti-colors')) colors = colors.concat(['#facc15', '#ffffff']);
        MK.confetti({ x: r.left + r.width / 2, y: r.top + r.height / 2, colors: colors });
      }
      if (el.getAttribute('data-confetti') === 'view') return MK.onEnter(el, burst, { rootMargin: '0px 0px -30% 0px' });
      el.addEventListener('click', burst);
      return function () { el.removeEventListener('click', burst); };
    }
  });
})(window.MotionKit);
