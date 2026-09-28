/* bg: warp - a glowing grid that bends like spacetime around the cursor (gravity well) and ripples
 * gently when idle (tech, science, fintech, dev tools).
 * Options: data-bg-gap="38" (px between lines) data-bg-strength="1" data-bg-repel (push instead of pull) */
(function (MK) {
  'use strict';
  MK.defineBg('warp', {
    canvas: true,
    create: function (env) {
      var gap = env.opt('gap', 38), strength = env.opt('strength', 1), sign = env.el.hasAttribute('data-bg-repel') ? -1 : 1;
      var mx = -9999, my = -9999, amt = 0;
      function frame(t) {
        var ctx = env.ctx, w = env.w, h = env.h, P = env.pointer;
        // idle: a slow autopilot 'star' drifts across so the grid is always alive
        var tx = P.active ? P.x : w * (0.5 + 0.34 * Math.sin(t * 0.00031)), ty = P.active ? P.y : h * (0.5 + 0.3 * Math.sin(t * 0.00047 + 1.3));
        mx = mx < -999 ? tx : MK.lerp(mx, tx, P.active ? 0.12 : 0.03); my = my < -999 ? ty : MK.lerp(my, ty, P.active ? 0.12 : 0.03);
        amt = MK.lerp(amt, P.active ? 1 : 0.6, 0.05);
        var R = Math.min(w, h) * 0.34, pull = 46 * strength * amt * sign, s2 = 2 * (R * 0.55) * (R * 0.55);
        function disp(x, y) {
          var dx = mx - x, dy = my - y, d2 = dx * dx + dy * dy;
          var f = pull * Math.exp(-d2 / s2), d = Math.sqrt(d2) + 1e-3;
          var wave = Math.sin(x * 0.012 + t * 0.0011) * 2.2 + Math.cos(y * 0.014 - t * 0.0009) * 2.2;
          return [x + (dx / d) * f + wave * 0.35, y + (dy / d) * f + wave];
        }
        function lines() {
          ctx.beginPath();
          var x, y, p;
          for (y = gap / 2; y < h + gap; y += gap) {
            for (x = -12; x <= w + 12; x += 14) { p = disp(x, y); if (x < -11) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]); }
          }
          for (x = gap / 2; x < w + gap; x += gap) {
            for (y = -12; y <= h + 12; y += 14) { p = disp(x, y); if (y < -11) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]); }
          }
        }
        ctx.clearRect(0, 0, w, h);
        lines();
        ctx.lineWidth = 1;
        ctx.strokeStyle = MK.rgba(env.colors[1] || env.colors[0], 0.13);
        ctx.stroke();
        if (amt > 0.02) {
          var g = ctx.createRadialGradient(mx, my, 0, mx, my, R * 1.1);
          g.addColorStop(0, MK.rgba(env.colors[2] || env.colors[0], 0.95 * amt));
          g.addColorStop(0.35, MK.rgba(env.colors[0], 0.6 * amt));
          g.addColorStop(1, MK.rgba(env.colors[0], 0));
          ctx.strokeStyle = g;
          ctx.lineWidth = 1.4;
          ctx.stroke();
        }
      }
      return { frame: frame };
    }
  });
})(window.MotionKit);
