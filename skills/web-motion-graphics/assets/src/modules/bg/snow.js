/* bg: snow - gently falling, swaying particles (winter, holidays, festivals; tint for petals/embers).
 * Options: data-bg-density="1" data-bg-speed="1" data-bg-rise (float upward like embers/bubbles) */
(function (MK) {
  'use strict';
  MK.defineBg('snow', {
    canvas: true,
    create: function (env) {
      var flakes = [], speed = env.opt('speed', 1), density = env.opt('density', 1);
      var rise = env.el.hasAttribute('data-bg-rise');
      function mk(w, h, top) {
        return {
          x: Math.random() * w, y: top ? (rise ? h + 10 : -10) : Math.random() * h,
          r: 1 + Math.random() * 3, v: 0.3 + Math.random() * 0.9, ph: Math.random() * 6.28,
          c: Math.random() < 0.7 ? '#ffffff' : env.colors[(Math.random() * env.colors.length) | 0],
          a: 0.4 + Math.random() * 0.5
        };
      }
      function resize(w, h) {
        var n = Math.round(MK.clamp(w * h / 9000, 30, 220) * density);
        while (flakes.length < n) flakes.push(mk(w, h, false));
        flakes.length = n;
      }
      function frame(t, dt) {
        var ctx = env.ctx, w = env.w, h = env.h, k = (dt / 16) * speed;
        ctx.clearRect(0, 0, w, h);
        for (var i = 0; i < flakes.length; i++) {
          var f = flakes[i];
          f.y += (rise ? -f.v : f.v) * k;
          f.x += Math.sin(t * 0.001 + f.ph) * 0.35 * k;
          if ((!rise && f.y > h + 10) || (rise && f.y < -10) || f.x < -10 || f.x > w + 10) { flakes[i] = mk(w, h, true); continue; }
          ctx.globalAlpha = f.a;
          ctx.fillStyle = f.c;
          ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.2832); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      return { resize: resize, frame: frame };
    }
  });
})(window.MotionKit);
