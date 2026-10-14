# Novelty Library v1.111.0

## Live Rankings
- Added a mobile-friendly animated Live Rankings entry immediately after the Live Library Signal block in Analytics, with a short one-line description visible on phones.
- Replaced the prior Love Rankings page naming and heart artwork with Live Rankings, a rankings-star SVG, and responsive styling/animations.
- Added the `#/live-rankings` route. Legacy `#/love-rankings` and `#/rankings` hashes remain aliases for compatibility.
- Rankings use `community_reviews` rows where `is_published = true` only. The NL leaderboard is sorted by NL Rating; the R/W leaderboard is sorted by the underlying R/W score and displays its corresponding star score.
- Added genre selection, ranks beside each book, and a Show more action that expands rankings by the next five entries (ranks 6–10, 11–15, etc.).
- Added mobile and reduced-motion styles. No database schema or SQL changes.
