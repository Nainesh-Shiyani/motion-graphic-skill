/* bg: fluid - real-time WebGL2 fluid simulation ("splash cursor"): moving the pointer (or a finger)
 * swirls glowing ink in the palette colors. On <body> it becomes a full-page interactive layer.
 * Options: data-bg-fade="1.2" (ink fade speed) data-bg-curl="28" (swirliness) data-bg-radius="0.22"
 *          data-bg-auto (keep making gentle splashes when idle, default on; data-bg-auto="false" to disable)
 * Needs WebGL2 + float render targets; falls back to aurora otherwise.
 */
(function (MK) {
  'use strict';
  var HEAD = '#version 300 es\nprecision highp float;\nprecision highp sampler2D;\n';
  var VS = HEAD + [
    'in vec2 aPosition;',
    'out vec2 vUv,vL,vR,vT,vB;',
    'uniform vec2 texelSize;',
    'void main(){',
    '  vUv=aPosition*.5+.5;',
    '  vL=vUv-vec2(texelSize.x,0.);vR=vUv+vec2(texelSize.x,0.);',
    '  vT=vUv+vec2(0.,texelSize.y);vB=vUv-vec2(0.,texelSize.y);',
    '  gl_Position=vec4(aPosition,0.,1.);',
    '}'
  ].join('\n');
  var FIN = 'in vec2 vUv,vL,vR,vT,vB;out vec4 o;\n';
  var FS = {
    clear: 'uniform sampler2D uTexture;uniform float value;void main(){o=value*texture(uTexture,vUv);}',
    splat: 'uniform sampler2D uTarget;uniform float aspectRatio;uniform vec3 color;uniform vec2 point;uniform float radius;' +
      'void main(){vec2 p=vUv-point;p.x*=aspectRatio;vec3 s=exp(-dot(p,p)/radius)*color;o=vec4(texture(uTarget,vUv).xyz+s,1.);}',
    advection: 'uniform sampler2D uVelocity;uniform sampler2D uSource;uniform vec2 texelSize;uniform float dt;uniform float dissipation;' +
      'void main(){vec2 c=vUv-dt*texture(uVelocity,vUv).xy*texelSize;o=texture(uSource,c)/(1.+dissipation*dt);}',
    divergence: 'uniform sampler2D uVelocity;void main(){float L=texture(uVelocity,vL).x;float R=texture(uVelocity,vR).x;' +
      'float T=texture(uVelocity,vT).y;float B=texture(uVelocity,vB).y;vec2 C=texture(uVelocity,vUv).xy;' +
      'if(vL.x<0.)L=-C.x;if(vR.x>1.)R=-C.x;if(vT.y>1.)T=-C.y;if(vB.y<0.)B=-C.y;o=vec4(.5*(R-L+T-B),0.,0.,1.);}',
    curl: 'uniform sampler2D uVelocity;void main(){float L=texture(uVelocity,vL).y;float R=texture(uVelocity,vR).y;' +
      'float T=texture(uVelocity,vT).x;float B=texture(uVelocity,vB).x;o=vec4(.5*(R-L-T+B),0.,0.,1.);}',
    vorticity: 'uniform sampler2D uVelocity;uniform sampler2D uCurl;uniform float curl;uniform float dt;' +
      'void main(){float L=texture(uCurl,vL).x;float R=texture(uCurl,vR).x;float T=texture(uCurl,vT).x;float B=texture(uCurl,vB).x;' +
      'float C=texture(uCurl,vUv).x;vec2 f=.5*vec2(abs(T)-abs(B),abs(R)-abs(L));f/=length(f)+.0001;f*=curl*C;f.y*=-1.;' +
      'vec2 v=texture(uVelocity,vUv).xy+f*dt;o=vec4(clamp(v,-1000.,1000.),0.,1.);}',
    pressure: 'uniform sampler2D uPressure;uniform sampler2D uDivergence;void main(){float L=texture(uPressure,vL).x;' +
      'float R=texture(uPressure,vR).x;float T=texture(uPressure,vT).x;float B=texture(uPressure,vB).x;' +
      'o=vec4((L+R+B+T-texture(uDivergence,vUv).x)*.25,0.,0.,1.);}',
    gradient: 'uniform sampler2D uPressure;uniform sampler2D uVelocity;void main(){float L=texture(uPressure,vL).x;' +
      'float R=texture(uPressure,vR).x;float T=texture(uPressure,vT).x;float B=texture(uPressure,vB).x;' +
      'vec2 v=texture(uVelocity,vUv).xy-vec2(R-L,T-B);o=vec4(v,0.,1.);}',
    display: 'uniform sampler2D uTexture;uniform vec2 texelSize;void main(){vec3 c=texture(uTexture,vUv).rgb;' +
      'vec3 l=texture(uTexture,vL).rgb;vec3 r=texture(uTexture,vR).rgb;vec3 t=texture(uTexture,vT).rgb;vec3 b=texture(uTexture,vB).rgb;' +
      'vec3 n=normalize(vec3(length(r)-length(l),length(t)-length(b),length(texelSize)));' +
      'c*=clamp(dot(n,vec3(0.,0.,1.))+.7,.7,1.);c=min(c,vec3(1.));float a=max(c.r,max(c.g,c.b));o=vec4(c,a);}'
  };

  MK.defineBg('fluid', {
    webgl: true,
    webgl2: true,
    maxDpr: 1,
    fallback: 'aurora',
    glAttrs: { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false },
    create: function (env) {
      var gl = env.gl;
      if (!gl.getExtension('EXT_color_buffer_float')) return { unsupported: true };
      gl.getExtension('OES_texture_float_linear');
      var small = Math.min(window.innerWidth, window.innerHeight) < 600;
      var cfg = {
        sim: 128, dye: small ? 512 : 1024, fade: env.opt('fade', 1.2), velFade: 0.25, pressure: 0.8, iters: 20,
        curl: env.opt('curl', 28), radius: env.opt('radius', 0.22) / 100, force: 6000,
        auto: env.str('auto', 'true') !== 'false'
      };

      function shader(type, src) {
        var s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { MK.warn('fluid shader:', gl.getShaderInfoLog(s)); return null; }
        return s;
      }
      var vs = shader(gl.VERTEX_SHADER, VS);
      if (!vs) return { unsupported: true };
      var P = {}, ok = true;
      Object.keys(FS).forEach(function (k) {
        var fs = shader(gl.FRAGMENT_SHADER, HEAD + FIN + FS[k]);
        if (!fs) { ok = false; return; }
        var prog = gl.createProgram();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.bindAttribLocation(prog, 0, 'aPosition');
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { ok = false; return; }
        var u = {}, n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
        for (var i = 0; i < n; i++) { var info = gl.getActiveUniform(prog, i); u[info.name] = gl.getUniformLocation(prog, info.name); }
        P[k] = { prog: prog, u: u };
      });
      if (!ok) return { unsupported: true };

      var vb = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vb);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
      var ib = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(0);

      function fbo(w, h) {
        gl.activeTexture(gl.TEXTURE0);
        var tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
        var fb = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        var complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
        gl.viewport(0, 0, w, h);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        return {
          tex: tex, fb: fb, w: w, h: h, tx: 1 / w, ty: 1 / h, ok: complete,
          attach: function (id) { gl.activeTexture(gl.TEXTURE0 + id); gl.bindTexture(gl.TEXTURE_2D, tex); return id; },
          free: function () { gl.deleteTexture(tex); gl.deleteFramebuffer(fb); }
        };
      }
      function dbl(w, h) {
        var a = fbo(w, h), b = fbo(w, h);
        return {
          get read() { return a; }, get write() { return b; }, ok: a.ok && b.ok,
          swap: function () { var t = a; a = b; b = t; },
          free: function () { a.free(); b.free(); }
        };
      }
      function res(r) {
        var ar = env.canvas.width / Math.max(1, env.canvas.height);
        if (ar < 1) ar = 1 / ar;
        var lo = Math.round(r), hi = Math.round(r * ar);
        return env.canvas.width > env.canvas.height ? [hi, lo] : [lo, hi];
      }
      var vel, dye, pres, div, curlF, supported = true;
      function init() {
        [vel, dye, pres, div, curlF].forEach(function (f) { if (f) f.free(); });
        var s = res(cfg.sim), dr = res(cfg.dye);
        vel = dbl(s[0], s[1]);
        pres = dbl(s[0], s[1]);
        div = fbo(s[0], s[1]);
        curlF = fbo(s[0], s[1]);
        dye = dbl(dr[0], dr[1]);
        supported = vel.ok && pres.ok && div.ok && curlF.ok && dye.ok;
      }
      function blit(target) {
        if (target) { gl.viewport(0, 0, target.w, target.h); gl.bindFramebuffer(gl.FRAMEBUFFER, target.fb); }
        else { gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight); gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
      }
      function use(p) { gl.useProgram(p.prog); return p.u; }

      var palette = env.colors.map(function (c) { return MK.rgb(c).map(function (v) { return v / 255; }); });
      var ci = 0;
      function color() {
        var c = palette[ci++ % palette.length], k = 0.16 + Math.random() * 0.08;
        return [c[0] * k, c[1] * k, c[2] * k];
      }
      function splat(x, y, dx, dy, c) {
        var ar = env.canvas.width / Math.max(1, env.canvas.height);
        var u = use(P.splat);
        gl.uniform1i(u.uTarget, vel.read.attach(0));
        gl.uniform1f(u.aspectRatio, ar);
        gl.uniform2f(u.point, x, y);
        gl.uniform3f(u.color, dx, dy, 0);
        gl.uniform1f(u.radius, ar > 1 ? cfg.radius * ar : cfg.radius);
        blit(vel.write); vel.swap();
        gl.uniform1i(u.uTarget, dye.read.attach(0));
        gl.uniform3f(u.color, c[0], c[1], c[2]);
        blit(dye.write); dye.swap();
      }
      function randomSplats(n) {
        for (var i = 0; i < n; i++) {
          var c = color();
          splat(Math.random(), Math.random(), 1000 * (Math.random() - 0.5), 1000 * (Math.random() - 0.5), [c[0] * 8, c[1] * 8, c[2] * 8]);
        }
      }
      function step(dt) {
        gl.disable(gl.BLEND);
        var u = use(P.curl);
        gl.uniform2f(u.texelSize, vel.read.tx, vel.read.ty);
        gl.uniform1i(u.uVelocity, vel.read.attach(0));
        blit(curlF);
        u = use(P.vorticity);
        gl.uniform2f(u.texelSize, vel.read.tx, vel.read.ty);
        gl.uniform1i(u.uVelocity, vel.read.attach(0));
        gl.uniform1i(u.uCurl, curlF.attach(1));
        gl.uniform1f(u.curl, cfg.curl);
        gl.uniform1f(u.dt, dt);
        blit(vel.write); vel.swap();
        u = use(P.divergence);
        gl.uniform2f(u.texelSize, vel.read.tx, vel.read.ty);
        gl.uniform1i(u.uVelocity, vel.read.attach(0));
        blit(div);
        u = use(P.clear);
        gl.uniform1i(u.uTexture, pres.read.attach(0));
        gl.uniform1f(u.value, cfg.pressure);
        blit(pres.write); pres.swap();
        u = use(P.pressure);
        gl.uniform2f(u.texelSize, vel.read.tx, vel.read.ty);
        gl.uniform1i(u.uDivergence, div.attach(0));
        for (var i = 0; i < cfg.iters; i++) {
          gl.uniform1i(u.uPressure, pres.read.attach(1));
          blit(pres.write); pres.swap();
        }
        u = use(P.gradient);
        gl.uniform2f(u.texelSize, vel.read.tx, vel.read.ty);
        gl.uniform1i(u.uPressure, pres.read.attach(0));
        gl.uniform1i(u.uVelocity, vel.read.attach(1));
        blit(vel.write); vel.swap();
        u = use(P.advection);
        gl.uniform2f(u.texelSize, vel.read.tx, vel.read.ty);
        gl.uniform1i(u.uVelocity, vel.read.attach(0));
        gl.uniform1i(u.uSource, vel.read.attach(0));
        gl.uniform1f(u.dt, dt);
        gl.uniform1f(u.dissipation, cfg.velFade);
        blit(vel.write); vel.swap();
        gl.uniform1i(u.uVelocity, vel.read.attach(0));
        gl.uniform1i(u.uSource, dye.read.attach(1));
        gl.uniform1f(u.dissipation, cfg.fade);
        blit(dye.write); dye.swap();
      }
      function render() {
        var u = use(P.display);
        gl.uniform2f(u.texelSize, 1 / gl.drawingBufferWidth, 1 / gl.drawingBufferHeight);
        gl.uniform1i(u.uTexture, dye.read.attach(0));
        blit(null);
      }

      // pointer input (mouse, pen and touch) relative to the layer
      var ptr = { x: 0, y: 0, px: 0, py: 0, moved: false, down: false, seen: false }, lastInput = 0;
      function onMove(e) {
        var r = env.layer.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) { ptr.seen = false; return; }
        var x = (e.clientX - r.left) / r.width, y = 1 - (e.clientY - r.top) / r.height;
        if (!ptr.seen) { ptr.px = x; ptr.py = y; ptr.seen = true; }
        ptr.x = x; ptr.y = y; ptr.moved = true;
        lastInput = performance.now();
      }
      function onDown(e) {
        onMove(e);
        if (!ptr.seen) return;
        var c = color();
        splat(ptr.x, ptr.y, 900 * (Math.random() - 0.5), 900 * (Math.random() - 0.5), [c[0] * 10, c[1] * 10, c[2] * 10]);
      }
      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener('pointerdown', onDown, { passive: true });

      var lastSize = '', nextAuto = 0, pColor = color(), colorAt = 0;
      function ensureSize() {
        var s = env.canvas.width + 'x' + env.canvas.height;
        if (s !== lastSize) { lastSize = s; init(); randomSplats(4); }
      }
      function frame(t, dtMs) {
        ensureSize();
        if (!supported) return;
        var dt = Math.min((dtMs || 16) / 1000, 1 / 60);
        if (ptr.moved) {
          ptr.moved = false;
          if (t - colorAt > 200) { pColor = color(); colorAt = t; }
          var ar = env.canvas.width / Math.max(1, env.canvas.height);
          var dx = ptr.x - ptr.px, dy = ptr.y - ptr.py;
          if (ar < 1) dx *= ar; else dy /= ar;
          if (Math.abs(dx) + Math.abs(dy) > 0) splat(ptr.x, ptr.y, dx * cfg.force, dy * cfg.force, pColor);
          ptr.px = ptr.x; ptr.py = ptr.y;
        }
        if (cfg.auto && performance.now() - lastInput > 2500 && t > nextAuto) {
          nextAuto = t + 1400 + Math.random() * 1400;
          var c = color();
          var x = 0.15 + Math.random() * 0.7, y = 0.15 + Math.random() * 0.7, a = Math.random() * Math.PI * 2;
          splat(x, y, Math.cos(a) * 520, Math.sin(a) * 520, [c[0] * 5, c[1] * 5, c[2] * 5]);
        }
        step(dt);
        render();
      }
      return {
        frame: frame,
        still: function () {
          ensureSize();
          if (!supported) return;
          randomSplats(6);
          for (var i = 0; i < 40; i++) step(1 / 60);
          render();
        },
        destroy: function () {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerdown', onDown);
          [vel, dye, pres, div, curlF].forEach(function (f) { if (f) f.free(); });
          Object.keys(P).forEach(function (k) { gl.deleteProgram(P[k].prog); });
        }
      };
    }
  });
})(window.MotionKit);
