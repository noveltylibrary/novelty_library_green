# v1.129 – Home hero buttons redesign
- New `src/components/HeroCta.tsx`: "Submit Nominations" (teal→cyan gradient pill, cyan dot, pen icon) and "Reviews" (white pill, teal dot, north-east arrow).
- Hover: pill grows, white flash follows the cursor, dot icon turns 45° (arrow points right, pen into writing pose). Slow idle drift/sway on the icons.
- Light + dark mode tokens; reduced-motion and touch (no-hover) handled; buttons wrap to two full-width rows under 400px so nothing overlaps.
- Removed the old `.home-primary-actions > button` mobile overrides and the pulse animation on the old button (they clashed with the new styling).
- Includes v1.128 blog-speed fix. No Supabase changes.
