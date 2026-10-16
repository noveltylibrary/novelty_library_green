# Novelty Library v1.129 — Cinematic animated intro (image only, brand teal / cyan)

Built on the **v1.127** zip (reviewer-privacy release). Everything from 1.127 is untouched (`reviews.ts`, SQL files, `CHANGELOG_1_127.md`); this release only adds the intro. (There is no 1.128 in this line.)

## What changed
- `SplashIntro` rewritten: a ~8.8 s cinematic intro over a living library picture. It replaces the 1.127 book-pop splash. Skip button kept; Escape also skips.
- **No black background:** the picture is visible from the first frame. The earlier fade-from-black, letterbox bars and black vignette are gone; the only fallback while the picture loads is a brand-teal gradient.
- **Every golden hit is now brand teal / cyan:** the picture was recoloured (golden lights, window sun, candle glow and the magic swirls are teal/cyan), and all overlays, sparks, text, ornament, halo and flashes use the app colour tokens.
- **Better animation:** camera pull-back + handheld sway + pointer parallax, moving teal/cyan theme and light sweep, two layers of drifting mist, window light shafts, flickering lights, tea steam, swirl glow wave, floating bokeh, dust, sparks that ride the swirls, letters lifting off the pages, book ignition with flash + shock ring + spark burst, word-by-word title with a travelling cyan glint, logo + rotating halo, letter-by-letter brand cascade, ornament, credits on the picture, fly-through exit.
- New files: `src/components/SplashIntro.css`, `src/lib/splashParticles.ts`, `public/novelty-library-intro-library.webp` (185 KB), `public/novelty-library-intro-swirl-l.webp`, `public/novelty-library-intro-swirl-r.webp`.
- `src/index.css`: the old simple `.nl-splash` rules were removed (the intro now has its own stylesheet).
- `AnimatedBook.tsx` is no longer imported by the intro (its CSS stays in `index.css`); nothing else was changed.
- `package.json` version 1.129.0. No SQL, routing, auth or data changes; no `vite.config.ts` change.
- `prefers-reduced-motion`: calm still frame, no particles.
