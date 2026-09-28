/* bg: matrix - falling "code rain" glyphs (hacker / cyber / dev themes). Uses --mk-c1 as glyph color.
 * Options: data-bg-size="16" (font px) data-bg-speed="1" data-bg-chars="01" */
(function (MK) {
  'use strict';
  MK.defineBg('matrix', {
    canvas: true,
    create: function (env) {
      var fs = env.opt('size', 16), speed = env.opt('speed', 1);
      var chars = env.str('chars', 'アイウエオカキクケコサシスセソタチツテト0123456789ABCDEF<>*+=');
      var drops = [], last = -1e9;
      function resize(w, h) {
        var cols = Math.ceil(w / fs);
        drops = [];
        for (var i = 0; i < cols; i++) drops.push(Math.random() * -h / fs);
        env.ctx.clearRect(0, 0, w, h);
      }
      function step() {
        var ctx = env.ctx, w = env.w, h = env.h;
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'source-over';
        ctx.font = fs + 'px monospace';
        for (var i = 0; i < drops.length; i++) {
          var y = drops[i] * fs;
          if (y > 0) {
            var ch = chars.charAt((Math.random() * chars.length) | 0);
            ctx.fillStyle = Math.random() < 0.08 ? '#ffffff' : env.colors[0];
            ctx.globalAlpha = 0.85;
            ctx.fillText(ch, i * fs, y);
          }
          if (y > h && Math.random() > 0.975) drops[i] = 0;
          drops[i]++;
        }
        ctx.globalAlpha = 1;
      }
      return {
        resize: resize,
        frame: function (t) {
          if (t - last < 55 / speed) return;
          last = t;
          step();
        },
        still: function () { for (var i = 0; i < 40; i++) step(); }
      };
    }
  });
})(window.MotionKit);
