/* bg: tunnel - endless neon wormhole flying toward the viewer; steers with the cursor (gaming, sci-fi, music).
 * Options: data-bg-speed="1" */
(function (MK) {
  'use strict';
  MK.shaderBg('tunnel', {
    maxDpr: 1,
    fs: [
      'void main(){',
      '  vec2 p=(gl_FragCoord.xy-.5*u_res)/u_res.y;',
      '  p-=(u_mouse-.5)*.25*u_hover;',
      '  float r=length(p)+1e-4;',
      '  float a=atan(p.y,p.x)/3.14159265;',
      '  float t=u_time*.55;',
      '  float depth=.35/r+t;',
      '  float rings=pow(abs(sin(depth*6.2831853)),18.);',
      '  float spokes=pow(abs(sin(a*25.1327412)),24.);',
      '  float grid=max(rings,spokes);',
      '  float band=.5+.5*sin(depth*1.7+a*6.2831853);',
      '  vec3 col=mix(u_c1,u_c2,band);',
      '  col=mix(col,u_c3,grid);',
      '  float fog=smoothstep(.02,.5,r);',
      '  vec3 c=col*(.18+1.1*grid)*fog;',
      '  c+=u_c2*exp(-r*9.)*.9;',
      '  c*=1.+.3*u_hover;',
      '  gl_FragColor=vec4(c,1.);',
      '}'
    ].join('\n')
  });
})(window.MotionKit);
