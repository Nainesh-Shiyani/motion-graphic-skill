# Motion Kit effects catalog

Every attribute, option, CSS variable and JS hook. Durations accept `600`, `600ms` or `0.6s`.

## Contents
1. Global setup (palette, tempo, boot snippet, reduced motion)
2. Scroll reveals - `data-motion` (30 presets)
3. Text - `data-text` (17 modes) + circular text
4. Counters - `data-count-to` (+ odometer)
5. Parallax and velocity
6. Scroll-linked - progress, `data-scrub`, page color
7. Storytelling - horizontal, steps, stack, expand
8. Pointer and touch interactions
9. Cursor effects
10. Marquee
11. SVG drawing
12. Backgrounds - `data-bg` (21 types)
13. Loader, page transitions, confetti and bursts
14. CSS-only classes
15. JavaScript API and events
16. Gotchas

## 1. Global setup

```css
:root {
  --mk-c1: #7c5cff;  --mk-c2: #22d3ee;  --mk-c3: #ff4fd8;   /* palette used by backgrounds, gradients, trails, particles */
  --mk-accent: #7c5cff;                                      /* cursor, glows, button fills, proximity tint */
  --mk-dur: 900ms;                                           /* default reveal/text duration */
  --mk-ease: cubic-bezier(.16, 1, .3, 1);                    /* default easing (expo out) */
}
```
- The CLI (`inline` / `link`) adds a tiny boot script to `<head>` that sets `html.mk-js` before first paint. Hidden "before" states only apply under `.mk-js`, so without JavaScript every element is simply visible. It also self-heals: if the kit never loads, `mk-js` is removed after 4s.
- Reduced motion (`prefers-reduced-motion: reduce`, or `<html data-motion-reduce>`): reveals and text show instantly, counters show their final value, marquees become scrollable rows, backgrounds render one still frame, particle/cursor/trail effects are skipped, CSS loops stop.
- `window.MotionKitConfig = { reduced, finePointer, debug, autoStart }` before the kit loads overrides detection (`autoStart: false` then call `MotionKit.start()` yourself).
- Generated pieces (split letters, odometer digits, decorative layers) are `<mk-span>` elements, so page CSS written for `span` never restyles them.

## 2. Scroll reveals - `data-motion`

Plays once when the element's top enters the viewport (8% above the bottom edge).

| Preset | Motion |
|---|---|
| `fade` | opacity |
| `fade-up` (default), `fade-down`, `fade-left`, `fade-right` | opacity + 40px travel in that direction |
| `zoom-in` / `zoom-out` | grows from 0.86 / shrinks from 1.14 |
| `zoom-blur` | zooms down from 1.28 while un-blurring (cinematic) |
| `blur-in` | un-blurs while rising slightly |
| `flip-up` / `flip-left` | 3D hinge from the bottom / left edge |
| `swing` | swings down from a top hinge like a sign |
| `rise-3d` | tilted back in 3D, rises and stands up (cards, product shots) |
| `rotate-in` | small rotation + rise |
| `skew-up` | rises with a skew (bold / editorial) |
| `stretch` | squashed vertically, springs to full height |
| `pop` | springy scale-up (icons, badges) |
| `drop` | falls from above with a little bounce |
| `slide-up` | rises a full element height |
| `glitch` | jittery RGB-slice glitch, then settles (tech, gaming) |
| `clip-up`, `clip-down`, `clip-left`, `clip-right` | wipe reveal (images, colored blocks, big titles) |
| `clip-circle` | circular iris reveal |
| `diagonal` | diagonal wipe |
| `split` | opens from the vertical center line outwards |
| `blinds` / `shutter` | 8 vertical / horizontal slats open (images, posters) |
| `img-zoom` | wipe up while zooming out (hero / gallery images) |

Options on the element: `data-motion-delay`, `data-motion-duration`, `data-motion-distance="80"` (px or any length), `data-motion-ease="smooth|snappy|bounce|in-out|linear|<cubic-bezier(...)>"`, `data-motion-repeat` (re-plays each time it re-enters).

