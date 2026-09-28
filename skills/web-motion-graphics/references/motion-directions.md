# Motion directions and recipes

How to pick motion that fits the brand, plus copy-paste markup for heroes and common sections.
All snippets assume the Motion Kit is installed (`motion-kit.mjs inline|link|bundle|react`).

## Contents
1. Choosing a direction
2. Tempo presets (CSS variables)
3. Hero recipes (11)
4. Section recipes (logos, stats, features, testimonials, gallery, process, pricing, FAQ, CTA, footer)
5. Page-level extras (loader, cursor, progress bar, transitions)
6. Anti-patterns

## 1. Choosing a direction

Ask (silently, from the request and brand): *Who is the audience? What should they feel in the first 3 seconds? How dense is the content?*

- Premium / calm brands -> fewer, slower, softer effects; lots of `clip-up`, `img-zoom`, masked text.
- Energetic / youthful brands -> faster, bigger, more interaction (magnetic, marquees, cursor).
- Trust-critical brands (finance, health, legal, government) -> subtle fades, counters, clear hierarchy. No cursor, loader, confetti or glitch text.
- Content-heavy pages (docs, blogs, dashboards) -> reveals only on section headings and cards; never on paragraphs; no loader.
- If the user named a vibe ("futuristic", "minimal", "playful", "like Apple", "like Stripe"), that wins over the site-type default.

Mix at most two directions (e.g. "warm + elegant" for a fine-dining restaurant).

## 2. Tempo presets

Put one of these in `:root` next to the palette. `--mk-dur` is the default duration of reveals and text effects.

```css
/* calm & elegant */     :root { --mk-dur: 1200ms; --mk-ease: cubic-bezier(.22, 1, .36, 1); }
/* warm / corporate */   :root { --mk-dur: 900ms; }                         /* default */
/* bold & energetic */   :root { --mk-dur: 650ms; --mk-ease: cubic-bezier(.2, .9, .1, 1); }
/* playful */            :root { --mk-dur: 800ms; --mk-ease: cubic-bezier(.34, 1.56, .64, 1); }
```

Palette -> effects: `--mk-c1` (primary), `--mk-c2` (secondary), `--mk-c3` (highlight), `--mk-accent` (cursor, glows, button fills).
On light sites choose saturated-but-not-neon colors and lower background opacity (`--mk-aurora-opacity: .35`).

## 3. Hero recipes

### A. Centered statement (SaaS, AI, startups) - tech direction
```html
<header class="hero" data-bg="liquid noise" style="--mk-liquid-opacity:.55; --mk-noise-opacity:.08">
  <span class="eyebrow" data-motion="blur-in">Now in public beta</span>
  <h1 data-text="reveal">Ship <span class="mk-gradient-text">10x faster</span> with AI agents</h1>
  <p data-text="blur" data-text-delay="450">Short supporting sentence that explains the product.</p>
  <div class="ctas" data-motion-children="fade-up" data-motion-stagger="120">
    <a class="btn primary mk-btn-fill" data-magnetic href="#start">Start free</a>
    <a class="btn ghost mk-border-beam" href="#demo">Watch demo</a>
  </div>
  <img class="product-shot" data-scrub="tilt-3d" src="app.png" alt="Dashboard">
</header>
```
Swap `liquid` for `warp` or `particles` (developer tools), `dots` (minimal SaaS), `beams` (dramatic launch) or `grid` (web3).

### B. Showstopper (creative studios, launches, AI, "make it insane" requests) - bold/tech
```html
<header class="hero" data-bg="fluid">
  <span class="eyebrow" data-motion="blur-in">Move your cursor</span>
  <h1 data-text="particles" data-text-color="palette">MAKE IT MOVE</h1>
  <p data-motion="fade-up" data-motion-delay="600">One line that says what you do, with a <b data-text="glitch">glitch</b> word.</p>
  <button class="btn primary" data-burst data-magnetic>Start</button>
  <a class="badge" href="#next" data-circle-text="scroll · to · explore · " style="width:130px;height:130px">↓</a>
</header>
```
Pair with `<body data-cursor="blob" data-cursor-trail="glow">`. Keep the particle headline short (1-3 words) and big (80px+).

