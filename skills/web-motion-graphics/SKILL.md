---
name: web-motion-graphics
description: Adds eye-catching motion graphics to every website you build - 30 scroll reveals, kinetic type (particle text, glitch, neon, typewriter, scramble, 3D flip), 21 animated backgrounds incl. WebGL fluid simulation, AI orb, 3D globe, galaxy, lava-lamp blobs, light beams and wormhole, plus holographic cards, 3D tilt, magnetic buttons, cursor trails, 3D carousels, stacking cards, odometer counters, loaders and page transitions. Ships a zero-dependency Motion Kit driven by HTML data-attributes with Node and Python CLIs that inline only the effects a page uses and lint the result. Use this skill whenever the user asks to create, build, design, redesign or improve a website, landing page, homepage, portfolio, SaaS/product page, restaurant/event/business site or any web page (HTML, React, Next.js, Vue, Svelte, Astro, Tailwind) - even if they never mention animation - and whenever they ask for animations, scroll effects, interactive or wow effects, or a more alive, modern or premium feel.
license: MIT (see LICENSE.txt)
compatibility: Agent Skills standard - works in Claude (Claude.ai, Claude Code terminal and desktop), ChatGPT and Codex, Gemini CLI and Antigravity, GitHub Copilot and Cursor. Helper CLI needs Node.js 16+ or Python 3.8+; without either, use the prebuilt files in assets/dist.
metadata:
  version: "2.0.0"
  author: Nainesh Shiyani
  repository: https://github.com/Nainesh-Shiyani/motion-graphic-skill-for-website-creation-using-claude
---

# Web Motion Graphics

Modern websites feel alive: headlines assemble from particles, ink swirls behind the cursor, sections reveal as you scroll, cards shimmer like holographic foil, numbers roll like an odometer. This skill makes that the default for every site you build, using **Motion Kit** - a zero-dependency animation library you drive with HTML attributes - so you spend your effort on choreography and taste instead of re-writing animation code each time.