Groups: `data-motion-children="zoom-in"` on a parent gives every direct child that preset and staggers them (90ms default, `data-motion-stagger="140"`). A plain `data-motion-stagger` parent staggers any `[data-motion]` children that enter together. Total stagger is capped at ~1s.

Uses the independent `translate` / `scale` / `rotate` CSS properties, so your own `transform` survives - except `flip-*`, `swing`, `rise-3d` and `skew-up`, which briefly use `transform`. When finished the element gets `.mk-done` and the animation is removed, so your hover transitions work normally.

## 3. Text - `data-text`

| Mode | Effect | Best for |
|---|---|---|
| `reveal` | words slide up from a mask, staggered | hero headlines, section titles |
| `fade` | words fade/rise in sequence | subtitles, calm brands |
| `blur` | words un-blur in sequence | tech / AI subtitles |
| `chars` | letters pop in with a spring | short bold titles |
| `flip` | letters flip up in 3D one by one | bold titles, launches |
| `wave` | letters bob continuously | playful titles (short!) |
| `scroll` | words brighten as you scroll | one big statement paragraph |
| `highlight` | marker sweep behind the text (`--mk-highlight` color) | key phrase inside a heading |
| `scramble` | random glyphs resolve to the text; `data-text-trigger="hover"` replays on hover | labels, nav links, gaming, security |
| `typewriter` | types the text; with `data-words="a|b|c"` types, deletes and cycles | role lists, prompts |
| `rotate` | `data-words="a|b|c"` slide vertically, width animates | "We build for [startups]" |
| `particles` | headline rebuilt from thousands of particles that fly in and scatter away from the cursor; `data-text-color="palette"` for a gradient; `data-text-density`, `data-text-radius` | the one big hero word(s) |
| `glitch` | RGB-split glitch bursts on reveal and hover; `data-text-loop` keeps glitching | gaming, cyber, music |
| `neon` | flickers on like a neon sign, then glows in `--mk-neon`; `data-text-loop` adds an occasional buzz | dark sections, nightlife, gaming |
| `explode` | letters scatter on hover and spring back | playful headings, CTAs |
| `roll` | letters roll to a copy of themselves on hover (also when the parent link/button is hovered) | nav links, buttons |
| `proximity` | letters swell and tint toward the cursor like a magnifier; `data-text-scale="1.6"`, `data-text-radius="140"`, `data-text-weight="300 900"` for variable fonts | interactive hero words |

Options: `data-text-delay`, `data-text-duration`, `data-text-stagger` (ms between words/letters), `data-text-ease`; typewriter `data-text-speed="60"`, `data-text-pause="1600"`, `data-text-loop`, `data-text-nocaret`; rotate `data-text-interval="2200"`; scramble `data-text-chars="01"`.

Notes: inline markup (`<em>`, `<a>`, `<br>`) is preserved; `.mk-gradient-text` spans and any nested `data-text` element (except `highlight`) travel as a single unit, so you can nest a `rotate` or `glitch` word inside a `reveal` headline. A hidden `.mk-sr` copy keeps the sentence readable for screen readers. Keep split text to headlines - never whole paragraphs (except `scroll`).

**Circular text badge** - `<a href="#work" data-circle-text="Scroll * to * explore * " style="width:130px;height:130px">↓</a>`: the text runs around a circle that rotates, spins faster while scrolling and on hover; children stay centered. Options `data-circle-speed="1"`, `data-circle-size="0.11"`.

## 4. Counters - `data-count-to`

`<span data-count-to="12500" data-count-prefix="$" data-count-suffix="+">$12,500+</span>`

Options: `data-count-from="0"`, `data-count-duration="2000"`, `data-count-decimals` (inferred from the target, e.g. `4.9`), `data-count-separator=","` (`""` for none), `data-count-delay`. `data-count-style="odometer"` turns every digit into a rolling strip like a slot machine (each digit settles at a different moment). Numbers use tabular figures so the layout doesn't jitter.

## 5. Parallax and velocity