### C. AI product - tech direction
```html
<section class="hero split">
  <div class="orb" data-bg="orb" style="height:480px"></div>
  <div>
    <h1 data-text="flip">Say hello to Nova</h1>
    <p data-motion="fade-up">Your always-on research assistant.</p>
    <p class="status" data-text="neon" data-text-loop style="--mk-neon:#ff4fd8">Listening…</p>
  </div>
</section>
```

### D. Split hero with rotating words (local business, cafe, services) - warm direction
```html
<header class="hero split" data-bg="bokeh" style="--mk-c1:#c8782f; --mk-c2:#f2c14e; --mk-c3:#8b4513">
  <div>
    <h1 data-text="reveal">Fresh <span data-text="rotate" data-words="coffee|pastries|brunch|vibes">coffee</span><br>every morning</h1>
    <p data-motion="fade-up" data-motion-delay="400">Roasted in-house, served with love in Pune since 2015.</p>
    <a class="btn mk-btn-fill" data-magnetic data-burst href="#menu">See the menu</a>
  </div>
  <div data-motion="img-zoom" data-motion-delay="200"><img src="hero.jpg" alt="Latte art"></div>
</header>
```

### E. Giant type (agency, studio, streetwear, events) - bold direction
```html
<header class="hero" data-bg="gradient noise">
  <h1 class="huge" data-text="explode">WE MAKE NOISE</h1>
  <p data-motion="skew-up" data-motion-delay="300">Brand, web and motion for restless companies.</p>
  <div data-marquee data-marquee-scroll data-velocity class="mk-marquee-fade">
    <span>Branding</span><span>✦</span><span>Web</span><span>✦</span><span>Motion</span><span>✦</span>
  </div>
</header>
```
Pair with `<body data-cursor="blend" data-transition="columns">`.

### F. Editorial (luxury, fashion, architecture, photography) - calm direction
```html
<div data-loader="curtain"><span class="brand">MAISON</span></div>
<header class="hero">
  <p class="eyebrow" data-motion="fade" data-motion-delay="200">Autumn / Winter 2026</p>
  <h1 data-text="reveal" data-text-stagger="110">Quiet luxury, made by hand</h1>
  <figure data-motion="blinds" data-motion-duration="1400"><img src="look.jpg" alt=""></figure>
</header>
<section data-expand><img src="campaign.jpg" alt=""><h2>The collection</h2></section>
```
Pair with `<body data-cursor>` and `.mk-link` / `data-text="roll"` navigation.

### G. Creative portfolio - portfolio direction
```html
<div data-loader="columns"><span data-loader-count>0</span></div>
<header class="hero" data-bg="flow" data-image-trail="w1.jpg|w2.jpg|w3.jpg|w4.jpg">
  <p data-text="typewriter" data-words="Designer|Developer|3D artist">Designer</p>
  <h1 data-text="particles">ARJUN</h1>
  <nav class="socials" data-dock><a data-magnetic href="#">GH</a><a data-magnetic href="#">IG</a><a data-magnetic href="#">X</a></nav>
</header>
<ul class="projects" data-hover-image>
  <li data-hover-image="p1.jpg"><a href="/p1" data-text="roll">Aurora Bank</a></li>
  <li data-hover-image="p2.jpg"><a href="/p2" data-text="roll">Prism Studio</a></li>
</ul>
```
With `<body data-cursor="blob" data-transition="columns">`.

