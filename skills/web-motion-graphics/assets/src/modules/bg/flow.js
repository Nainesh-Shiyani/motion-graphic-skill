/* bg: flow - generative art: thousands of particles drift through a noise flow field leaving silky trails;
 * the cursor stirs a vortex (creative studios, art, music, luxury on dark backgrounds).
 * Options: data-bg-density="1" data-bg-speed="1" data-bg-trail="0.06" (lower = longer trails) */
(function (MK) {
  'use strict';
  // small, fast value noise
  var perm = new Uint8Array(512);
  (function () { var p = []; for (var i = 0; i < 256; i++) p[i] = i; for (i = 255; i > 0; i--) { var j = (Math.random() * (i + 1)) | 0, t = p[i]; p[i] = p[j]; p[j] = t; } for (i = 0; i < 512; i++) perm[i] = p[i & 255]; })();
  function vnoise(x, y) {
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    xi &= 255; yi &= 255;
    var a = perm[perm[xi] + yi] / 255, b = perm[perm[xi + 1] + yi] / 255, c = perm[perm[xi] + yi + 1] / 255, d = perm[perm[xi + 1] + yi + 1] / 255;
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  MK.defineBg('flow', {
    canvas: true,
    create: function (env) {
      var density = env.opt('density', 1), speed = env.opt('speed', 1), trail = env.opt('trail', 0.06);
      var ps = [], cols = env.colors, sized = 0;
      function spawn(p, w, h) {
        p.x = Math.random() * w; p.y = Math.random() * h; p.age = 0; p.life = 120 + Math.random() * 220;
        p.c = (Math.random() * cols.length) | 0;
        return p;
      }
      function resize(w, h) {
        var n = Math.round(MK.clamp(w * h / 700, 400, 2400) * density);
        ps = [];
        for (var i = 0; i < n; i++) spawn(ps[i] = {}, w, h).age = Math.random() * 200;
        sized = w * h;
        env.ctx.clearRect(0, 0, w, h);
      }
      function step(t, k, ctx) {
        var w = env.w, h = env.h, P = env.pointer, z = t * 0.00004;
        for (var ci = 0; ci < cols.length; ci++) {
          ctx.strokeStyle = cols[ci];
          ctx.beginPath();
          for (var i = ci; i < ps.length; i += cols.length) {
            var p = ps[i];
            var a = vnoise(p.x * 0.0028 + z, p.y * 0.0028 - z) * Math.PI * 4;
            var vx = Math.cos(a), vy = Math.sin(a);
            if (P.active) {
              var dx = p.x - P.x, dy = p.y - P.y, d2 = dx * dx + dy * dy;
              if (d2 < 32000) { var f = (1 - d2 / 32000) * 2.4; vx += (-dy / Math.sqrt(d2 + 1)) * f; vy += (dx / Math.sqrt(d2 + 1)) * f; }
            }
            var nx = p.x + vx * 1.6 * k, ny = p.y + vy * 1.6 * k;
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(nx, ny);
            p.x = nx; p.y = ny; p.age += k;
            if (p.age > p.life || nx < -5 || nx > w + 5 || ny < -5 || ny > h + 5) spawn(p, w, h);
          }
          ctx.stroke();
        }
      }
      function frame(t, dt) {
        var ctx = env.ctx, w = env.w, h = env.h;
        if (sized !== w * h) resize(w, h);
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0,0,0,' + trail + ')';
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'source-over';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.55;
        step(t, (dt / 16) * speed, ctx);
        ctx.globalAlpha = 1;
      }
      return {
        resize: resize,
        frame: frame,
        still: function () { for (var i = 0; i < 60; i++) frame(i * 16, 16); }
      };
    }
  });
})(window.MotionKit);
