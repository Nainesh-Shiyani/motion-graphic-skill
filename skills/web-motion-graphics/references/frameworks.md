# Using Motion Kit in every environment and AI assistant

`$SKILL` = the directory containing SKILL.md. Every `node $SKILL/scripts/motion-kit.mjs <cmd>` has an identical Python twin: `python3 $SKILL/scripts/motion_kit.py <cmd>` (Python 3.8+, standard library only) - use whichever runtime exists. Section 8 covers "neither".

## Contents
1. The boot snippet
2. Plain HTML (single page / multi-page)
3. React (Vite, CRA) and Next.js
4. Vue / Nuxt, Svelte / SvelteKit, Astro, Angular
5. Server templates (WordPress, Django, Rails, Laravel, PHP) and Tailwind
6. Claude.ai: files, HTML artifacts, React artifacts
7. Coding agents: Claude Code, Codex, Gemini CLI, Antigravity, Copilot, Cursor
8. No Node or Python / CDN
9. Chat assistants: ChatGPT, Gemini, custom GPTs and Gems

## 1. The boot snippet

Hidden "before" states only apply when `<html>` has the class `mk-js`. The boot snippet adds it before first paint (so nothing flashes) and removes it again if the kit fails to load:

```html
<script>/* motion-kit:boot */(function(d){var r=d.documentElement,f=0;r.classList.add('mk-js');try{f=sessionStorage.getItem('mk-pt')}catch(e){}if(f||/(^|\|)mk-pt$/.test(window.name))r.classList.add('mk-pt-in');setTimeout(function(){if(!window.MotionKit)r.classList.remove('mk-js','mk-pt-in')},4000)})(document)</script>
```
`inline` and `link` insert it for you; `node $SKILL/scripts/motion-kit.mjs boot` prints it. Put it as early in `<head>` as possible, before the kit CSS.

## 2. Plain HTML

Single page (also the right choice for "make me a website" with no framework):
```bash
node $SKILL/scripts/motion-kit.mjs inline index.html
node $SKILL/scripts/motion-kit.mjs check index.html
```
Re-run `inline` after every edit that adds/removes effects - it replaces the previous injection and includes only the modules the page uses (`--all` to include everything). Kit CSS is placed before your own styles so your CSS can override it.

Multi-page site:
```bash
node $SKILL/scripts/motion-kit.mjs link *.html --out assets/motion-kit
```
Writes one cached `motion-kit.css/js` (all modules) and links it from every page. Add `<body data-transition="curtain">` to every page for animated navigation.

## 3. React (Vite / CRA) and Next.js

Generate a hook module (tree-shaken to what your components use with `--from`, or everything by default):
```bash
node $SKILL/scripts/motion-kit.mjs react --out src/lib --from src     # writes src/lib/motion-kit-react.js + .d.ts
```
```jsx
// src/App.jsx
import { useMotionKit } from './lib/motion-kit-react';
export default function App() {
  useMotionKit();                       // once, in the root component
  return (
    <main>
      <h1 data-text="reveal">Ship faster</h1>
      <div className="grid" data-motion-children="fade-up">{features.map((f) => <Card key={f.id} {...f} />)}</div>
    </main>
  );
}
```
- Components mounted later (routes, tabs, lazy content) are initialised automatically by the kit's MutationObserver; unmounted ones are cleaned up.
- Re-run the command after adding new kinds of effects (or omit `--from` to include everything).
- To avoid a one-frame flash before hydration, also add the boot snippet to `index.html` `<head>`.
- `data-text`, `data-marquee` and `data-horizontal` rewrite their children. Use them on static content; if the text comes from state, add `key={text}` so React remounts the element instead of patching nodes the kit replaced.

**Next.js (App Router)** - the hook must run in a client component:
```tsx
// app/motion.tsx
'use client';
import { useMotionKit } from '@/lib/motion-kit-react';
export default function Motion() { useMotionKit(); return null; }
```
```tsx
// app/layout.tsx
import Motion from './motion';
const BOOT = "document.documentElement.classList.add('mk-js');setTimeout(function(){if(!window.MotionKit)document.documentElement.classList.remove('mk-js')},4000)";
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: BOOT }} /></head>
      <body>{children}<Motion /></body>
    </html>
  );
}
```
`suppressHydrationWarning` on `<html>` is needed because the boot script adds a class before React hydrates. Alternative without the hook: `bundle --out public`, then `<link rel="stylesheet" href="/motion-kit.css">` in `<head>` and `<Script src="/motion-kit.js" strategy="afterInteractive" />` from `next/script`.

**Pages Router**: same component in `_app.tsx`, boot script in `_document.tsx` `<Head>`.

**Framer Motion / Motion for React** is also fine for component-level choreography (layout animations, exit animations, drag). Use Motion Kit for page-level scroll/background/text effects and don't animate the same element with both.

## 4. Vue / Nuxt, Svelte / SvelteKit, Astro, Angular

Write static files once:
```bash
node $SKILL/scripts/motion-kit.mjs bundle --out public          # Vite/Vue/Nuxt/Astro/Next "public", SvelteKit "static", Angular "src/assets"
```
Then add to the HTML shell's `<head>` (index.html, `app.html`, `nuxt.config` `app.head`, Astro layout, Angular `index.html`):
```html
<!-- boot snippet from section 1 -->
<link rel="stylesheet" href="/motion-kit.css">
<script src="/motion-kit.js" defer></script>
```
Use the attributes in templates as usual (`<h1 data-text="reveal">`). Client-side navigation is handled automatically. Astro View Transitions: add `document.addEventListener('astro:page-load', () => window.MotionKit && MotionKit.refresh())`. Vue `v-for` lists: put `data-motion-children` on the list container.

