/* bg: aurora - big soft color blobs slowly drifting (pure CSS, very cheap). Great hero default.
 * Tune with CSS: --mk-aurora-opacity (default .6), --mk-aurora-speed (default 1) */
(function (MK) {
  'use strict';
  MK.defineBg('aurora', {
    create: function (env) {
      for (var i = 0; i < 4; i++) {
        var b = document.createElement('mk-span');
        b.className = 'mk-aurora-blob';
        b.style.setProperty('--c', env.colors[i % env.colors.length]);
        env.layer.appendChild(b);
      }
    }
  });
})(window.MotionKit);
