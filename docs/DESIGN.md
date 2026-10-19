# Novelty Library WebApp — Design System & UI Specification

## 1. Design direction

Novelty Library uses an editorial, literary interface with a modern teal/cyan visual identity. The experience should feel like a premium digital reading room rather than a generic SaaS dashboard.

The design language combines:
- Serif display typography for literary identity.
- Inter/system sans-serif for controls and supporting text.
- Deep teal/cyan gradients.
- Pale cyan paper-like backgrounds.
- Rounded cards and pill-shaped metadata.
- Restrained shadows.
- Gentle motion.
- Strong dark-mode support.

## 2. Color tokens

### Light theme

```css
--color-cyan-light: #eafdff;
--color-cyan: #5ce1e6;
--color-cyan-dark: #0097b2;
--color-teal: #35d3d9;
--color-teal-dark: #0097b2;
--color-deep: #045a6b;
--color-deep-dark: #013a46;
--color-paper: #f0fdff;
--color-bg: #eafdff;
--color-surface: #ffffff;
--color-text: #04333d;
--color-text-muted: rgba(4, 51, 61, 0.55);
--color-border: rgba(4, 51, 61, 0.08);
```

### Dark theme

```css
--color-cyan-light: #04282b;
--color-cyan: #5ce1e6;
--color-cyan-dark: #34c6cc;
--color-teal: #5ce1e6;
--color-teal-dark: #34c6cc;
--color-deep: #bff6f8;
--color-deep-dark: #8fe9ed;
--color-paper: #04282b;
--color-bg: #021517;
--color-surface: #0b3339;
--color-text: #e7fffe;
--color-text-muted: rgba(231, 255, 254, 0.55);
--color-border: rgba(231, 255, 254, 0.12);
```

## 3. Typography

- Body: `Inter`, then system sans-serif fallback.
- Display/editorial: `Fraunces`, then Georgia/serif fallback.
- Headings should be confident but not oversized to the point of overpowering content.
- Review body copy should prioritize reading comfort and line length.
- Metadata is compact, muted and visually subordinate.

## 4. Buttons

### Primary
- Teal/deep-teal gradient.
- White text in light theme.
- Strong contrast in dark theme.
- Rounded medium/large corners.
- Subtle lift/shadow on hover.

### Ghost
- Transparent/surface background.
- Border using `--color-border`.
- Text uses the current text color.
- Border/text accent changes toward teal on hover.

### Touch targets
At mobile widths, primary/ghost controls should be at least 44px high.

## 5. Surfaces

Common surfaces use:
- White/surface backgrounds.
- Thin low-opacity borders.
- Rounded corners, often 16–24px.
- Very soft teal-tinted shadows.

Cards should feel layered but not heavy. Avoid dense dashboard styling on reader-facing pages.

## 6. Navigation

The header is shared across the app. Navigation should remain compact and recognizable. Admin navigation may be more utilitarian, but the same typography, color tokens and border language should be preserved.

## 7. Homepage

The homepage should remain a clean discovery surface.

Primary hierarchy:
1. Brand/hero statement.
2. Main navigation cards.
3. Sponsored placement where configured.
4. Story/community surfaces.
5. Supporting editorial content.

Navigation cards use rounded 1.5rem surfaces, gradient icon blocks and a slight hover lift.

## 8. Review shelf

Review discovery uses a visual shelf/card model:
- Cover/poster is the primary visual anchor.
- Title and author are prominent.
- Genre/language/traits use compact chips.
- Rating information is visible without dominating the card.
- Filters are pill controls.
- Empty/error states should be calm and editorial, not technical.

## 9. Review detail page

The detail page is intentionally content-first.

Recommended hierarchy:
1. Poster/cover.
2. Title.
3. Author.
4. R/W Rating and external ratings.
5. Review metadata.
6. Review body.
7. Reader/community engagement.
8. Comments.
9. Sponsored placement where configured.

The R/W Rating and NL Rating must be visually distinguishable and accompanied by understandable labels/tooltips where ambiguity is possible.

## 10. Rating design

Novelty Library uses a star representation for the R/W score.

The existing conversion maps a 0–10 R/W rating into a half-star scale:

