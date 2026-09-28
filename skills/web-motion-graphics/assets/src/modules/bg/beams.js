/* bg: beams - volumetric light rays pouring down from above the section; the source follows the cursor.
 * Best on dark heroes. Options: data-bg-speed="1" */
(function (MK) {
  'use strict';
  MK.shaderBg('beams', {
    maxDpr: 1,
    fs: [
      'void main(){',
      '  vec2 uv=gl_FragCoord.xy/u_res;',
      '  float ar=u_res.x/u_res.y;',
      '  vec2 src=vec2(.5+(u_mouse.x-.5)*.35*u_hover,1.25);',
      '  vec2 d=uv-src;d.x*=ar;',
      '  float ang=atan(d.x,-d.y);',
      '  float dist=length(d);',
      '  float t=u_time*.35;',
      '  float r=pow(.5+.5*sin(ang*14.+t+1.5*sin(ang*5.-t*.7)),8.)*.6;',
      '  r+=pow(.5+.5*sin(ang*23.-t*1.4+2.),14.)*.45;',
      '  r+=pow(.5+.5*sin(ang*7.+t*.5+4.),5.)*.4;',
      '  float n=fbm(vec2(ang*4.,dist*3.-t*1.5));',
      '  float fall=smoothstep(1.9,.2,dist)*smoothstep(1.1,.1,abs(ang));',
      '  float v=r*fall*(.5+.9*n);',
      '  vec3 col=mix(u_c1,u_c2,clamp(uv.x+.3*sin(t),0.,1.));',
      '  col=mix(col,u_c3,n*.35)+vec3(.25)*v;',
      '  gl_FragColor=vec4(col,clamp(v*1.2,0.,1.));',
      '}'
    ].join('\n')
  });
})(window.MotionKit);
