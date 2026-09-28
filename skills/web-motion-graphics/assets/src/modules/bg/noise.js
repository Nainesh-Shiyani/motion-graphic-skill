/* bg: noise - animated film grain over the section background (pairs well with aurora / gradient).
 * Tune with CSS: --mk-noise-opacity (default .14) */
(function (MK) {
  'use strict';
  MK.defineBg('noise', {
    create: function (env) {
      var g = document.createElement('mk-span');
      g.className = 'mk-noise-grain';
      env.layer.appendChild(g);
    }
  });
})(window.MotionKit);
