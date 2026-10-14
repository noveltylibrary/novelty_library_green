# Novelty Library v1.113

## Live Rankings refinement
- Replaced the technical/policy-sounding hero note with a reader-facing description.
- Centered the main Live Rankings layout, hero copy, section headings, genre controls, and pagination while retaining the existing ranking card size and two-column desktop layout.
- Added responsive AdSense slots to the left and right page margins on large desktop screens. Side ads are not mounted on phone-sized layouts, so they cannot appear before the text or above the ranking content on mobile.
- Replaced Show more with Previous/Next pagination. Each list switches in place between five-book pages and preserves global rank numbers (1–5, 6–10, and so on).
- Moved genre filtering into the top of both NL Rating and R/W Rating sections; removed the separate third genre panel. Each section filters its own sorted ranking in place.
- Normalized genre matching without case sensitivity, grouped Psychological Thriller / Psychological Suspense Thriller and Self-Help / Self-Help Non-Fiction labels, and kept Historical Fiction separate from Historical Fantasy.
- No database, SQL, or schema changes.
