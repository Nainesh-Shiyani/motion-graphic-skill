/* bg: galaxy - a spiral galaxy of thousands of glowing stars rotating in 3D; the cursor tilts the view
 * (space, AI, gaming, astronomy, "cosmic" brands). Dark sections only.
 * Options: data-bg-arms="3" data-bg-speed="1" data-bg-density="1" data-bg-tilt="62" (degrees) */
(function (MK) {
  'use strict';
  MK.defineBg('galaxy', {
    canvas: true,
    create: function (env) {
      var arms = Math.round(MK.clamp(env.opt('arms', 3), 1, 6)), speed = env.opt('speed', 1), density = env.opt('density', 1);
      var baseTilt = env.opt('tilt', 62) * Math.PI / 180;
      var cols = [env.colors[2] || env.colors[0], '#ffffff', env.colors[0], env.colors[1] || env.colors[0]];
      var buckets = [[], [], [], []], dust = [], built = 0, tx = 0, ty = 0;
      function build(w, h) {
        var n = Math.round(MK.clamp(w * h / 260, 1500, 4200) * density);
        buckets = [[], [], [], []];
        for (var i = 0; i < n; i++) {
          var r = Math.pow(Math.random(), 1.5);
          var arm = i % arms;
          var ang = (arm / arms) * Math.PI * 2 + r * 5.2 + (Math.random() - 0.5) * (0.9 - r * 0.45);
          var spread = (Math.random() - 0.5) * 0.16 * (1 - r * 0.5);
          var s = {
            r: r + spread * 0.3, a: ang, z: (Math.random() - 0.5) * 0.09 * (1 - r) * (1 - r),
            size: 0.6 + Math.random() * 1.5 * (1 - r * 0.45), b: 0.3 + Math.random() * 0.7,
            w: (0.06 + 0.09 / (0.18 + r)) * (0.8 + Math.random() * 0.4)
          };
          // core stars are hot white/pink, arms palette 1, rim palette 2
          var bucket = r < 0.12 ? (Math.random() < 0.5 ? 0 : 1) : (r < 0.62 ? (Math.random() < 0.18 ? 1 : 2) : 3);
          buckets[bucket].push(s);
        }
        dust = [];
        for (var k = 0; k < 180; k++) dust.push([Math.random() * w, Math.random() * h, Math.random() * 0.5 + 0.2]);
        built = w * h;
      }
      function draw(dt) {
        var ctx = env.ctx, w = env.w, h = env.h, P = env.pointer;
        if (built !== w * h) build(w, h);
        tx = MK.lerp(tx, P.active ? (P.ny - 0.5) * 0.5 : 0, 0.04);
        ty = MK.lerp(ty, P.active ? (P.nx - 0.5) * 0.5 : 0, 0.04);
        var tilt = baseTilt + tx, ct = Math.cos(tilt), st = Math.sin(tilt), cy_ = Math.cos(ty), sy_ = Math.sin(ty);
        var scale = Math.min(w, h) * 0.5, cx = w / 2, cy = h / 2;
        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#ffffff';
        for (var d = 0; d < dust.length; d++) { ctx.globalAlpha = dust[d][2] * 0.5; ctx.fillRect(dust[d][0], dust[d][1], 1, 1); }
        ctx.globalCompositeOperation = 'lighter';
        var core = ctx.createRadialGradient(cx, cy, 0, cx, cy, scale * 0.35);
        core.addColorStop(0, MK.rgba(cols[0], 0.55));
        core.addColorStop(0.4, MK.rgba(cols[2], 0.18));
        core.addColorStop(1, MK.rgba(cols[2], 0));
        ctx.globalAlpha = 1;
        ctx.fillStyle = core;
        ctx.fillRect(cx - scale, cy - scale, scale * 2, scale * 2);
        var k = (dt / 1000) * speed;
        for (var bi = 0; bi < 4; bi++) {
          ctx.fillStyle = cols[bi];
          var list = buckets[bi];
          for (var i = 0; i < list.length; i++) {
            var s = list[i];
            s.a += s.w * k;
            var x = Math.cos(s.a) * s.r, y = Math.sin(s.a) * s.r, z = s.z;
            var x2 = x * cy_ + z * sy_, z1 = -x * sy_ + z * cy_;
            var y2 = y * ct - z1 * st, z2 = y * st + z1 * ct;
            var f = 1 / (1 + z2 * 0.5);
            var px = cx + x2 * scale * f, py = cy + y2 * scale * f;
            ctx.globalAlpha = s.b * (0.55 + 0.45 * f);
            var sz = s.size * f;
            ctx.fillRect(px, py, sz, sz);
          }
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
      return { frame: function (t, dt) { draw(dt); }, still: function () { draw(0); } };
    }
  });
})(window.MotionKit);
