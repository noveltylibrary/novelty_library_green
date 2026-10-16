# Novelty Library v1.127 — Cinematic animated intro

- `SplashIntro` rewritten around the new library-with-magic-book picture (`public/novelty-library-intro-library.webp`, 175 KB; replaces the 2.2 MB `novelty-library-intro-scene.png`, which is removed).
- Living background: camera pull-back + handheld sway + pointer parallax, cold-to-warm colour theme, sweeping warm light, window light shafts, flickering chandelier / lantern / candles, rising tea steam, film grain, vignette, letterbox curtains.
- Animated swirls: `novelty-library-intro-swirl-l.webp` / `-r.webp` are extracted from the picture so a glow wave and gentle sway stay perfectly aligned with it.
- New `src/lib/splashParticles.ts`: canvas dust motes and golden sparks that ride the swirls; burst when the book ignites and again on exit.
- Animated text: "Every book opens a world." word-by-word reveal, then logo with rotating halo, "NOVELTY LIBRARY" letter cascade with a travelling glint, drawn ornament, subtitle words, credits in the lower letterbox bar.
- Intro length 4.4 s -> ~9.3 s. Skip button kept; Escape also skips. Starts only when the picture has loaded (1.8 s fallback).
- Fixed: when the intro had already been seen in the session, `onComplete` could be cancelled by a StrictMode effect re-run in development.
- Styles moved out of `index.css` into `src/components/SplashIntro.css`. `prefers-reduced-motion` gets a still frame.
- No SQL, routing, auth or data changes.
