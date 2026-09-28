/* bg: waves - layered flowing sine waves along the bottom of the section.
 * Options: data-bg-layers="3" data-bg-amp="1" data-bg-speed="1" data-bg-height="0.45" (share of section height) */
(function (MK) {
  'use strict';
  MK.defineBg('waves', {
    canvas: true,
    create: function (env) {
      var layers = Math.round(MK.clamp(env.opt('layers', 3), 1, 6));
      var amp = env.opt('amp', 1), speed = env.opt('speed', 1), band = env.opt('height', 0.45);
      function frame(t) {
        var ctx = env.ctx, w = env.w, h = env.h;
        ctx.clearRect(0, 0, w, h);
        for (var i = 0; i < layers; i++) {
          var y0 = h * (1 - band) + (h * band) * (i / (layers + 0.5)) * 0.6;
          var A = h * band * 0.18 * amp * (1 - i * 0.15);
          var k = (Math.PI * 2) / (w * (0.8 + i * 0.3));
          var s = t * 0.0007 * speed * (1 + i * 0.35);
          ctx.beginPath();
          ctx.moveTo(0, h);
          for (var x = 0; x <= w + 12; x += 12) {
            var y = y0 + Math.sin(x * k + s + i * 1.7) * A + Math.sin(x * k * 2.3 - s * 1.3 + i) * A * 0.35;
            ctx.lineTo(x, y);
          }
          ctx.lineTo(w, h);
          ctx.closePath();
          ctx.globalAlpha = 0.22 + (i / layers) * 0.3;
          ctx.fillStyle = env.colors[i % env.colors.length];
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      return { frame: frame };
    }
  });
})(window.MotionKit);
