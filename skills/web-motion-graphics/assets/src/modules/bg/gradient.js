/* bg: gradient - slowly rotating, blurred multi-color mesh gradient (pure CSS).
 * Tune with CSS: --mk-gradient-speed (default 1), --mk-gradient-opacity (default 1) */
(function (MK) {
  'use strict';
  MK.defineBg('gradient', {
    create: function (env) {
      var c = env.colors;
      var a = document.createElement('mk-span');
      a.className = 'mk-gradient-a';
      a.style.background = 'conic-gradient(from 0deg at 50% 50%, ' + [c[0], c[1] || c[0], c[2] || c[0], c[0]].join(', ') + ')';
      var b = document.createElement('mk-span');
      b.className = 'mk-gradient-b';
      b.style.background = 'radial-gradient(circle at 30% 40%, ' + (c[2] || c[0]) + ', transparent 55%), radial-gradient(circle at 70% 60%, ' + (c[1] || c[0]) + ', transparent 50%)';
      env.layer.appendChild(a);
      env.layer.appendChild(b);
    }
  });
})(window.MotionKit);