- <=1.5 → 0.5
- <=2.5 → 1
- <=3.5 → 1.5
- <=4.5 → 2
- <=5.5 → 2.5
- <=6.5 → 3
- <=7.5 → 3.5
- <=8.5 → 4
- >8.5 → 4.5

The design must never imply that this converted star display is a new underlying rating scale; it is a visual representation of the R/W value.

## 11. Community engagement design

Community engagement controls should be lightweight:
- Like.
- Rating.
- Reader review.
- Comment.

Engagement counts should be readable but secondary to the review itself.

Optimistic interactions are acceptable when failure can be rolled back cleanly.

## 12. Profile page

The profile page has a stronger personal-branding aesthetic than ordinary account forms.

Current visual direction includes:
- Teal/cyan atmospheric background accents.
- Elevated profile-card surfaces.
- Story composer.
- Connection privacy controls.
- Profile identity editing.
- Reading journey.
- Dynamic profile questions.
- Public profile preview/export controls.

The page should feel like a reader's personal archive and branding tool, not a settings spreadsheet.

## 13. Profile card

Profile cards use a dark teal editorial poster palette:
- Deep teal background.
- Cyan/teal accent gradients.
- Mint highlights.
- White/soft-white text.
- Glass-like metadata pills.
- Book covers with consistent rounded corners.

Supported formats:
- 9:16.
- 16:9.
- 3:4.
- 4:5.
- 1:1.

The card must adapt composition by aspect ratio rather than simply scaling one fixed layout.

### Current special compositions
- 4:5: editorial composition with prominent shelf, tags and compact answer grid.
- 16:9: two-column/split composition.
- Other ratios: responsive single-flow compositions with progressive fitting.

## 14. Profile-card metadata

The profile-card renderer supports dynamic question modes:
- `tag` → compact pill/tag treatment.
- `answer` → question + answer.
- `answer_no_question` → answer-only.

Question values may be single strings, arrays or uploaded image URLs.

## 15. Profile question UI

### Single select
Use a standard rounded select/dropdown.

### Multi-select
Use a custom dropdown:
- Checkbox list.
- Current selection count when capped.
- Optional `Other`.
- A-Z sorting when configured.
- Selected values rendered as chips below the control.

### Image upload
Use square preview slots and explicit limits:
- JPEG/PNG/WebP.
- Configured maximum image count.
- Configured file-size limit.
- Configured maximum width/height.

## 16. Analytics design

Analytics intentionally uses a more data-rich visual treatment than the core reader pages.

The current CSS includes:
- Compact metric cards.
- Teal accent variables.
- Progressive/animated counters.
- Contributor highlights.
- Sequence/bridge components.
- Responsive grid collapse.

Analytics must not visually overpower the book-review identity.

## 17. Admin design

Admin pages can be denser but should retain:
- Same teal/cyan tokens.
- Serif headings for major page titles.
- Rounded cards.
- Clear status labels.
- Strong action hierarchy.
- Confirmation for destructive actions.
- Tables/lists where scanning is more important than editorial presentation.

Admin cards should clearly communicate state and action without decorative excess.

## 18. Motion

Use motion to communicate:
- Entry.
- State change.
- Count-up.
- Hover affordance.
- Story/profile-card animation.

Do not use motion as decoration at the expense of readability.

The application already honors `prefers-reduced-motion`; new motion must follow the same principle.

## 19. Accessibility

- Every interactive control needs an accessible name.
- Never rely only on color to communicate rating/state.
- Maintain readable contrast in both themes.
- Keyboard interaction must work for forms/dropdowns/modals.
- Image upload controls should have clear labels.
- Loading states should communicate progress.
- Destructive actions require clear wording.

## 20. Responsive rules

Mobile is not a compressed desktop layout.

Requirements:
- Cards stack naturally.
- Multi-column analytics collapse.
- Buttons become touch-friendly.
- Profile-card preview remains visually complete.
- Long titles wrap without breaking layouts.
- Review text remains readable.
- Admin controls may wrap but must remain usable.

## 21. Ads

The current Adsterra component renders a fixed 300x250 unit in an isolated frame with a `SPONSORED` label.

Ads must not:
- Interrupt the review text.
- Pretend to be editorial content.
- Shift core content unpredictably.
- Break mobile layouts.