`$SKILL` below means the directory that contains this SKILL.md (your tool usually tells you the skill's base directory when it loads; on Claude.ai it is under `/mnt/skills/`). Wherever a command says `node $SKILL/scripts/motion-kit.mjs`, you can use `python3 $SKILL/scripts/motion_kit.py` instead - same commands, identical output.

## Workflow for every website task

1. **Design and build the site first** - layout, copy, typography, color, responsive CSS. Motion amplifies good design; it never replaces it. Set the brand palette as Motion Kit variables in `:root` so every effect matches:
   `:root { --mk-c1: #7c5cff; --mk-c2: #22d3ee; --mk-c3: #ff4fd8; --mk-accent: #7c5cff; }`
2. **Choose a motion direction** that fits the brand (table below; full recipes with copy-paste markup in [references/motion-directions.md](references/motion-directions.md)). Read that file the first time you use this skill in a conversation.
3. **Choreograph with the five layers** - aim for 6-10 distinct kinds of motion per page, including **at least one showpiece** from the list below, not one effect everywhere:
   | Layer | What | Typical attributes |
   |---|---|---|
   | Entrance | hero headline + staggered hero content (optional loader) | `data-text="reveal"` / `"particles"`, `data-motion-children`, `data-loader` |
   | Ambient | one living background behind the hero (maybe one more section) | `data-bg="fluid"`, `"liquid"`, `"globe"`, `"aurora"`... |
   | Scroll | section titles, cards and images reveal; stats count up; cards stack | `data-motion`, `data-motion-children`, `data-count-to`, `data-stack` |
   | Interaction | buttons, cards, links and the cursor respond | `data-magnetic`, `data-tilt` + `data-holo`, `data-spotlight="group"`, `data-cursor-trail`, `data-text="roll"` |
   | Signature moment | one memorable set-piece | `data-carousel`, `data-expand`, `data-horizontal`, `data-flashlight`, `data-text="scroll"` |
4. **Add Motion Kit attributes** to the markup (quick reference below; every option in [references/effects-catalog.md](references/effects-catalog.md)).
5. **Install the kit** with the CLI (pick the row for your situation):

   | Situation | Command |
   |---|---|
   | Single HTML file (most requests; also chat-app artifacts/canvases) | `node $SKILL/scripts/motion-kit.mjs inline index.html` |
   | Multi-page static site | `node $SKILL/scripts/motion-kit.mjs link index.html about.html --out assets/motion-kit` |
   | React / Next.js | `node $SKILL/scripts/motion-kit.mjs react --out src/lib` then call `useMotionKit()` once in the root component |
   | Vue, Nuxt, Svelte, Astro, Angular, WordPress, Django... | `node $SKILL/scripts/motion-kit.mjs bundle --out public` + the head snippet it prints |

   `inline` embeds only the modules the page uses and is safe to re-run after every edit (it replaces its previous injection). Framework details, Next.js SSR, chat-app artifacts and per-assistant notes (Claude, ChatGPT, Codex, Gemini, Copilot, Cursor) are in [references/frameworks.md](references/frameworks.md). **No Node or Python?** Copy `$SKILL/assets/dist/motion-kit.min.css` and `motion-kit.min.js` next to the page, link them in `<head>` (script with `defer`) and add the boot snippet from the frameworks reference.
6. **Verify**: run `node $SKILL/scripts/motion-kit.mjs check <file-or-folder>` and fix every error (it catches misspelled presets with "did you mean", a missing kit, sticky-breaking `overflow: hidden`, conflicting attributes, missing reduced-motion rules). If you can open a browser (preview pane, Playwright, headless Chrome), load the page, scroll to the bottom, confirm there are no console errors and no content left invisible, and look at a screenshot of the hero.
7. **Tell the user in one or two lines** what motion you added and how to tone it down (e.g. remove `data-bg`, change `data-motion="fade-up"` to `fade`).

In chat apps (Claude.ai, ChatGPT, Gemini), write the page to a file, run `inline` (or `python3 ... inline`) on it, and share that file. If you render the page as an HTML artifact/canvas instead, run `inline` on a scratch file first and put the resulting file's full contents in the artifact - never re-type kit code by hand.

## Showpieces - reach for these to make a site unforgettable

| Effect | Markup | Best for |
|---|---|---|
| Fluid "splash cursor" | `<header data-bg="fluid">` (or on `<body>` for the whole page) | creative, AI, gaming, agencies; any dark hero |
| Particle headline | `<h1 data-text="particles" data-text-color="palette">` | short bold hero titles (1-3 words) |
| 3D dotted globe with arcs | `<section data-bg="globe" data-bg-x="0.7" data-bg-drag>` | SaaS, fintech, logistics, travel, "global" brands |
| AI orb | `<div data-bg="orb" style="height:480px">` | AI assistants, voice apps, futuristic products |
| Holographic foil cards | `<div class="card" data-holo data-tilt="12">` + `data-tilt-depth="40"` on inner parts | pricing tiers, collectibles, memberships, NFTs, team cards |
| Lava-lamp blobs / light beams / wormhole / galaxy | `data-bg="blobs"`, `"beams"`, `"tunnel"`, `"galaxy"` | playful, dramatic, gaming, space |
| Stacking cards | `<div data-stack>` + cards | process steps, features, case studies |
| Media that expands to full screen | `<section data-expand><img ...><h2>...</h2></section>` | product launches, portfolios, hotels, cars |
| 3D ring carousel | `<div data-carousel>` + 6-10 cards/images | galleries, products, testimonials |
| Flashlight reveal | `<section data-flashlight="240">` | teasers, launches, easter eggs, mysterious brands |
| Cursor trails / blob cursor | `<body data-cursor-trail="glow">`, `<body data-cursor="blob">` | portfolios, agencies, gaming, creative tools |
| Rolling odometer stats | `<b data-count-to="190" data-count-style="odometer">190</b>` | stats rows on any business site |
| Image trail / hover previews | `data-image-trail="a.jpg|b.jpg"`, `<ul data-hover-image><li data-hover-image="p.jpg">` | portfolios, studios, fashion, photographers |

Pick one or two showpieces per page. On trust-first sites (finance, health, legal, government) prefer the quiet ones: odometer stats, globe, stacking cards.

## Motion directions (pick one, stay consistent)

| Direction | Fits | Tempo | Hero text | Background | Reveals | Interaction | Signature |
|---|---|---|---|---|---|---|---|
| Calm & elegant | luxury, fashion, architecture, photography, spa, wedding | slow (1.1-1.4s) | `reveal` | `aurora`/`bokeh` low opacity + `noise` | `fade-up`, `clip-up`, `img-zoom`, `blinds` | `mk-link`, ring cursor, `data-hover-image` | curtain loader, `data-expand`, horizontal gallery |
| Warm & friendly | restaurant, cafe, bakery, local business, NGO, school | medium | `reveal` + `rotate` | `waves` or `bokeh` | `fade-up`, `pop`, `drop` | `mk-hover-lift`, `mk-btn-fill`, `data-burst` | menu marquee, odometer stats |
| Bold & energetic | agency, sports, fitness, events, music, streetwear | fast (0.6s), `snappy` | `chars` or `explode` | `gradient noise`, `beams` | `skew-up`, `stretch`, `slide-up` | `data-magnetic`, blend cursor, `data-velocity` | scroll-velocity marquee, `data-stack`, columns transitions |
| Tech & futuristic | SaaS, AI, dev tools, crypto, security | medium | `blur`, `scramble`, `glitch` | `fluid`, `liquid`, `orb`, `warp`, `particles` | `blur-in`, `rise-3d`, `zoom-blur` | `data-spotlight="group"`, `mk-border-beam`, `data-holo` | globe, `data-scrub="tilt-3d"` product shot, `data-steps` |
| Playful | kids, games, apps, pets, food delivery, creators | bouncy | `wave`, `particles`, `rotate` | `blobs`, `bokeh`, `snow` + `data-bg-rise` | `pop`, `drop`, `rotate-in` | `data-drag`, `mk-hover-wiggle`, `data-confetti`, sparkle trail | draggable stickers, 3D carousel |
| Corporate & trust | finance, law, healthcare, insurance, B2B | restrained | `fade` or `highlight` | none or subtle `dots`/`globe` | `fade-up` only | `mk-hover-lift`, `mk-link` | odometer stats, `data-steps`, progress bar |
| Creative portfolio | designers, developers, 3D artists, studios | dramatic | `particles` or `reveal` after a counter loader | `fluid`, `liquid`, `flow`, `galaxy` | `clip-up`, `img-zoom`, `diagonal` | blob cursor, `data-image-trail`, `data-text="roll"` nav, magnetic socials, holo cards | `data-expand`, horizontal projects, columns transitions |
| Gaming & esports | games, tournaments, streamers | fast | `glitch`, `scramble`, `neon` | `tunnel`, `grid`, `stars`, `matrix` | `zoom-in`, `glitch`, `skew-up` | holo + tilt cards, `mk-glow`, comet trail | warp-speed hero, 3D carousel of characters |

## Quick reference

Scroll reveals (30 presets): `data-motion="fade | fade-up | fade-down | fade-left | fade-right | zoom-in | zoom-out | blur-in | zoom-blur | flip-up | flip-left | swing | rotate-in | rise-3d | skew-up | stretch | pop | drop | slide-up | glitch | clip-up | clip-down | clip-left | clip-right | clip-circle | diagonal | split | blinds | shutter | img-zoom"`. Options: `data-motion-delay="200"`, `data-motion-duration="1200"`, `data-motion-distance="80"`, `data-motion-ease="smooth|snappy|bounce|in-out"`, `data-motion-repeat`. Grids and lists: `data-motion-children="fade-up"` on the parent (children are staggered automatically; tune with `data-motion-stagger="120"`).

Text (`data-text=`): `reveal` (words rise from a mask - the classic hero), `fade`, `blur`, `chars`, `flip` (3D letters), `wave`, `scroll` (words light up while scrolling), `highlight` (marker sweep), `scramble` (`data-text-trigger="hover"` for nav links), `typewriter` and `rotate` (both take `data-words="startups|creators|brands"`), `particles` (headline made of particles that scatter from the cursor), `glitch`, `neon` (dark bg), `explode` (letters scatter on hover), `roll` (hover roll - links/buttons), `proximity` (letters swell near the cursor). Options: `data-text-delay`, `data-text-stagger`, `data-text-duration`, `data-text-loop`. Circular badge: `<a data-circle-text="Scroll * to * explore * ">↓</a>`.

Numbers: `<span data-count-to="12500" data-count-prefix="$" data-count-suffix="+">$12,500+</span>` (add `data-count-style="odometer"` for rolling digits) - keep the final value as the text so it reads correctly without JavaScript.

Backgrounds (`data-bg=` on any section, or `<body>` for a fixed full-page layer; stack with spaces, e.g. `"aurora noise"`): CSS - `aurora`, `gradient`, `noise`; canvas - `particles`, `stars`, `waves`, `dots`, `grid`, `bokeh`, `snow`, `matrix`, `globe`, `galaxy`, `warp`, `flow`; WebGL - `liquid`, `fluid`, `blobs`, `orb`, `beams`, `tunnel`. Colors come from `--mk-c1..3` or `data-bg-colors="#a,#b,#c"`. Options such as `data-bg-speed`, `data-bg-density`; dim any layer with `--mk-bg-opacity`.

Scroll-linked: `<div data-scroll-progress></div>`, `data-parallax="0.3"`, `data-mouse-parallax="25"`, `data-velocity` (skews with scroll speed), `data-scrub="scale-in | fade-in | slide-left | slide-right | rotate | spin | zoom-out | tilt-3d | blur-in | clip | text-fill"`, `data-page-color="#0b0b10"` (page background shifts per section).

Storytelling: `<section data-horizontal>` (sideways gallery while pinned), `<section data-steps>` with `[data-step]` + `[data-step-target]` (scrollytelling), `<div data-stack>` (stacking cards), `<section data-expand>` (media grows to full screen).

Pointer (auto-off on touch devices): `data-magnetic="0.35"`, `data-tilt="10"` (+ `data-tilt-glare`, `data-tilt-depth` on children), `data-holo`, `data-spotlight` / `="group"`, `data-flashlight`, `data-ripple`, `data-burst` (click sparks), `data-dock` (magnify), `data-drag` / `="spring"`, `data-carousel`, `<body data-cursor="ring|dot|blend|blob">` (+ `data-cursor-text="View"`), `<body data-cursor-trail="glow|sparkle|comet">`, `data-image-trail`, `data-hover-image`.

Other: `<svg data-draw>`, `data-marquee` (+ `-speed`, `-direction`, `-pause`, `-scroll`), `<div data-loader="fade|curtain|split|circle|columns">`, `<body data-transition="fade|curtain|slide|columns|view">`, `data-confetti`.

CSS-only classes: `mk-float`, `mk-float-slow`, `mk-spin-slow`, `mk-pulse`, `mk-glow`, `mk-blob`, `mk-ping`, `mk-bounce`, `mk-scroll-hint`, `mk-gradient-text`, `mk-shine`, `mk-gradient-border` (set `--mk-surface`), `mk-border-beam`, `mk-shimmer`, `mk-glass`, `mk-hover-lift`, `mk-hover-grow`, `mk-link`, `mk-btn-fill`, `mk-btn-shine`, `mk-hover-wiggle`, `mk-flip-card`, `mk-accordion`.

Run `node $SKILL/scripts/motion-kit.mjs list` for the live list of modules and valid values.

## Principles that keep motion tasteful and fast

- **Motion has a job**: guide the eye to the headline, then the CTA, then down the page. If an effect doesn't help hierarchy or delight at a key moment, leave it out.
- **One headline effect, one entrance style per section, one or two backgrounds per page.** Consistency reads as design; variety everywhere reads as a demo reel. (The repo's demo pages deliberately break this rule.)
- **Animate groups, not every node**: put `data-motion-children` on the grid instead of `data-motion` on each card, and never split long body copy into words (the only exception is one `data-text="scroll"` statement).
- **Readable first**: text over a busy background needs contrast - lower `--mk-bg-opacity`, add a dark overlay, or move the effect behind a quieter area. Particle/glitch/neon text only for short, big headlines.
- **Keep the page fast**: the kit only animates transform/opacity/clip-path, pauses canvases off-screen and caps pixel density - don't undo that by animating `width`/`top`/`margin` in your own CSS. Limit canvas/WebGL backgrounds to 1-3 per page (`fluid` counts double).
- **Never trap content**: don't put `overflow: hidden` on `html`/`body` (breaks sticky/pinned effects) - use `overflow-x: clip`. Put `data-motion` on a wrapper when the element already has its own `transform`, parallax, tilt, magnetic or velocity effect.
- **Respect reduced motion**: the kit already shows everything instantly, freezes backgrounds on a still frame and stops loops for users with `prefers-reduced-motion: reduce`. Any extra `@keyframes` you write need the same `@media (prefers-reduced-motion: reduce)` treatment.
- **When the user wants something the kit doesn't do** (3D models, physics, complex timelines, pinned multi-step GSAP scenes, Framer Motion layouts), read [references/advanced.md](references/advanced.md) - GSAP + ScrollTrigger, Three.js, Lenis, Motion for React, custom shaders via `MotionKit.shaderBg`. Mixing them with Motion Kit is fine; just don't animate the same element with both.

## Reference files

- [references/motion-directions.md](references/motion-directions.md) - recipes per site type with ready-made hero, section and footer markup. Read before choosing effects.
- [references/effects-catalog.md](references/effects-catalog.md) - every attribute, option, CSS variable and JS API (`MotionKit.refresh()`, events).
- [references/frameworks.md](references/frameworks.md) - React/Next.js, Vue/Nuxt, Svelte, Astro, Tailwind, WordPress; Claude, ChatGPT/Codex, Gemini, Copilot, Cursor; chat-app artifacts; no-Node fallback.
- [references/advanced.md](references/advanced.md) - GSAP, Three.js, Lenis, Motion for React, View Transitions, custom canvas/shader backgrounds.
- `assets/dist/` - prebuilt full bundles (readable and `.min`); `assets/src/` - module sources and `manifest.json`.
