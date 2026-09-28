# Going beyond Motion Kit

Use these when the user asks for something the kit doesn't cover: 3D objects, complex timelines, pinned multi-stage scenes with many layers, physics, smooth-scroll hijacking, or component-level React animation. They mix fine with Motion Kit - just never animate the same element with two systems.

All URLs below were verified. Claude.ai artifacts only load scripts from `cdnjs.cloudflare.com`, so the cdnjs links work everywhere; unpkg/jsDelivr links are for real websites.

## Contents
1. GSAP + ScrollTrigger + SplitText
2. Three.js 3D hero
3. Lenis smooth scrolling
4. Motion (Framer Motion) for React
5. View Transitions API
6. Custom canvas / shader backgrounds on the Motion Kit engine
7. Performance and accessibility checklist for custom motion

## 1. GSAP + ScrollTrigger + SplitText

GSAP (all plugins free since 3.13). Best for scroll-scrubbed timelines with pinning, sequencing many elements, and precise easing.

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/gsap.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/ScrollTrigger.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/SplitText.min.js"></script>
<script>
gsap.registerPlugin(ScrollTrigger, SplitText);
const mm = gsap.matchMedia();
mm.add('(prefers-reduced-motion: no-preference)', () => {
  // pinned product scene: scroll scrubs a multi-step timeline
  const tl = gsap.timeline({
    scrollTrigger: { trigger: '.scene', start: 'top top', end: '+=2400', scrub: 1, pin: true }
  });
  tl.from('.scene .phone', { scale: 0.6, rotate: -12, opacity: 0 })
    .to('.scene .bg', { backgroundColor: '#0b0b12' }, '<')
    .from('.scene .caption', { y: 40, opacity: 0, stagger: 0.3 })
    .to('.scene .phone', { xPercent: -60 });

  // masked headline
  const split = SplitText.create('.hero h1', { type: 'words', mask: 'words' });
  gsap.from(split.words, { yPercent: 110, duration: 1, ease: 'expo.out', stagger: 0.06 });
});
</script>
```
npm: `npm i gsap` then `import { gsap } from 'gsap'; import { ScrollTrigger } from 'gsap/ScrollTrigger';` (React: `@gsap/react`'s `useGSAP` hook for cleanup).
Tips: animate `x/y/scale/rotation/opacity`; call `ScrollTrigger.refresh()` after images load; pinning, like Motion Kit's sticky effects, fails under `overflow: hidden` ancestors.

## 2. Three.js 3D hero

For a real 3D object (product, logo, abstract shape, particle globe). Keep it to one canvas per page.

Claude.ai artifact / plain script (UMD build r128):
```html
<canvas id="gl" style="position:absolute;inset:0;width:100%;height:100%"></canvas>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script>
(function () {
  const canvas = document.getElementById('gl');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.z = 7;
  const mesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.8, 1),
    new THREE.MeshStandardMaterial({ color: 0x7c5cff, metalness: 0.55, roughness: 0.25, flatShading: true })
  );
  scene.add(mesh, new THREE.AmbientLight(0xffffff, 0.35));
  const key = new THREE.PointLight(0x22d3ee, 2.2); key.position.set(4, 3, 5); scene.add(key);
  const rim = new THREE.PointLight(0xff5ca8, 1.6); rim.position.set(-4, -2, 3); scene.add(rim);
  let mx = 0, my = 0, visible = true;
  addEventListener('pointermove', (e) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);
  function size() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  new ResizeObserver(size).observe(canvas); size();
  (function loop(t) {
    if (visible) {
      mesh.rotation.y = t * 0.0003 + mx * 0.8;
      mesh.rotation.x = my * 0.6;
      renderer.render(scene, camera);
    }
    if (!reduce) requestAnimationFrame(loop);
  })(0);
})();
</script>
```
Real projects: `npm i three` (or `https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.module.min.js` in a `<script type="module">`), and `@react-three/fiber` + `@react-three/drei` in React. Load GLTF models with `GLTFLoader` (module build only).

## 3. Lenis smooth scrolling

Inertia scrolling for agency/portfolio sites. Not in cdnjs, so not for Claude.ai artifacts.
```html
<link rel="stylesheet" href="https://unpkg.com/lenis@1.3.4/dist/lenis.css">
<script src="https://unpkg.com/lenis@1.3.4/dist/lenis.min.js"></script>
<script>
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const lenis = new Lenis({ autoRaf: true });
}
</script>
```
Motion Kit reads normal scroll events, so it keeps working with Lenis. With GSAP: `lenis.on('scroll', ScrollTrigger.update)`.

## 4. Motion (Framer Motion) for React

For component-level motion: mount/unmount (`AnimatePresence`), layout animations, shared-element transitions, drag, gestures.
```bash
npm i motion
```
```jsx
import { motion, AnimatePresence } from 'motion/react';
<motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} />
<motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} />
```
Use `useReducedMotion()` to tone it down. Page-level effects (backgrounds, text splitting, marquees, counters) are still simpler with Motion Kit's `useMotionKit()`.

## 5. View Transitions API

- Multi-page: `<body data-transition="view">` (Motion Kit injects `@view-transition { navigation: auto; }` with a fade/slide).
- Same-page state changes (filters, tabs, theme switch):
```js
function update(fn) { document.startViewTransition ? document.startViewTransition(fn) : fn(); }
```
Name elements for shared-element morphs: `.card-42 { view-transition-name: card-42; }`.

## 6. Custom canvas / shader backgrounds on the Motion Kit engine

Register your own `data-bg` type and get resizing, DPR capping, off-screen pausing, pointer tracking and reduced-motion handling for free:
```js
MotionKit.defineBg('rings', {
  canvas: true,
  create(env) {                    // env: { el, layer, canvas, ctx, colors, opt(name, fb), pointer:{x,y,nx,ny,active}, w, h }
    return {
      resize(w, h) {},
      frame(t, dt) {
        const { ctx, w, h, colors } = env;
        ctx.clearRect(0, 0, w, h);
        for (let i = 0; i < 6; i++) {
          ctx.strokeStyle = colors[i % colors.length];
          ctx.globalAlpha = 0.5 - i * 0.07;
          ctx.beginPath();
          ctx.arc(w / 2, h / 2, 40 + i * 50 + Math.sin(t / 900 + i) * 12, 0, Math.PI * 2);
          ctx.stroke();
        }
      },
      still() { this.frame(0, 16); }   // drawn once for reduced motion
    };
  }
});
MotionKit.refresh();   // if the page already has data-bg="rings" elements
```
Register it inside a `DOMContentLoaded` listener so it works whether the kit is inlined or linked. `webgl: true` gives you `env.gl` instead of `env.ctx`.

**Custom GLSL shader in one call** - `MotionKit.shaderBg(name, { fs, uniforms, maxDpr })` compiles a full-screen fragment shader with the standard uniforms `u_res`, `u_time` (seconds), `u_mouse` (0-1, eased), `u_hover` (0-1 while the cursor is over it), `u_c1..u_c3` (palette) plus `hash()`, `noise()` and `fbm()` helpers, and handles resizing, pausing, reduced motion and the aurora fallback:
```js
document.addEventListener('DOMContentLoaded', function () {
  MotionKit.shaderBg('plasma', {
    uniforms: { u_zoom: function (env) { return env.opt('zoom', 3); } },   // data-bg-zoom="3"
    fs: [
      'uniform float u_zoom;',
      'void main(){',
      '  vec2 uv = gl_FragCoord.xy / u_res * u_zoom;',
      '  float n = fbm(uv + vec2(u_time * .2, 0.) + u_mouse * u_hover);',
      '  gl_FragColor = vec4(mix(u_c1, u_c2, n) + u_c3 * pow(n, 4.), 1.);',
      '}'
    ].join('\n')
  });
});
```
`<section data-bg="plasma" data-bg-zoom="4">` then renders it. See `assets/src/modules/bg/*.js` (liquid, blobs, orb, beams, tunnel) for more shader examples.

## 7. Checklist for any custom motion

- Animate only `transform`, `opacity`, `filter`, `clip-path`; never `top/left/width/height/margin`.
- One `requestAnimationFrame` loop per effect, paused when off-screen (`IntersectionObserver`) and when `document.hidden`.
- Cap canvas DPR at 2 (WebGL shaders at 1 or less); resize with `ResizeObserver`.
- Wrap everything in `prefers-reduced-motion: no-preference` (CSS media query or `matchMedia`), with a meaningful still state.
- Content must be visible and usable without JavaScript and before animations run.
- Test on a narrow viewport: disable pointer-only effects on touch (`(hover: hover) and (pointer: fine)`).