### H. Gaming / esports - gaming direction
```html
<header class="hero" data-bg="tunnel" style="--mk-c1:#130a3a; --mk-c2:#7c5cff; --mk-c3:#ff4fd8">
  <h1 data-text="glitch" data-text-loop>ENTER THE ARENA</h1>
  <p data-motion="zoom-blur" data-motion-delay="600">Season 7 starts Friday.</p>
  <a class="btn mk-glow mk-gradient-border" data-magnetic data-burst href="#join">Join the tournament</a>
</header>
<section class="roster" data-carousel="16" style="height:420px"> ...character cards with data-holo... </section>
```
`stars` (space), `grid` (retro) or `matrix` (hacker theme) are good alternatives. Add `<body data-cursor-trail="comet">`.

### I. Global SaaS / fintech / logistics - tech or corporate
```html
<section class="hero" data-bg="globe" data-bg-x="0.72" data-bg-drag>
  <h1 data-text="reveal">Payments in 190 countries</h1>
  <div class="stats" data-motion-children="fade-up">
    <div><b data-count-to="190" data-count-style="odometer" data-count-suffix="+">190+</b> countries</div>
    <div><b data-count-to="99.99" data-count-style="odometer" data-count-suffix="%">99.99%</b> uptime</div>
  </div>
</section>
```

### J. Corporate / trust - corporate direction
```html
<header class="hero">
  <h1 data-text="fade">Financial planning you can <span data-text="highlight">actually understand</span></h1>
  <p data-motion="fade-up" data-motion-delay="300">Certified advisors. Transparent fees.</p>
  <a class="btn mk-hover-lift" href="#book">Book a free call</a>
</header>
```

### K. Playful app / kids / pets - playful direction
```html
<header class="hero" data-bg="blobs">
  <h1 data-text="wave">Hello, Buddy!</h1>
  <p data-motion="drop" data-motion-delay="300">The app that makes walks twice as fun.</p>
  <button class="btn mk-hover-wiggle" data-confetti data-magnetic>Get the app</button>
  <span class="sticker" data-drag="spring">🐾 drag me</span>
  <img class="mascot mk-float" data-mouse-parallax="20" src="dog.svg" alt="">
</header>
```
With `<body data-cursor-trail="sparkle">`.

## 4. Section recipes

**Logo strip / ticker**
```html
<div data-marquee data-marquee-speed="40" data-marquee-pause class="mk-marquee-fade" style="--mk-gap:4rem">
  <img src="logo1.svg" alt="Acme"> <img src="logo2.svg" alt="Globex"> <img src="logo3.svg" alt="Initech">
</div>
```

**Stats** (odometer digits roll like a slot machine)
```html
<div class="stats" data-motion-children="fade-up">
  <div><b data-count-to="250" data-count-style="odometer" data-count-suffix="k+">250k+</b> customers</div>
  <div><b data-count-to="4.9" data-count-style="odometer">4.9</b>/5 rating</div>
  <div><b data-count-to="12" data-count-prefix="$" data-count-suffix="M">$12M</b> saved</div>
</div>
```

**Feature grid** (spotlight follows the cursor across all cards)
```html
<h2 data-text="reveal">Everything you need</h2>
<div class="grid" data-spotlight="group" data-motion-children="rise-3d">
  <article class="card">...</article> <article class="card">...</article> <article class="card">...</article>
</div>
```
Set `--mk-spot` / `--mk-spot-border` to tint the glow. On light themes use a soft color like `rgba(124,92,255,.10)`.

**Holographic cards / pricing tiers / memberships**
```html
<div class="cards" data-motion-children="rise-3d" data-motion-stagger="140">
  <div class="card" data-holo data-tilt="14"><div data-tilt-depth="30" class="chip"></div><h3 data-tilt-depth="60">Legendary</h3></div>
  <div class="card mk-border-beam" data-holo data-tilt="14">...</div>
</div>
```

**Process / how it works** - stacking cards (each pins, the covered ones shrink):
```html
<div data-stack>
  <article class="step">01 Connect ...</article>
  <article class="step">02 Customize ...</article>
  <article class="step">03 Launch ...</article>
</div>
```
Or scrollytelling with a sticky visual:
```html
<section data-steps class="how">
  <div class="mk-sticky mk-steps-stack visual">
    <img data-step-target="0" src="s1.png" alt=""><img data-step-target="1" src="s2.png" alt=""><img data-step-target="2" src="s3.png" alt="">
  </div>
  <div class="text">
    <div data-step><h3>Connect</h3><p>...</p></div>
    <div data-step><h3>Customize</h3><p>...</p></div>
    <div data-step><h3>Launch</h3><p>...</p></div>
  </div>
</section>
```

