/* bg: dots - interactive dot matrix: dots swell and glow near the cursor, with a slow idle ripple.
 * Options: data-bg-gap="28" (px between dots) data-bg-radius="170" (cursor influence) */
(function (MK) {
  'use strict';
  MK.defineBg('dots', {
    canvas: true,
    create: function (env) {
      var gap = env.opt('gap', 28), radius = env.opt('radius', 170);
      var px = -9999, py = -9999, amt = 0;
      function frame(t) {
        var ctx = env.ctx, w = env.w, h = env.h, P = env.pointer;
        ctx.clearRect(0, 0, w, h);
        if (P.active) { px = MK.lerp(px < -999 ? P.x : px, P.x, 0.2); py = MK.lerp(py < -999 ? P.y : py, P.y, 0.2); }
        amt = MK.lerp(amt, P.active ? 1 : 0, 0.08);
        var cx = w / 2, cy = h / 2;
        var c0 = env.colors[0], c1 = env.colors[1] || c0;
        for (var y = gap / 2; y < h; y += gap) {
          for (var x = gap / 2; x < w; x += gap) {
            var dx = x - px, dy = y - py;
            var inf = amt * Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / radius);
            var dc = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
            var wave = (Math.sin(dc * 0.018 - t * 0.0016) + 1) * 0.5;
            ctx.globalAlpha = 0.24 + wave * 0.22 + inf * 0.7;
            ctx.fillStyle = inf > 0.08 ? c0 : c1;
            var r = 1.1 + wave * 0.6 + inf * 2.6;
            ctx.fillRect(x - r, y - r, r * 2, r * 2);
          }
        }
        ctx.globalAlpha = 1;
      }
      return { frame: frame };
    }
  });
})(window.MotionKit);
