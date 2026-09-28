/* bg: bokeh - soft glowing orbs drifting and breathing (elegant, wellness, luxury, events).
 * Options: data-bg-count="16" data-bg-speed="1" */
(function (MK) {
  'use strict';
  MK.defineBg('bokeh', {
    canvas: true,
    create: function (env) {
      var orbs = [], speed = env.opt('speed', 1);
      var count = Math.round(env.opt('count', 16));
      function resize(w, h) {
        var base = Math.min(w, h);
        while (orbs.length < count) {
          var col = MK.rgb(env.colors[orbs.length % env.colors.length]);
          orbs.push({
            x: Math.random() * w, y: Math.random() * h,
            r: base * (0.06 + Math.random() * 0.16),
            vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
            a: 0.18 + Math.random() * 0.3, ph: Math.random() * 6.28, rgb: col.join(',')
          });
        }
      }
      function frame(t, dt) {
        var ctx = env.ctx, w = env.w, h = env.h, k = (dt / 16) * speed;
        ctx.clearRect(0, 0, w, h);
        for (var i = 0; i < orbs.length; i++) {
          var o = orbs[i];
          o.x += o.vx * k; o.y += o.vy * k;
          if (o.x < -o.r) o.x = w + o.r; else if (o.x > w + o.r) o.x = -o.r;
          if (o.y < -o.r) o.y = h + o.r; else if (o.y > h + o.r) o.y = -o.r;
          var a = o.a * (0.7 + 0.3 * Math.sin(t * 0.0009 + o.ph));
          var g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
          g.addColorStop(0, 'rgba(' + o.rgb + ',' + a.toFixed(3) + ')');
          g.addColorStop(0.55, 'rgba(' + o.rgb + ',' + (a * 0.45).toFixed(3) + ')');
          g.addColorStop(1, 'rgba(' + o.rgb + ',0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 6.2832); ctx.fill();
        }
      }
      return { resize: resize, frame: frame };
    }
  });
})(window.MotionKit);
