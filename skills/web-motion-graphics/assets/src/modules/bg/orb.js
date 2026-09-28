/* bg: orb - glowing "AI orb": a swirling liquid sphere with rim light that leans toward the cursor,
 * swells and speeds up on hover. Put it on a square-ish element (e.g. 420x420) or a hero section.
 * Options: data-bg-speed="1" data-bg-size="1" (orb radius multiplier) */
(function (MK) {
  'use strict';
  MK.shaderBg('orb', {
    maxDpr: 1.5,
    uniforms: { u_size: function (env) { return env.opt('size', 1); } },
    fs: [
      'uniform float u_size;',
      'void main(){',
      '  float s=min(u_res.x,u_res.y);',
      '  vec2 p=(gl_FragCoord.xy-.5*u_res)/s;',
      '  vec2 m=(u_mouse-.5)*u_res/s;',
      '  p-=m*.07*u_hover;',
      '  float t=u_time*(.35+.5*u_hover);',
      '  float R=(.3+.012*sin(u_time*1.6)+.03*u_hover)*u_size;',
      '  float d=length(p);',
      '  vec2 q=p*3.2/u_size;',
      '  vec2 w=vec2(fbm(q+vec2(t,-t*.7)),fbm(q+vec2(-t*.8,t)+4.3));',
      '  float n=fbm(q+w*2.2+t*.3);',
      '  vec3 inner=mix(u_c1,u_c2,smoothstep(.25,.75,n));',
      '  inner=mix(inner,u_c3,smoothstep(.55,.9,w.x));',
      '  float z=sqrt(max(R*R-d*d,0.))/R;',
      '  float body=smoothstep(R+.004,R-.004,d);',
      '  float rim=pow(1.-z,3.);',
      '  vec3 col=inner*(.45+.75*z)+rim*mix(u_c2,vec3(1.),.35)*1.4;',
      '  vec2 hp=p-vec2(-.32,.36)*R;',
      '  col+=vec3(1.)*smoothstep(R*.42,0.,length(hp))*.45*z;',
      '  float glow=exp(-max(d-R,0.)*9./R)*(1.-body);',
      '  vec3 gcol=mix(u_c1,u_c2,.5+.5*sin(u_time*.7));',
      '  gl_FragColor=vec4(mix(gcol,col,body),max(body,glow*(.55+.25*u_hover)));',
      '}'
    ].join('\n')
  });
})(window.MotionKit);