**Big statement** (Apple-style scroll lighting, or outlined text that fills)
```html
<section class="statement"><p data-text="scroll">We believe great software should feel invisible, fast and kind.</p></section>
<h2 class="giant" data-scrub="text-fill">BUILT DIFFERENT</h2>
```

**Full-screen moment** - `<section data-expand><video src="reel.mp4" autoplay muted loop playsinline></video><h2>Watch the reel</h2></section>`

**Gallery / case studies** - `data-carousel` (3D ring, drag to spin), `data-horizontal` (pinned sideways scroll), or a grid with `data-motion-children="img-zoom"`.

**Testimonials** (two vertical columns moving in opposite directions)
```html
<div class="columns" style="height:560px; display:grid; grid-template-columns:1fr 1fr; gap:24px">
  <div data-marquee data-marquee-direction="up" data-marquee-pause class="mk-marquee-fade">...cards...</div>
  <div data-marquee data-marquee-direction="down" data-marquee-pause class="mk-marquee-fade">...cards...</div>
</div>
```

**Teaser / mystery / easter egg** - `<section data-flashlight="240">` with big gradient text inside.

**Team / services** - `<div class="mk-accordion">` panels that expand on hover, or `mk-flip-card` cards with bio on the back.

**Timeline / roadmap** - an SVG line with `data-draw="scroll"` beside `data-motion-children="fade-left"` items.

**FAQ** - `<details>` elements inside `data-motion-children="fade-up"`; keep the answers un-animated.

**Final CTA**
```html
<section class="cta" data-bg="beams">
  <svg data-draw viewBox="0 0 400 60"><path d="M5 40 C 80 5, 160 60, 240 25 S 360 10, 395 35" stroke="currentColor" fill="none"/></svg>
  <h2 data-text="reveal">Ready when you are</h2>
  <a class="btn mk-btn-fill" data-magnetic data-confetti href="#signup">Get started</a>
</section>
```

**Footer** - giant outlined wordmark in a slow `data-marquee`, links with `data-text="roll"`, a `data-dock` row of social icons.

**Page background shifts** - give sections `data-page-color="#0b0b10"` / `"#f5f1ea"` (+ `data-page-text`) and keep their own background transparent: the whole page smoothly changes mood as you scroll.

## 5. Page-level extras

- `<div data-scroll-progress></div>` right after `<body>` - thin gradient reading bar; great for long pages and blogs.
- `<body data-cursor>` (or `="blob"`) and `data-cursor-trail` - only for creative / portfolio / agency / gaming sites. Never on forms-heavy or trust sites.
- Loader - only when the page has a strong brand moment (portfolio, luxury, launch). Keep `data-loader-min` under ~1200ms.
- `<body data-transition="curtain">` on every page of a multi-page site (use `link` mode). `view` uses native View Transitions (Chrome/Edge/Safari 18) with graceful no-op elsewhere.
- Smooth anchor scrolling: `html { scroll-behavior: smooth }` inside `@media (prefers-reduced-motion: no-preference)`.

## 6. Anti-patterns (don't)

- Every element fading up. Group them.
- Three different text effects in one hero.
- Particles + liquid + stars on one screen, or more than one WebGL background visible at once.
- Particle / glitch / neon / proximity text on anything longer than a short headline.
- Motion that delays reading: stagger chains longer than ~1s, loaders longer than ~1.5s, typewriters on long sentences.
- Background effects that reduce text contrast below WCAG AA - dim the layer or add an overlay.
- Hover-only information (tilt glare, spotlight) that hides meaning from touch users.
- `overflow: hidden` on body, `transition: all`, or animating layout properties.
