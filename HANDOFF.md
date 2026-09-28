# HANDOFF — web-motion-graphics skill

> Written 28 Sep 2026 by Claude Code (desktop app, Windows) for the cloud session that continues this work.
> Branch `local-handoff` = `main` at `2beedf2` (the finished, tested v2.0.0 skill) + this file.
> `main` is the public release channel: README links, one-line installers, the jsDelivr CDN and the live demos all read from it, so keep it green.

---

## 1. What the skill is — goal and scope

**web-motion-graphics** is an [Agent Skill](https://agentskills.io) (open `SKILL.md` format). It makes AI assistants add polished, eye-catching motion graphics to every website they build, even when the user never mentions animation. The same folder works in Claude Code (terminal and desktop app), Claude.ai, ChatGPT, OpenAI Codex, Gemini CLI, Google Antigravity, GitHub Copilot and Cursor.

It ships **Motion Kit v2.0.0**, a zero-dependency animation library that is switched on with HTML `data-*` attributes:

- 30 scroll reveals and 18 text effects (particle headlines, masked reveals, glitch, neon, typewriter, scramble, rotating words, 3D flip…)
- 21 animated backgrounds: WebGL fluid simulation, AI orb, lava-lamp blobs, light beams, wormhole, liquid gradient, 3D globe, galaxy, warp grid, flow field, particles, stars, synthwave grid, dots, bokeh, snow, code rain, waves, aurora, mesh gradient, film grain
- Interactions: holographic cards, 3D tilt with depth, magnetic buttons, spotlight grids, flashlight reveal, ring carousel, dock, drag-and-throw, click sparks, ripples, confetti
- Cursors and trails, image trails, hover previews
- Scroll storytelling: stacking cards, expanding media, pinned horizontal galleries, scrollytelling, parallax, velocity skew, scrubbed scenes, colour shifts, progress bar
- Count-up and odometer stats, marquees, SVG line drawing, intro loaders, page transitions, 22 CSS-only utilities

It also includes a Node and a Python CLI that produce identical output. The CLI inlines only the effects a page uses and lints the result.

**Scope:** front-end web motion only — plain HTML, React/Next.js, Vue, Svelte, Astro, Angular and Tailwind. Out of scope: video and motion-design tools, native mobile apps, and back-end code.

## 2. The owner's requirements and preferences (from the conversation)

1. Build a skill that can be uploaded to <https://github.com/Nainesh-Shiyani/motion-graphic-skill-for-website-creation-using-claude>. It should give Claude (Claude.ai) and Claude Code (terminal **and** desktop app) the ability to use many different motion graphics.
2. Whenever someone asks Claude or Claude Code to create a website, the site must use motion graphics from that set.
3. Create the skill, **test it in this environment**, and upload it to GitHub only once it is **fully functional**.
4. Also install it in the owner's own environment.
5. The first version's effects were "so basic". Make them more "insane, good looking and eye catching", and add more **interactive** effects.
6. Quantity: first "20 effects", then "make 30-40 or however much you can make".
7. The skill is not just for Claude: it must also work with **GPT** and **Gemini**.
8. The owner asked to see the coffee-shop sites the AIs built (`examples/ai-built/`).
9. Publishing choice, made on 28 Sep: push the finished skill to `main` **and** create this `local-handoff` branch with `HANDOFF.md`.

**Working rules:**

- Never enter credentials or sign in on the owner's behalf. The owner approves GitHub sign-ins themselves.
- The owner wants as many high-quality features as possible and no regressions, so `npm test` must be fully green before every push.

## 3. File layout

```
skills/web-motion-graphics/             THE SKILL - this folder is what every installer copies / zips
  SKILL.md                              frontmatter (name, description <=1024 chars with trigger phrases, license,
                                        compatibility, metadata.version 2.0.0) + 7-step workflow, showpiece table,
                                        8 motion directions, quick reference, principles, reference index
  LICENSE.txt                           MIT (inside the skill so uploads carry it)
  agents/openai.yaml                    Codex / ChatGPT display metadata, allow_implicit_invocation: true
  references/motion-directions.md       11 hero recipes (A-K), section recipes, page-level extras, anti-patterns
  references/effects-catalog.md         every attribute / option / value, 30 presets, 17 text modes, 21 backgrounds,
                                        JS API (reinit, shaderBg, defineBg, burst...), gotchas
  references/frameworks.md              boot snippet; plain HTML; React + Next.js (useMotionKit hook); Vue/Svelte/
                                        Astro/Angular; Tailwind; Claude.ai; coding agents; CDN; ChatGPT/Gemini chat
  references/advanced.md                GSAP + ScrollTrigger/SplitText, Three.js, Lenis, Motion for React,
                                        View Transitions, custom backgrounds (defineBg / shaderBg)
  scripts/motion-kit.mjs                Node 16+ CLI: list | inline [--all|--modules|--no-min] | link | bundle |
                                        react | check | detect | boot
  scripts/motion_kit.py                 Python 3.8+ standard-library twin, byte-identical output
  assets/icon.svg                       icon for Codex/ChatGPT UIs
  assets/src/core.js, core.css          runtime: module registry, shared IntersectionObserver / scroll tick / ticker
                                        (pauses off-screen), reduced motion, ready gate for loaders, MotionKit API
  assets/src/manifest.json              56 modules: files, trigger attrs / classes / JS calls, allowed values, deps.
                                        Drives the CLI tree-shaking AND the linter.
  assets/src/modules/*.js|css           reveal, text, text-scramble, text-typewriter, text-rotate, text-fx,
                                        text-particles, circle-text, counter, parallax, scroll, story, scrollfx,
                                        magnetic, tilt, spotlight, ripple, holo, cursor, trail, image-trail, widgets
                                        (carousel/dock/drag), marquee, draw, loader, transition, confetti, bg (runner)
  assets/src/modules/effects/*.css      CSS-only utility classes: ambient, text, surface, hover, interactive
  assets/src/modules/bg/*               backgrounds; gl.js = WebGL shader engine used by liquid, fluid (WebGL2
                                        Navier-Stokes), blobs, orb, beams, tunnel; canvas: globe, galaxy, warp, flow,
                                        particles, stars, waves, matrix, grid, dots, bokeh, snow; CSS: aurora,
                                        gradient, noise
  assets/min/                           esbuild-minified copy of src (what `inline` embeds)   [generated, committed]
  assets/dist/motion-kit[.min].js|css   full prebuilt bundles for CDN / `link`                  [generated, committed]
.claude-plugin/marketplace.json         Claude Code plugin marketplace "motion-graphics" -> plugin
                                        "web-motion-graphics" (source "./")
gemini-extension.json                   Gemini CLI extension manifest (Gemini picks up skills/)
install.sh / install.ps1                installers: claude -> ~/.claude/skills, agents -> ~/.agents/skills,
                                        antigravity -> ~/.gemini/config/skills (+ ~/.gemini/antigravity-cli/skills
                                        if present); --uninstall / -Uninstall; remote mode downloads main.zip
dist/web-motion-graphics.zip            upload file for Claude.ai / ChatGPT (reproducible build) [generated, committed]
examples/showcase/index.html            broad demo of the kit
examples/wow/index.html                 showpiece demo: fluid hero, AI orb, globe, stacking cards, wormhole...
examples/ai-built/*/index.html          coffee-shop sites built by Codex (GPT) and Antigravity (Gemini) with the skill
docs/*.jpg                              README screenshots (tools/readme-shots.mjs)
tools/build.mjs                         minify src -> assets/min, build assets/dist
tools/package.mjs                       build dist/web-motion-graphics.zip (fixed timestamps)
tools/manifest.mjs                      manifest load/save/upsert helpers
tools/gen-land.mjs                      regenerates the globe's land bitmap (Natural Earth via world-atlas)
tools/serve.mjs                         static dev server: node tools/serve.mjs 5178
tools/readme-shots.mjs                  captures docs/*.jpg with headless Chrome (needs serve.mjs running)
tests/run-cli-tests.mjs                 33 CLI + packaging + Agent Skills spec tests
tests/run-python-parity.mjs             98 checks that the Python CLI output is byte-identical (runs it in Pyodide)
tests/run-kit-tests.mjs                 headless Chrome/Edge suites (see section 7)
tests/screens.mjs                       screenshot helper for visual review
tests/lib/browser.mjs                   tiny DevTools-protocol driver (no Puppeteer/Playwright)
tests/fixtures/*.html                   kit-suite, fx-suite, loader, pt-a / pt-b (page transitions),
                                        advanced (docs snippets), bg-gallery
package.json / package-lock.json        dev dependencies only (esbuild, pyodide); scripts build / test / test:quick /
                                        land / serve
README.md, LICENSE (MIT), .gitattributes (LF everywhere, CRLF for .ps1), .gitignore
HANDOFF.md                              this file (only on local-handoff)
```

To add an effect:

1. Write `assets/src/modules/<name>.js` (and a `.css` if needed).
2. Register it in `assets/src/manifest.json`, with the attributes or classes that trigger it and their allowed values.
3. Document it in `references/effects-catalog.md`, plus a recipe in `motion-directions.md` if it fits one.
4. Run `npm run build && npm test`.

## 4. Already done

- **Skill and runtime**
  - The skill folder is complete and matches the Agent Skills spec. Tests check the name, description length, compatibility length and allowed frontmatter keys.
  - Motion Kit v2.0.0: 56 modules, 100+ effects (see section 1), reduced-motion support and off-screen pausing throughout.
- **Tooling**
  - Node and Python CLIs: `inline` (tree-shaken, idempotent, with markers), `link`, `bundle`, `react` (hook plus `.d.ts`), `check` (linter with "did you mean" suggestions), `detect`, `boot` and `list`.
  - Packaging for every tool: the Claude Code plugin marketplace (`claude plugin validate .` passes; a local marketplace install/uninstall was tested), the Gemini CLI extension, Codex `openai.yaml`, the upload zip and both one-line installers.
  - Docs: README with install table, try-it prompts, a "tested with real AIs" section and screenshots, plus the 4 reference files.
- **Test results on 28 Sep 2026** (all green):
  - `npm test`: 33/33 CLI and 98/98 Python parity.
  - Browser: 127 in-page tests × 3 build types = 381 tests, plus 9 scenario tests (loaders, docs snippets, React hook, page transitions), with 0 console errors.
- **Real-AI evaluations.** The prompt was *"Create a landing page for my coffee shop Brew Haven in Pune — menu, story, hours and contact. Single index.html."* It never mentions animation.
  - **GPT (OpenAI Codex CLI):** picked the skill on its own, ran `inline` and `check`, and verified the page in headless Chrome. The page used 8 kinds of motion, passed the linter and had 0 console errors.
  - **Gemini (Antigravity CLI, Gemini 3.8 Flash):** read the skill and its recipes, and fixed what the linter flagged. The page used 10 kinds of motion, passed the linter and had 0 console errors.
  - Both sites are in `examples/ai-built/`. They were built with an earlier kit version, and their inlined kit was later refreshed to v2.0.0.
- **Installed on the owner's machine** in all 4 locations (section 9). Each copy was verified identical to the source, and the installed CLI was run end to end. The desktop app listed the skill immediately.
- **Installer fix:** `install.ps1` now splits `-Targets claude,agents` (needed with `powershell -File`). The README now recommends `powershell -ExecutionPolicy Bypass -File .\install.ps1`, because Windows blocks scripts by default.
- **Pushed:** `main` = `2beedf2` "Add web-motion-graphics skill v2.0.0 (Motion Kit)".

## 5. Still left — prioritized checklist

**P1 — verify the release works for real users**

- [ ] Check every public install route against the pushed `main`:
  - `irm .../install.ps1 | iex` and `curl -fsSL .../install.sh | bash`
  - `/plugin marketplace add Nainesh-Shiyani/motion-graphic-skill-for-website-creation-using-claude` then `/plugin install web-motion-graphics@motion-graphics`
  - `gemini extensions install <repo url>`
  - the jsDelivr `@main` URLs in the README and the raw.githack demo links
- [ ] **Fresh-Claude evaluation.** Nothing has been run with Claude yet, because the local `claude` CLI login had expired. Install the skill, open an empty folder and give the prompt above to Claude Code. Pass means:
  - it loads the skill without being told to
  - it runs `inline` and `check`
  - the page has 6–10 effect kinds
  - the linter is clean, there are 0 console errors, and nothing stays invisible after scrolling to the bottom
- [ ] **The owner must do these steps (their accounts):** upload `dist/web-motion-graphics.zip` to Claude.ai (Settings → Capabilities → Skills, with code execution on) and to ChatGPT (Skills), then try the same prompt.

**P2 — hardening**

- [ ] Tag `v2.0.0` and create a GitHub Release with the zip attached. Consider pinning the README CDN links to `@v2.0.0`, because jsDelivr caches branch URLs.
- [ ] Run the Python CLI and the parity suite on real CPython 3.8–3.13. So far the Python CLI has only run in Pyodide, because this machine has no Python.
- [ ] Test `install.sh` on real macOS and Linux. So far it has only been tested in Git Bash on Windows with a fake `HOME`.
- [ ] Cross-browser and device pass, on Safari (macOS and iOS), Firefox and Android Chrome. Check:
  - the WebGL backgrounds and the fluid → aurora fallback
  - page transitions
  - touch behaviour: pointer effects only run on `(hover: hover) and (pointer: fine)`, so check that touch devices still get motion. The test suites have no mobile or touch emulation yet.
- [ ] Add GitHub Actions CI (`ubuntu-latest` has Chrome): `npm ci && npm test`.
- [ ] Optional: GitHub Pages for the demos, plus repo description and topics.

**P3 — growth**

- [ ] More showpiece effects, if the owner wants them. Check `effects-catalog.md` first to avoid duplicates. Ideas:
  - WebGL image hover distortion
  - scroll-scrubbed image sequence or video
  - SVG shape morphing
  - text on a path
  - a before/after slider
  - an infinite draggable canvas gallery
  - shader page transitions
- [ ] A performance budget and auto-degrade for heavy WebGL effects on low-power devices (Lighthouse runs).
- [ ] Optionally publish Motion Kit to npm for people who don't use AI assistants.

## 6. Design decisions and why

1. **The open Agent Skills format, with agent-neutral wording.** One folder then works for every AI. Tool-specific extras exist only where a tool needs them: `openai.yaml`, `gemini-extension.json` and `marketplace.json`.
2. **A trigger-rich description** ("...whenever the user asks to create, build, design... any web page... even if they never mention animation"). Assistants choose skills from the description alone. The GPT and Gemini evaluations confirmed it triggers implicitly.
3. **A zero-dependency, attribute-driven kit instead of GSAP or Three.js.** The AI only adds attributes, so there are few ways to break a page. It works offline and inside sandboxes (Claude.ai and ChatGPT have little or no network access), and there are no licence questions. `advanced.md` still covers GSAP and Three.js for special cases.
4. **Manifest-driven tree-shaking.** It detects attributes, classes, JS calls and attribute values, so single-file pages stay small: about 50 KB for a typical page versus the full kit. The `check` linter catches common AI mistakes:
   - typos in attribute names or values
   - `overflow` on `html`/`body` breaking sticky effects
   - a missing boot snippet
   - transitions on layout properties
   - `@keyframes` without a reduced-motion rule
   - conflicting attributes
   - more than 3 canvas backgrounds
5. **A Python twin of the CLI with byte-identical output.** Chat sandboxes and some machines have no Node. The parity tests enforce it.
6. **Pre-minified and prebuilt assets are committed.** The skill works right after the folder is copied, with no `npm install`.
7. **Progressive enhancement.** The boot snippet adds `html.mk-js`, with a 4-second failsafe, so content is never stuck invisible. Split text keeps screen-reader copies, print styles show everything, and `prefers-reduced-motion` is respected everywhere.
8. **WebGL fallbacks.** Fluid, liquid, blobs, orb, beams and tunnel fall back to aurora when WebGL2 or float render targets are missing.
9. **Resistance to page CSS.** Generated elements use a custom `<mk-span>` tag, so the page's `span {}` rules can't break odometers or split text. Utility classes use doubled selectors so they win on specificity.
10. **Page transitions** use `sessionStorage`, with a `window.name` fallback so they also work on `file://`.
11. **A reproducible zip** (fixed timestamps), so rebuilds don't create noisy diffs.
12. **A tiny DevTools-protocol driver for tests.** No Puppeteer or Playwright download is needed; it uses the installed Chrome or Edge.

## 7. How to test and validate

```bash
npm install                        # esbuild + pyodide (dev only)
npm test                           # build + zip + every suite (~3 min on the owner's PC)
npm run test:quick                 # CLI tests + a quick browser pass
node tests/run-cli-tests.mjs       # 33 CLI / packaging / spec tests
node tests/run-python-parity.mjs   # 98 Python-vs-Node byte-identical checks
node tests/run-kit-tests.mjs       # headless Chrome/Edge (set CHROME_PATH if not found)
node tools/serve.mjs 5178          # then open http://localhost:5178/examples/wow/
claude plugin validate .           # Claude Code plugin marketplace check
```

`run-kit-tests.mjs` covers:

- the kit-suite and fx-suite fixtures × 3 build types (link to dist, `inline --all`, inline detected) × normal and reduced motion
- loaders (curtain, columns, reduced)
- documentation snippets (GSAP, Three.js, custom `shaderBg` plasma)
- the React hook
- page transitions over http, `file://` and columns

It fails on any console error. WebGL runs in SwiftShader (`--enable-unsafe-swiftshader`).

**Real-agent evaluations** (use an empty temporary folder; the prompt is in section 4):

- **Codex:** `codex exec -s danger-full-access --ignore-user-config "<prompt>"`. On Windows the read-only sandbox blocked writes.
- **Antigravity CLI:** `agy -p "<prompt>" --model gemini-3.8-flash-high`
- **Claude Code:** `claude -p "<prompt>"`. This needs a valid login.

Afterwards, run `motion-kit check index.html` on the result. It prints the effect kinds used and any problems. Also open the page and check the console.

## 8. Known problems and open questions

- **No fresh-Claude evaluation yet.** The standalone `claude` CLI's OAuth session had expired on the owner's PC, and nobody logged in on their behalf. Claude Code did list the skill once it was installed.
- **Python only in Pyodide, and `install.sh` only in Git Bash.** See P2.
- **Limited device coverage.** WebGL effects were validated with SwiftShader and with screenshots on one Windows GPU. Safari, iOS, Firefox and Android have not been tested, and neither has mobile or touch emulation.
- **Cursor may list the skill twice**, because it reads both `~/.claude/skills` and `~/.agents/skills`, and the installer fills both.
- **Antigravity skill folders** (`~/.gemini/config/skills` for the IDE, `~/.gemini/antigravity-cli/skills` for the CLI) were confirmed on the versions installed on the owner's PC. Antigravity does **not** read `~/.agents/skills`, and these paths may change in future releases.
- **jsDelivr caches `@main` URLs**, so changes can take hours to appear on the CDN. Pin a tag, or purge via `purge.jsdelivr.net`.
- **This hand-off arrived late.** A scheduled routine fired on 27 Sep at about 8:53 PM IST, but it was only delivered to the local session on 28 Sep at about 11 AM IST. The planned 11:32 PM IST cloud pickup had already passed, so the cloud session may need to be started manually from this branch.

## 9. Where things lived on the owner's machine, and the install/publish plan

**On the owner's Windows PC** (`~` = `%USERPROFILE%`):

- Working copy (a clone of this repo): `~/Downloads/clade code/motion-graphic-skill`
- Dev-server launch config: `~/Downloads/clade code/.claude/launch.json`, entry `motion-kit`, which runs `node motion-graphic-skill/tools/serve.mjs 5178`
- Installed skill copies, installed by `install.ps1` on 28 Sep 2026:
  - `~/.claude/skills/web-motion-graphics` (Claude Code, also read by Cursor)
  - `~/.agents/skills/web-motion-graphics` (Codex, Gemini CLI, Copilot, Cursor)
  - `~/.gemini/config/skills/web-motion-graphics` (Antigravity IDE)
  - `~/.gemini/antigravity-cli/skills/web-motion-graphics` (Antigravity CLI)
- The real-agent evaluations ran in temporary folders; their outputs were copied into `examples/ai-built/`.

**Install and publish plan** (all of these read the `main` branch):

| Channel | How |
|---|---|
| Claude Code | `/plugin marketplace add Nainesh-Shiyani/motion-graphic-skill-for-website-creation-using-claude` then `/plugin install web-motion-graphics@motion-graphics` (marketplace in `.claude-plugin/marketplace.json`), or the installers |
| Claude.ai / ChatGPT | upload `dist/web-motion-graphics.zip` in their Skills settings |
| Codex, Copilot, Cursor | installers → `~/.agents/skills` (or the repo's `.agents/skills`) |
| Gemini CLI | `gemini extensions install https://github.com/Nainesh-Shiyani/motion-graphic-skill-for-website-creation-using-claude` |
| Antigravity | installers → `~/.gemini/config/skills` + `~/.gemini/antigravity-cli/skills` |
| Other chatbots | paste `SKILL.md` into the bot's instructions; the kit loads from jsDelivr (`frameworks.md` §9) |
| No AI | the CDN `<link>`/`<script>` snippet in the README, or the CLI |

## 10. Files not pushed

- `node_modules/`: dev dependencies (esbuild, pyodide). Restore them with `npm install`.
- `tests/.tmp/`: scratch output that the test runs regenerate.
- Nothing else was left out. A scan found no secrets or `.env` files, and the largest file is 333 KB (the zip), so nothing is over 50 MB.

The build outputs `assets/min/`, `assets/dist/` and `dist/web-motion-graphics.zip` are committed on purpose: the installed skill and the README download links need them. Regenerate them with `npm run build`.