- `data-parallax="0.3"` - moves at a different speed than the scroll (positive = slower/behind, negative = faster/in front, typical 0.1-0.5). `data-parallax-axis="x"` for sideways drift.
- `data-mouse-parallax="25"` - follows the pointer up to N px (negative = opposite). Layer decorative shapes at different depths (10 / 25 / -40). Desktop only.
- `data-velocity="1"` - skews (and slightly stretches) the element with scroll speed, settling when scrolling stops. Great on huge headings, image strips and marquees. Uses `transform`.
Parallax writes the `translate` property; don't combine these with `data-motion` on the same element (wrap it).

## 6. Scroll-linked

- `<div data-scroll-progress></div>` - fixed gradient bar at the top (3px, `--mk-c1..3`). Give it children or the class `mk-progress-custom` to style it yourself; it gets `scale: <progress> 1`. `data-scroll-progress="#article"` tracks one element.
- `:root` receives `--mk-scroll` (0..1 page progress) once the module is active.
- `data-scrub="<preset>"` - styles driven by scroll position:
  `scale-in` (0.84 -> 1 as it enters), `fade-in`, `slide-left` / `slide-right`, `rotate` (+-12deg across the pass), `spin` (full turn), `zoom-out` (1.28 -> 1, put on an image inside an `overflow:hidden` frame), `tilt-3d` (laid-back product shot that stands up), `blur-in`, `clip` (rounded inset that opens up), `text-fill` (outlined text fills with the palette gradient as you scroll - huge headings).
- Bare `data-scrub` only exposes `--mk-p` (0..1 while crossing the whole viewport) and `--mk-enter` (0..1 while entering) for your own CSS.
- `data-page-color="#0b0b10"` on sections (+ optional `data-page-text="#fff"`): while the section crosses the middle of the screen the whole page background (and text color) fades to it; leave those sections' own background transparent.

## 7. Storytelling

**Horizontal gallery** - `<section data-horizontal data-horizontal-gap="24">` with panel children. The section becomes as tall as the sideways distance, pins its content (`position: sticky`) and translates it while you scroll vertically. Exposes `--mk-p`. Reduced motion: native horizontal scroller with snap.

**Steps (scrollytelling)** - `<section data-steps>` containing `[data-step]` blocks and `[data-step-target="N"]` visuals. The step crossing the middle of the viewport gets `.mk-active` (others dim), its matching target fades in, and the section gets `data-active-step="N"` + `--mk-step: N`. Helpers: `.mk-sticky` (sticky at 12vh) and `.mk-steps-stack` (stacks children in one grid cell).

**Stacking cards** - `<div data-stack>` with card children: each card pins below the previous one (`data-stack-top="90"`, `data-stack-offset="16"` px) and cards that get covered shrink and dim. Gap between cards: `--mk-stack-gap` (22vh). Give cards a solid background.

**Expanding media** - `<section data-expand><img src="..." alt=""><h2>Overlay</h2></section>`: the section pins for `data-expand="250"` vh; the first `img/video/picture/canvas` (or `[data-expand-media]`) grows from a rounded framed card to full screen, and the other children fade in on top near the end. Reduced motion: shown full-bleed, not pinned.

## 8. Pointer and touch interactions (pointer-only effects auto-disable on touch and for reduced motion)

