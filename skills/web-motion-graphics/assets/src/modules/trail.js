/* Motion Kit - trail: cursor trails drawn on a full-screen canvas (desktop only)
 *   <body data-cursor-trail="glow">      a glowing neon ribbon that follows the cursor and fades
 *   <body data-cursor-trail="sparkle">   twinkling star sparkles spill from the cursor
 *   <body data-cursor-trail="comet">     a bright head with a long particle tail
 * Colors: --mk-c1..3. Put it on <body> (or any element: the trail is page-wide either way).
 */
(function (MK) {
  'use strict';
  var d = document;

  MK.register({
    name: 'trail',
    selector: '[data-cursor-trail]',
    init: function (el) {
      if (MK.reduced || !MK.finePointer || d.querySelector('.mk-trail')) return;
      var mode = MK.attr(el, 'data-cursor-trail', 'glow');
      var cols = MK.colors(el, 'data-trail-colors').map(function (c) { return MK.rgb(c).join(','); });
      var canvas = d.createElement('canvas');
      canvas.className = 'mk-trail mk-internal';
      canvas.setAttribute('aria-hidden', 'true');
      d.body.appendChild(canvas);
      var ctx = canvas.getContext('2d'), dpr = 1, W = 0, H = 0;
      function size() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = window.innerWidth; H = window.innerHeight;
        canvas.width = W * dpr; canvas.height = H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      size();
      window.addEventListener('resize', size);
      var pts = [], sparks = [], last = null, raf = 0, idle = 0;

      function onMove(e) {
        var now = performance.now();
        var p = { x: e.clientX, y: e.clientY, t: now };
        if (mode === 'glow') pts.push(p);
        else {
          var dist = last ? Math.hypot(p.x - last.x, p.y - last.y) : 0;
          var n = mode === 'comet' ? Math.min(6, 1 + dist / 6) : Math.min(4, dist / 10);
          for (var i = 0; i < n; i++) {
            var a = Math.random() * Math.PI * 2, sp = mode === 'comet' ? Math.random() * 0.6 : 0.4 + Math.random() * 1.6;
            sparks.push({
              x: p.x + (Math.random() - 0.5) * 6, y: p.y + (Math.random() - 0.5) * 6,
              vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + (mode === 'sparkle' ? 0.2 : 0),
              life: 1, decay: mode === 'comet' ? 0.018 + Math.random() * 0.02 : 0.012 + Math.random() * 0.02,
              s: mode === 'comet' ? 1.5 + Math.random() * 2.5 : 3 + Math.random() * 5, c: cols[(Math.random() * cols.length) | 0],
              r: Math.random() * Math.PI
            });
          }
        }
        last = p;
        idle = 0;
        if (!raf) raf = requestAnimationFrame(frame);
      }
      function star(x, y, s, rot) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rot);
        ctx.beginPath();
        for (var i = 0; i < 4; i++) {
          ctx.lineTo(0, -s);
          ctx.rotate(Math.PI / 4);
          ctx.lineTo(0, -s * 0.28);
          ctx.rotate(Math.PI / 4);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      function frame() {
        raf = 0;
        ctx.clearRect(0, 0, W, H);
        var now = performance.now();
        if (mode === 'glow') {
          while (pts.length && now - pts[0].t > 420) pts.shift();
          if (pts.length > 1) {
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalCompositeOperation = 'lighter';
            for (var i = 1; i < pts.length; i++) {
              var a = pts[i - 1], b = pts[i], k = i / pts.length;
              var c = cols[Math.min(cols.length - 1, Math.floor(k * cols.length))];
              ctx.strokeStyle = 'rgba(' + c + ',' + (k * 0.9).toFixed(3) + ')';
              ctx.lineWidth = 1 + k * 9;
              ctx.shadowColor = 'rgba(' + c + ',0.9)';
              ctx.shadowBlur = 14 * k;
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.stroke();
            }
            ctx.shadowBlur = 0;
            ctx.globalCompositeOperation = 'source-over';
          }
          if (pts.length) raf = requestAnimationFrame(frame);
        } else {
          ctx.globalCompositeOperation = 'lighter';
          for (var j = sparks.length - 1; j >= 0; j--) {
            var s = sparks[j];
            s.x += s.vx; s.y += s.vy; s.vy += mode === 'sparkle' ? 0.03 : 0; s.life -= s.decay; s.r += 0.05;
            if (s.life <= 0) { sparks.splice(j, 1); continue; }
            ctx.fillStyle = 'rgba(' + s.c + ',' + s.life.toFixed(3) + ')';
            if (mode === 'sparkle') star(s.x, s.y, s.s * s.life, s.r);
            else { ctx.beginPath(); ctx.arc(s.x, s.y, s.s * s.life, 0, 6.2832); ctx.fill(); }
          }
          if (mode === 'comet' && last && now - last.t < 120) {
            var g = ctx.createRadialGradient(last.x, last.y, 0, last.x, last.y, 16);
            g.addColorStop(0, 'rgba(255,255,255,0.95)');
            g.addColorStop(1, 'rgba(' + cols[0] + ',0)');
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(last.x, last.y, 16, 0, 6.2832); ctx.fill();
          }
          ctx.globalCompositeOperation = 'source-over';
          if (sparks.length) raf = requestAnimationFrame(frame);
        }
      }
      d.addEventListener('pointermove', onMove, { passive: true });
      return function () {
        d.removeEventListener('pointermove', onMove);
        window.removeEventListener('resize', size);
        cancelAnimationFrame(raf);
        canvas.remove();
      };
    }
  });
})(window.MotionKit);
