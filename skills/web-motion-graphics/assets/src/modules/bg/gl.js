/* bg: gl - tiny engine for full-screen fragment-shader backgrounds.
 * MotionKit.shaderBg(name, { fs, maxDpr, fallback, uniforms: { u_x: function (env) { return 1.0; } } })
 * Every shader gets: u_res (px), u_time (s), u_mouse (0-1, y up, eased), u_hover (0-1 eased while the
 * pointer is over the layer), u_c1..u_c3 (palette as vec3), plus hash(), noise(), fbm() helpers.
 */
(function (MK) {
  'use strict';
  var VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  var LIB = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform vec2 u_res;uniform float u_time;uniform vec2 u_mouse;uniform float u_hover;',
    'uniform vec3 u_c1;uniform vec3 u_c2;uniform vec3 u_c3;',
    'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);',
    'return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x),u.y);}',
    'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.02+vec2(1.3,.7);a*=.5;}return v;}',
    ''
  ].join('\n');

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      MK.warn('shader compile failed:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  MK.shaderBg = function (name, cfg) {
    MK.defineBg(name, {
      webgl: true,
      maxDpr: cfg.maxDpr || 1,
      fallback: cfg.fallback || 'aurora',
      create: function (env) {
        var gl = env.gl;
        var vs = compile(gl, gl.VERTEX_SHADER, VS), fs = compile(gl, gl.FRAGMENT_SHADER, LIB + cfg.fs);
        if (!vs || !fs) return { unsupported: true };
        var prog = gl.createProgram();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.bindAttribLocation(prog, 0, 'p');
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { MK.warn('shader link failed:', gl.getProgramInfoLog(prog)); return { unsupported: true }; }
        gl.useProgram(prog);
        var buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        var loc = function (n) { return gl.getUniformLocation(prog, n); };
        var U = { res: loc('u_res'), time: loc('u_time'), mouse: loc('u_mouse'), hover: loc('u_hover') };
        var c = env.colors.map(function (col) { return MK.rgb(col).map(function (v) { return v / 255; }); });
        gl.uniform3fv(loc('u_c1'), c[0]);
        gl.uniform3fv(loc('u_c2'), c[1] || c[0]);
        gl.uniform3fv(loc('u_c3'), c[2] || c[1] || c[0]);
        var custom = cfg.uniforms || {};
        var customLoc = {};
        Object.keys(custom).forEach(function (k) { customLoc[k] = loc(k); });
        var speed = env.opt('speed', 1), seed = Math.random() * 100;
        var mx = 0.5, my = 0.5, hover = 0;

        function draw(tSec) {
          var P = env.pointer;
          mx = MK.lerp(mx, P.active ? P.nx : 0.5, 0.06);
          my = MK.lerp(my, P.active ? 1 - P.ny : 0.5, 0.06);
          hover = MK.lerp(hover, P.active ? 1 : 0, 0.05);
          gl.uniform2f(U.res, env.canvas.width, env.canvas.height);
          gl.uniform1f(U.time, tSec * speed + seed);
          gl.uniform2f(U.mouse, mx, my);
          gl.uniform1f(U.hover, hover);
          Object.keys(custom).forEach(function (k) {
            var v = custom[k](env);
            if (typeof v === 'number') gl.uniform1f(customLoc[k], v);
            else if (v && v.length === 2) gl.uniform2f(customLoc[k], v[0], v[1]);
            else if (v && v.length === 3) gl.uniform3f(customLoc[k], v[0], v[1], v[2]);
          });
          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
        }
        return {
          frame: function (t) { draw(t / 1000); },
          still: function () { draw(8); },
          destroy: function () { gl.deleteProgram(prog); gl.deleteBuffer(buf); }
        };
      }
    });
  };
})(window.MotionKit);