## 5. Server templates and Tailwind

- WordPress / Django / Rails / Laravel / PHP: `bundle --out <static dir>`, then include the boot snippet, CSS and deferred script in the base template/theme header. Attributes survive any templating language.
- Tailwind (v3 and v4) works as-is: keep Tailwind classes for layout/colour and add Motion Kit attributes for motion. Define the palette in CSS (`:root { --mk-c1: theme(colors.violet.500) }` in v3, or `var(--color-violet-500)` in v4). Tailwind v4 `translate-*`/`scale-*` utilities and reveal presets share the `translate`/`scale` properties - put `data-motion` on a wrapper if an element also uses those utilities.

## 6. Claude.ai

Skills run with code execution, so the CLI works the same way:
1. Write the site to a file, e.g. `/mnt/user-data/outputs/index.html` (Node and Python are available in the sandbox).
2. `node $SKILL/scripts/motion-kit.mjs inline /mnt/user-data/outputs/index.html` then `check` it.
3. Share the file. If you render an **HTML artifact** instead, `cat` the inlined file and use its full contents as the artifact - never re-type kit code by hand.

Artifact rules: external scripts only from `https://cdnjs.cloudflare.com` (the kit needs none); other hosts (Google Fonts, image CDNs, jsDelivr/unpkg) may be blocked, so prefer system font stacks, inline SVG and CSS gradients for visuals.

**React artifacts**: generate the hook and paste it at the top of the artifact file:
```bash
node $SKILL/scripts/motion-kit.mjs react --modules reveal,text,counter,bg-aurora    # prints the module to stdout
```
Keep the `import { useEffect } from 'react'` line, drop the `export` keywords (or keep them - they are harmless), and call `useMotionKit()` inside the default-exported component. Pass `--modules` for exactly the effects you use to keep the artifact small (`node $SKILL/scripts/motion-kit.mjs list` shows names). For motion-heavy marketing pages an HTML artifact is usually the better choice.

## 7. Coding agents: Claude Code, Codex, Gemini CLI, Antigravity, Copilot, Cursor

All of these run on the user's machine with a shell, so use the CLI exactly as in sections 2-5 (Node if `node -v` works, otherwise Python).
- Preview: open the HTML file or start a static server (e.g. `npx serve` / `python3 -m http.server`) in the tool's browser/preview pane, scroll through, check the console.
- Headless check without a browser: `check` catches configuration mistakes; for visual verification any Playwright/Puppeteer/Chrome `--headless --screenshot` run works.
- Windows: use `node` (Python is often not installed; the `python` command may just open the Microsoft Store).
- Publishing an artifact from Claude Code: publish the already-inlined HTML file.

## 8. No Node or Python / CDN

Copy the prebuilt files next to the page and link them:
```html
<head>
  <!-- boot snippet from section 1 -->
  <link rel="stylesheet" href="motion-kit.min.css">
  <script src="motion-kit.min.js" defer></script>
</head>
```
Files: `$SKILL/assets/dist/motion-kit.min.css` + `motion-kit.min.js` (all modules, ~142 KB, ~43 KB gzipped) or the readable `motion-kit.css/js`. For a single self-contained file, paste the CSS into a `<style>` in `<head>` and the JS into a `<script>` at the end of `<body>`.

Public CDN (real websites, not Claude.ai artifacts), served from the skill's GitHub repo:
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/Nainesh-Shiyani/motion-graphic-skill-for-website-creation-using-claude@main/skills/web-motion-graphics/assets/dist/motion-kit.min.css">
<script src="https://cdn.jsdelivr.net/gh/Nainesh-Shiyani/motion-graphic-skill-for-website-creation-using-claude@main/skills/web-motion-graphics/assets/dist/motion-kit.min.js" defer></script>
```
Prefer local copies for production (versioned, offline-safe); pin a tag instead of `@main` if you use the CDN.

## 9. Chat assistants: ChatGPT, Gemini, custom GPTs and Gems

- **ChatGPT with skills** (the skill uploaded under Skills): code runs in a Python sandbox, so use `python3 $SKILL/scripts/motion_kit.py inline /mnt/data/index.html`, then offer the file for download. For a canvas/preview, paste the full inlined file.
- **Gemini** (Gemini CLI, Antigravity) loads the same SKILL.md; follow section 7. In the Gemini app/Canvas without file access, use the CDN option below.
- **Custom GPTs, Gemini Gems, or any assistant where the skill text was pasted but files can't be read or run**: write the page with Motion Kit attributes and load the kit from the CDN in `<head>`:
  ```html
  <script>document.documentElement.classList.add('mk-js');setTimeout(function(){if(!window.MotionKit)document.documentElement.classList.remove('mk-js')},4000)</script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/Nainesh-Shiyani/motion-graphic-skill-for-website-creation-using-claude@main/skills/web-motion-graphics/assets/dist/motion-kit.min.css">
  <script src="https://cdn.jsdelivr.net/gh/Nainesh-Shiyani/motion-graphic-skill-for-website-creation-using-claude@main/skills/web-motion-graphics/assets/dist/motion-kit.min.js" defer></script>
  ```
  This loads every effect (about 43 KB gzipped). Preview sandboxes that block external scripts show the page without motion; the downloaded file works in any browser.
