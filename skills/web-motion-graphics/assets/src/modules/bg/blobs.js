/* bg: blobs - WebGL lava-lamp metaballs that merge and split; the cursor adds its own blob.
 * Options: data-bg-speed="1" data-bg-size="1" (blob size multiplier). Dim any background with --mk-bg-opacity. */
(function (MK) {
  'use strict';
  MK.shaderBg('blobs', {
    maxDpr: 1,
    uniforms: { u_size: function (env) { return env.opt('size', 1); } },
    fs: [
      'uniform float u_size;',
      'float ball(vec2 p,vec2 c,float r){vec2 d=p-c;return r*r/(dot(d,d)+1e-4);}',
      'void main(){',
      '  float ar=u_res.x/u_res.y;',
      '  vec2 uv=gl_FragCoord.xy/u_res;',
      '  vec2 p=vec2(uv.x*ar,uv.y);',
      '  float t=u_time*.22;',
      '  float f=0.;vec3 acc=vec3(0.);',
      '  for(int i=0;i<7;i++){',
      '    float fi=float(i);',
      '    vec2 c=vec2(ar*(.5+.42*sin(t*(.7+fi*.137)+fi*2.1)),.5+.40*sin(t*(.53+fi*.113)+fi*1.3+1.7));',
      '    float r=(.125+.05*sin(fi*1.7+t*.9))*u_size;',
      '    float v=ball(p,c,r);',
      '    float k=mod(fi,3.);',
      '    vec3 col=k<1.?u_c1:(k<2.?u_c2:u_c3);',
      '    f+=v;acc+=col*v;',
      '  }',
      '  vec2 m=vec2(u_mouse.x*ar,u_mouse.y);',
      '  float mv=ball(p,m,(.13*u_hover+.0001)*u_size);',
      '  f+=mv;acc+=mix(u_c1,u_c3,.5)*mv;',
      '  vec3 col=acc/max(f,1e-4);',
      '  float body=smoothstep(.9,1.,f);',
      '  float inner=smoothstep(1.,4.,f);',
      '  float edge=smoothstep(1.,1.12,f);',
      '  vec3 lit=col*(.5+.6*inner)*(.7+.3*edge)+vec3(1.)*pow(inner,2.5)*.22;',
      '  float halo=smoothstep(.3,.9,f)*(1.-body)*.4;',
      '  gl_FragColor=vec4(mix(col,lit,body),clamp(body+halo,0.,1.));',
      '}'
    ].join('\n')
  });
})(window.MotionKit);
