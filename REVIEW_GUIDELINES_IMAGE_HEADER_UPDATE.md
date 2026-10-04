# Review Guidelines: image header + poster images

- `src/pages/ReviewGuidelinesPage.tsx`: the old hard-coded text hero is replaced by `public/guide/guide-header.webp`.
  The "SUBMIT NOW" pill in the image is overlaid with a transparent animated link (pulse ring + shine sweep, respects prefers-reduced-motion) that navigates to `/submit`.
- Other posters (`public/guide/*.webp`) are shown at the end of the matching sections (matched on slug/title, so admin-edited section content is untouched):
  Introduction -> V4.0 new update; Form Guide -> Picture Addition Guide + Smart Auto-Fill; Additionals & V4.0 Features -> Minor update (Preview Mode / Smart Lock).
- Images are lazy-loaded (except the header), size-capped, and tap/click to enlarge (Esc closes).
- No DB migration needed.