- `data-magnetic="0.35"` - pulled toward the cursor while hovered (0.2 subtle - 0.6 strong).
- `data-tilt="10"` - 3D tilt up to N degrees; `data-tilt-glare` adds a moving sheen; `data-tilt-scale="1.03"`, `data-tilt-perspective="900"`. Children with `data-tilt-depth="40"` float that many px above the card in 3D. Sets inline `transform` while active.
- `data-holo` - holographic foil: rainbow sheen + sparkles that shift with the cursor angle (pair with `data-tilt`). `--mk-holo-opacity` (.75). On touch screens it shimmers by itself.
- `data-spotlight` - radial glow + glowing 1px border that follows the cursor inside the element; `="group"` on a grid spans every child card. Tint: `--mk-spot`, `--mk-spot-border`.
- `data-flashlight="220"` - the section is dark except for a soft light (radius px) that follows the cursor and wanders by itself until the cursor arrives (`data-flashlight-still` to disable). Custom cover: put your own `[data-flashlight-cover]` element inside (e.g. a grayscale image over a color one). `--mk-flash-cover` sets the overlay color.
- `data-ripple` - click ripple in `currentColor` (touch too). `data-burst` - radial spark burst from the click point (touch too).
- `data-dock="1.8"` - macOS-dock magnification on a row (or column) of icons/links; `data-dock-range="150"`.
- `data-drag` - drag and throw with inertia, bouncing inside the parent; `data-drag="spring"` springs back home. Works with touch.
- `data-carousel="12"` - children form a 3D ring that auto-rotates (deg/s, `0` = off); drag/swipe to spin with inertia; hover pauses. `data-carousel-gap="24"`. Give the element a height (min 360px). Reduced motion: a flat wrapping row.

## 9. Cursor effects (desktop only)

- `<body data-cursor>` - trailing ring; `="dot"` hides the native cursor and shows dot + ring; `="blend"` big difference-blend circle; `="blob"` liquid gooey blob chain. Links/buttons/`[data-cursor-hover]` enlarge it; `data-cursor-text="View"` shows a label. Color: `--mk-cursor`.
- `<body data-cursor-trail="glow">` - neon ribbon that tapers and fades; `="sparkle"` twinkling stars; `="comet"` bright head with a particle tail. Palette: `--mk-c1..3` or `data-trail-colors`.
- `<section data-image-trail="a.jpg|b.jpg|c.jpg">` - moving across the section leaves a trail of tilted images (`data-image-trail-size="220"`, `data-image-trail-gap="90"`). Images sit behind the section content.
- `<ul data-hover-image> <li data-hover-image="p1.jpg">...</li> </ul>` - a floating preview follows the cursor over the list, tilting with its speed and cross-fading between items (`data-hover-image-size="320"` on the list).

## 10. Marquee - `data-marquee`

```html
<div data-marquee data-marquee-speed="60" data-marquee-direction="left" data-marquee-pause data-marquee-scroll class="mk-marquee-fade" style="--mk-gap:3rem">
  <span>Item</span><span>Item</span>
</div>
```
Children are cloned (clones are `aria-hidden` + `inert`) until the row is seamless. `-direction`: `left|right|up|down` (vertical needs a fixed height). `-pause` eases to a stop on hover; `-scroll` speeds up and flips with scroll direction. Pauses off-screen. Reduced motion: static, scrollable row.

## 11. SVG drawing - `data-draw`

`<svg data-draw>` draws every stroked `path/line/polyline/polygon/circle/ellipse/rect` when it enters the viewport. `data-draw="scroll"` scrubs with scroll. Options: `data-draw-duration="1800"`, `data-draw-stagger="120"`, `data-draw-delay`, `data-draw-fill`. Shapes need a `stroke`.

## 12. Backgrounds - `data-bg`

Add to any section (the layer sits behind its content; the section gets `position: relative; isolation: isolate` unless you set position yourself) or to `<body>` / any element with `data-bg-fixed` for a fixed full-viewport layer. Stack several: `data-bg="aurora noise"` (left = bottom). Dim any layer with `--mk-bg-opacity`.

