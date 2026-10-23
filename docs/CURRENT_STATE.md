# Current state (read this first)

- **App version:** 2.37 (History-API router in `src/lib/router.ts`; React + Vite + Tailwind; Supabase project "Novelty Library"; Vercel; live domain frozen on v1.116 during the AdSense review).
- **Latest SQL:** one file kept OUTSIDE this repo, `NL_SQL_PENDING.sql` (Part A run now: fixes `community_review_stats`; Part B = lockdown, only after AdSense finishes). Everything older (162, 200, 210, 220, 230, 231, FIX3/5) is already applied live. 2.34-2.35 (Reading Challenge) need no SQL.
- **Architecture in one line:** pages in `src/pages`, UI in `src/components`, data/logic in `src/lib` (Supabase calls only there); profile extras live in `profiles.profile_answers` under reserved `__` keys (e.g. `__reading_challenge`); Taste Match SE is browser-only (see `taste-match/`).
