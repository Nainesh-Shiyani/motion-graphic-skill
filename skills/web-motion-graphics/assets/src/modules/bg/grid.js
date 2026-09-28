/* bg: grid - retro/synthwave perspective grid rolling toward the viewer (gaming, web3, music).
 * Options: data-bg-speed="1" data-bg-horizon="0.45" (0-1 from top) data-bg-lines="22" */
(function (MK) {
  'use strict';
  MK.defineBg('grid', {
    canvas: true,
    create: function (env) {
      var speed = env.opt('speed', 1), horizonAt = env.opt('horizon', 0.45), cols = env.opt('lines', 22);
      function frame(t) {
        var ctx = env.ctx, w = env.w, h = env.h;
        var hz = h * horizonAt, depth = h - hz, cx = w / 2;
        ctx.clearRect(0, 0, w, h);
        var glow = ctx.createLinearGradient(0, hz - h * 0.25, 0, hz + 4);
        glow.addColorStop(0, MK.rgba(env.colors[1] || env.colors[0], 0));
        glow.addColorStop(1, MK.rgba(env.colors[1] || env.colors[0], 0.35));
        ctx.fillStyle = glow;
        ctx.fillRect(0, hz - h * 0.25, w, h * 0.25 + 4);

        ctx.strokeStyle = env.colors[0];
        ctx.lineWidth = 1.2;
        for (var i = -cols; i <= cols; i++) {
          var xb = cx + i * (w / cols) * 1.6;
          ctx.globalAlpha = 0.55;
          ctx.beginPath(); ctx.moveTo(cx + i * (w / cols) * 0.06, hz); ctx.lineTo(xb, h); ctx.stroke();
        }
        var rows = 18, off = (t * 0.00018 * speed) % 1;
        for (var k = 0; k < rows; k++) {
          var s = (k + off) / rows;
          var y = hz + depth * Math.pow(s, 2.6);
          ctx.globalAlpha = Math.min(1, s * 1.4) * 0.75;
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = MK.rgba(env.colors[0], 0.9);
        ctx.fillRect(0, hz - 1, w, 2);
      }
      return { frame: frame };
    }
  });
})(window.MotionKit);
