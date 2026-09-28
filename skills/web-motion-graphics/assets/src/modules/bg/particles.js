/* bg: particles - drifting dots joined by lines, reacts to the cursor.
 * Options: data-bg-density="1" data-bg-speed="1" data-bg-link="130" data-bg-interact="grab|repel|none" */
(function (MK) {
  'use strict';
  MK.defineBg('particles', {
    canvas: true,
    create: function (env) {
      var pts = [];
      var link = env.opt('link', 130), speed = env.opt('speed', 1), density = env.opt('density', 1);
      var mode = env.str('interact', 'grab');
      function resize(w, h) {
        var n = Math.round(MK.clamp(w * h / 11000, 24, 150) * density);
        while (pts.length < n) {
          pts.push({
            x: Math.random() * w, y: Math.random() * h,
            vx: (Math.random() - 0.5) * 0.45, vy: (Math.random() - 0.5) * 0.45,
            r: 1 + Math.random() * 1.8, c: env.colors[pts.length % env.colors.length]
          });
        }
        pts.length = n;
        pts.forEach(function (p) { if (p.x > w) p.x = Math.random() * w; if (p.y > h) p.y = Math.random() * h; });
      }
      function frame(t, dt) {
        var ctx = env.ctx, w = env.w, h = env.h, k = (dt / 16) * speed, P = env.pointer;
        ctx.clearRect(0, 0, w, h);
        var i, j, p, q, dx, dy, dd;
        for (i = 0; i < pts.length; i++) {
          p = pts[i];
          p.x += p.vx * k; p.y += p.vy * k;
          if (p.x < 0) { p.x = 0; p.vx *= -1; } else if (p.x > w) { p.x = w; p.vx *= -1; }
          if (p.y < 0) { p.y = 0; p.vy *= -1; } else if (p.y > h) { p.y = h; p.vy *= -1; }
          if (P.active && mode !== 'none') {
            dx = p.x - P.x; dy = p.y - P.y; dd = Math.sqrt(dx * dx + dy * dy);
            if (dd < 160 && dd > 0.1) {
              var f = (1 - dd / 160) * (mode === 'repel' ? 2.2 : -0.35) * k;
              p.x += (dx / dd) * f; p.y += (dy / dd) * f;
            }
          }
        }
        ctx.lineWidth = 1;
        var L2 = link * link;
        for (i = 0; i < pts.length; i++) {
          p = pts[i];
          for (j = i + 1; j < pts.length; j++) {
            q = pts[j];
            dx = p.x - q.x; dy = p.y - q.y; dd = dx * dx + dy * dy;
            if (dd < L2) {
              ctx.globalAlpha = (1 - Math.sqrt(dd) / link) * 0.35;
              ctx.strokeStyle = p.c;
              ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
            }
          }
          if (P.active && mode === 'grab') {
            dx = p.x - P.x; dy = p.y - P.y; dd = Math.sqrt(dx * dx + dy * dy);
            if (dd < 190) {
              ctx.globalAlpha = (1 - dd / 190) * 0.6;
              ctx.strokeStyle = p.c;
              ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(P.x, P.y); ctx.stroke();
            }
          }
        }
        ctx.globalAlpha = 0.9;
        for (i = 0; i < pts.length; i++) {
          p = pts[i];
          ctx.fillStyle = p.c;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      return { resize: resize, frame: frame };
    }
  });
})(window.MotionKit);