| Type | Look | Engine | Options |
|---|---|---|---|
| `aurora` | big soft color blobs drifting | CSS | `--mk-aurora-opacity` (.6), `--mk-aurora-speed` |
| `gradient` | rotating blurred mesh gradient | CSS | `--mk-gradient-opacity`, `--mk-gradient-speed` |
| `noise` | animated film grain overlay | CSS | `--mk-noise-opacity` (.14) |
| `particles` | drifting dots joined by lines, cursor links | canvas | `data-bg-density`, `-speed`, `-link="130"`, `-interact="grab|repel|none"` |
| `stars` | warp-speed starfield | canvas | `-speed`, `-density` (dark sections) |
| `waves` | layered flowing waves at the bottom | canvas | `-layers="3"`, `-amp`, `-speed`, `-height="0.45"` |
| `dots` | dot matrix that swells near the cursor | canvas | `-gap="28"`, `-radius="170"` |
| `grid` | synthwave perspective grid | canvas | `-speed`, `-horizon="0.45"`, `-lines="22"` |
| `bokeh` | glowing orbs breathing and drifting | canvas | `-count="16"`, `-speed` |
| `snow` | falling particles; `data-bg-rise` floats them up | canvas | `-density`, `-speed` |
| `matrix` | falling code rain in `--mk-c1` | canvas | `-size="16"`, `-speed`, `-chars="01"` |
| `globe` | rotating 3D dotted Earth (real continents) with glowing arcs and pulses; tilts to the cursor | canvas | `-speed`, `-arcs="10"`, `-size="1"`, `-x="0.5"`, `-y="0.5"` (center), `data-bg-drag` (spin by dragging) |
| `galaxy` | spiral galaxy of thousands of glowing stars in 3D | canvas | `-arms="3"`, `-speed`, `-density`, `-tilt="62"` |
| `warp` | glowing grid bending around the cursor like gravity (wanders when idle) | canvas | `-gap="38"`, `-strength`, `data-bg-repel` |
| `flow` | generative flow-field particle trails; the cursor stirs a vortex | canvas | `-density`, `-speed`, `-trail="0.06"` |
| `liquid` | flowing liquid/silk gradient | WebGL | `-speed`, `-scale="1.6"`, `--mk-liquid-opacity` (.6) |
| `fluid` | real-time fluid simulation: cursor/finger swirls glowing ink ("splash cursor"), gentle auto-splashes when idle | WebGL2 | `-fade="1.2"`, `-curl="28"`, `-radius="0.22"`, `data-bg-auto="false"` |
| `blobs` | lava-lamp metaballs; the cursor adds a blob | WebGL | `-speed`, `-size` |
| `orb` | glowing swirling AI orb, leans toward and swells under the cursor | WebGL | `-speed`, `-size` |
| `beams` | volumetric light rays from above following the cursor | WebGL | `-speed` |
| `tunnel` | neon wormhole flying toward the viewer | WebGL | `-speed` |

Colors: `data-bg-colors="#hex,#hex,#hex"` or `--mk-c1..3` on the element or `:root`. Every layer pauses off-screen and in hidden tabs, caps pixel density and resizes automatically; WebGL types fall back to `aurora` when WebGL is unavailable. Browsers allow a limited number of live WebGL contexts (~8-16), so keep WebGL backgrounds to a few per page.

## 13. Loader, page transitions, confetti and bursts

**Loader** - `<div data-loader="curtain" data-loader-min="900"> ...logo... <span data-loader-count>0</span> </div>` as the first element in `<body>`. Types: `fade`, `curtain` (slides up), `split` (opens from the middle), `circle` (iris closes), `columns` (five bars wipe up in sequence). Style with `--mk-loader-bg` / `--mk-loader-fg` or your own CSS. Entrance animations wait until it leaves (`motionkit:ready`). Failsafe: `data-loader-max="5000"`.

**Page transitions** - `<body data-transition="curtain">` on every page. Types: `fade`, `curtain`, `slide`, `columns`, `view` (native cross-document View Transitions). Color: `--mk-pt-bg`. Opt out per link with `data-no-transition`; `target=_blank`, downloads, modifier-clicks and same-page `#hash` links are ignored. Works on `file://` pages too.

**Confetti** - `data-confetti` on a button, `data-confetti="view"`, `data-confetti-colors`, or `MotionKit.confetti({ x, y, count, spread, power, colors })`. **Sparks** - `data-burst` (click point) or `MotionKit.burst({ x, y, count: 26, colors })`.

## 14. CSS-only classes

