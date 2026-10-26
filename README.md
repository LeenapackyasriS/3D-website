# BEYCAN: Scroll-controlled 3D hero website

Plain HTML5, CSS3 and vanilla JavaScript. GSAP + ScrollTrigger are loaded from the cdnjs CDN. No framework, no build step.
The hero plays the supplied 192-frame Beybot sequence on a `<canvas>`, driven entirely by scroll position.

## Project structure
```
index.html
css/style.css, css/responsive.css
js/main.js              GSAP/ScrollTrigger pinning, text phases, nav, form, CTAs
js/frame-animation.js   Canvas renderer + progressive frame loader
js/preloader.js         Loading screen
scripts/optimize-frames.py
assets/frames/          original JPEGs  frame-0001.jpg ... frame-0192.jpg (fallback)
assets/frames-webp/     1280x720 WebP   (~15 MB, generated)
assets/frames-mobile/   720x405 WebP    (~6 MB, generated)
```

## Run locally
Browsers can block or restrict image/canvas access when `index.html` is opened via `file://`. Use a local server:

```bash
cd beycan
python3 -m http.server 8000      # then open http://localhost:8000
# or:  npx serve .
```
The GSAP CDN scripts and Google Fonts need an internet connection (the page still works without them: static hero + system fonts).

## Placing the supplied frames
The ZIP's frames were already named `frame-0001.jpg` to `frame-0192.jpg` (192 files, 1280x720, contiguous). They live in `assets/frames/`.
If you replace them with differently named files, rename them to that pattern or edit `FrameAnimation.prototype.framePath` and `TOTAL_FRAMES` (`js/main.js`).

## Optimizing frames (WebP)
```bash
pip install Pillow
python3 scripts/optimize-frames.py
```
Creates `assets/frames-webp/` (desktop) and `assets/frames-mobile/` (phones / Save-Data). The loader uses WebP when supported and falls back per frame to the JPEG original if a WebP is missing or fails.

## How it works
- Timeline progress 0..1 maps linearly to `frameIndex = round(progress * 191)`, clamped to 0..191; the pinned hero is ~280vh on desktop, ~180vh on mobile (`end` in `buildScroll`).
- The first 12 frames load behind the loading screen; the rest stream in (coarse stride pass first, then gaps) with limited concurrency. Each frame is requested once.
- If the requested frame isn't ready, the nearest loaded frame stays on screen (never blank).
- Canvas: DPR capped (2 desktop / 1.5 mobile, max 2560px wide); `ResizeObserver` re-fits; wide screens use "cover" biased toward Beybot, narrow screens use "contain" so Beybot is never cropped or distorted.
- Reduced motion, Save-Data / very low memory, or GSAP failing to load: static hero showing the final welcome frame with the headline and CTAs (no pinning, only one frame loaded).
- Memory note: decoded frames are held for smooth scrubbing (~180 MB on desktop at full size, ~55 MB with the mobile set). Lower `INITIAL_FRAMES`/frame count or resolution if you target weaker devices.

## Test checklist
1. Network: open DevTools > Network, filter "frame", scroll through the hero and confirm each of the 192 frames is requested only once.
2. Load: first frame appears after the loading screen; percentage reaches 100.
3. Scroll down: frames advance, text phases 1 to 5 appear in order. Scroll up: everything reverses.
4. End of hero: final frame, "Discover the world of BEYCAN.", then the About section scrolls in (hero unpins).
5. Resize window / rotate device: canvas stays sharp, Beybot not stretched.
6. Throttle network (Slow 3G) and rename a frame: page keeps working, nearest frame shown.
7. Nav links, "Get Started", "Explore Beybot" (scrolls to the end of the animation), "Discover Courses" all work; mobile menu toggles and closes with Esc.
8. Emulate `prefers-reduced-motion: reduce`: static hero.
9. Keyboard: Tab through the page, focus rings visible; skip link works.

## Notes
- The contact form is front-end only (validates and shows a message). Connect it to your own backend/form service.
- Copy is representative only; no statistics or contact details were invented.
