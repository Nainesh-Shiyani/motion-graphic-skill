/* bg: stars - warp-speed starfield flying toward the viewer (put it on a dark section).
 * Options: data-bg-speed="1" data-bg-density="1" */
(function (MK) {
  'use strict';
  MK.defineBg('stars', {
    canvas: true,
    create: function (env) {
      var stars = [], speed = env.opt('speed', 1), density = env.opt('density', 1);
      var cx = 0, cy = 0;
      function spawn(s, z) {
        s.x = (Math.random() - 0.5) * 2;
        s.y = (Math.random() - 0.5) * 2;
        s.z = z == null ? Math.random() : z;
        s.pz = s.z;
        s.c = Math.random() < 0.8 ? '#ffffff' : env.colors[(Math.random() * env.colors.length) | 0];
        return s;
      }
      function resize(w, h) {
        var n = Math.round(MK.clamp(w * h / 1400, 160, 900) * density);
        while (stars.length < n) stars.push(spawn({}));
        stars.length = n;
      }
      function draw(dz, streaks) {
        var ctx = env.ctx, w = env.w, h = env.h, P = env.pointer;
        var tx = w / 2 + (P.active ? (P.x - w / 2) * 0.08 : 0);
        var ty = h / 2 + (P.active ? (P.y - h / 2) * 0.08 : 0);
        cx = MK.lerp(cx || tx, tx, 0.05); cy = MK.lerp(cy || ty, ty, 0.05);
        var scale = Math.max(w, h) * 0.5;
        ctx.clearRect(0, 0, w, h);
        for (var i = 0; i < stars.length; i++) {
          var s = stars[i];
          s.pz = s.z;
          s.z -= dz;
          if (s.z <= 0.02) { spawn(s, 1); continue; }
          var sx = cx + (s.x / s.z) * scale, sy = cy + (s.y / s.z) * scale;
          if (sx < -10 || sx > w + 10 || sy < -10 || sy > h + 10) { spawn(s, 1); continue; }
          var size = (1 - s.z) * 2.8 + 0.7;
          ctx.globalAlpha = Math.min(1, 0.3 + (1 - s.z) * 1.2);
          if (!streaks) { size = Math.max(size, 1.4); ctx.globalAlpha = 0.35 + (1 - s.z) * 0.65; }
          ctx.fillStyle = s.c;
          ctx.beginPath(); ctx.arc(sx, sy, Math.max(0.6, size / 2), 0, 6.2832); ctx.fill();
          if (streaks && s.z < 0.6) {
            // tail for near stars = sense of speed
            var px = cx + (s.x / (s.pz + dz * 5)) * scale, py = cy + (s.y / (s.pz + dz * 5)) * scale;
            ctx.strokeStyle = s.c; ctx.lineWidth = size * 0.7;
            ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(sx, sy); ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;
      }
      return {
        resize: resize,
        frame: function (t, dt) { draw(0.0022 * speed * (dt / 16), true); },
        still: function () { draw(0, false); }
      };
    }
  });
})(window.MotionKit);