| Class | Effect |
|---|---|
| `mk-float`, `mk-float-slow` | gentle bobbing (stagger with `--mk-float-delay: -2s`) |
| `mk-spin-slow` | 24s rotation (badges, rings) |
| `mk-pulse` | soft scale/opacity pulse |
| `mk-glow` | pulsing accent glow |
| `mk-blob` | organic morphing border-radius (set a background) |
| `mk-ping` | radar ping behind a dot ("live" badges) |
| `mk-bounce` | small vertical bounce (scroll arrows) |
| `mk-scroll-hint` | animated mouse icon (hero bottom) |
| `mk-gradient-text` | flowing `--mk-c1..3` gradient text |
| `mk-shine` | light sweep across text (`--mk-shine-base`, `--mk-shine-hi`) |
| `mk-gradient-border` | rotating conic gradient border (`--mk-surface` = card background) |
| `mk-border-beam` | a bright arc of light travels around the border (`--mk-beam-width`, `--mk-beam-speed`) |
| `mk-shimmer` | skeleton loading shimmer |
| `mk-glass` | frosted glass surface |
| `mk-hover-lift` / `mk-hover-grow` | lift + shadow / scale on hover |
| `mk-link` | underline grows from the left on hover/focus |
| `mk-btn-fill` | color sweeps in from the left (`--mk-fill`) |
| `mk-btn-shine` | light glint sweeps across on hover |
| `mk-hover-wiggle` | playful wiggle on hover |
| `mk-flip-card` | first child = front, last child = back; flips in 3D on hover/focus (add `tabindex="0"`) |
| `mk-accordion` | row of panels; the hovered/focused one expands (stacks on phones) |

Utility selectors are doubled internally (`.mk-x.mk-x`) where needed so they beat your component classes (`.card { background }`).

## 15. JavaScript API and events

```js
MotionKit.refresh();            // re-scan the DOM (after big client-side changes; usually automatic)
MotionKit.destroy(el);          // tear down effects inside el
MotionKit.reinit('bg', el);     // rebuild one module on one element (e.g. after changing its attributes)
MotionKit.stats();              // { reveal: 12, text: 3, ... } initialised instances
MotionKit.confetti({ x, y });   MotionKit.burst({ x, y });
MotionKit.reduced;              // true when reduced motion is active
MotionKit.splitText(el, 'words' | 'chars'); // returns the unit elements (build custom effects)
MotionKit.onScroll(fn), MotionKit.inView(el, fn, opts), MotionKit.ticker(el, fn) // helpers for custom effects
```
Events (bubble, prefixed `motionkit:`): `start`, `ready` (after loader), `revealed`, `text`, `counted`, `drawn`, `step` (`detail.index`).
Custom backgrounds: `MotionKit.defineBg('myfx', { canvas: true, create(env) { return { frame(t, dt) {...} }; } })`, or a full-screen GLSL shader in one call: `MotionKit.shaderBg('myshader', { fs: 'void main(){ gl_FragColor = vec4(u_c1 * fbm(gl_FragCoord.xy / u_res * 3. + u_time), 1.); }' })` - uniforms `u_res`, `u_time`, `u_mouse`, `u_hover`, `u_c1..u_c3` and `hash/noise/fbm` helpers are provided. See [advanced.md](advanced.md).

## 16. Gotchas

- `position: sticky` (horizontal, steps, stack, expand, `.mk-sticky`) fails inside any ancestor with `overflow: hidden|auto|scroll`. Use `overflow-x: clip` on `body`.
- Don't put `data-motion` on an element that also has `data-parallax`, `data-mouse-parallax`, `data-magnetic`, `data-tilt` or `data-velocity` - wrap one of them.
- Elements with `display: none` at load reveal the moment they become visible (they are observed, not skipped).
- In React/Vue, split text / marquees / horizontal / stack / expand / carousel restructure their children: use them on static content, or give the element a `key` that changes with its content.
- `data-text="particles"` needs the font loaded to sample the glyph shapes; it rebuilds automatically when web fonts finish loading.
- Scripts from other hosts are blocked in Claude.ai artifacts; the kit is always inlined there, so it keeps working.
