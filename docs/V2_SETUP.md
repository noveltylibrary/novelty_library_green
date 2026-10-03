# Novelty Library 2.0 - setup

1. `npm install` (adds `framer-motion` and `vite-plugin-pwa`; package-lock.json will refresh).
2. Run the new migrations (`supabase db push`, or paste into the SQL editor):
   - `20261002010000_fix_poster_storage_access.sql`
   - `20261002020000_community_engagement.sql`  (likes, ratings, reviews, stats view)
3. Deploy functions: `supabase functions deploy poster-match` and `supabase functions deploy engagement-sheet`.
4. Google Sheet backend (optional but wired):
   - Create a NEW Google Sheet, paste `docs/engagement-sheet-apps-script.gs` into Extensions -> Apps Script, set `TOKEN`, deploy as Web app (Anyone).
   - Supabase secrets: `ENGAGEMENT_SHEET_WEBHOOK_URL` (the /exec URL) and `ENGAGEMENT_SHEET_TOKEN` (same token).
   - Tabs "NL Summary" (one row per review, incl. NL Rating) and "NL Feedback" (every rating/review/tags) fill automatically.
5. PWA: `npm run build && npm run preview`, open on a phone / Chrome -> "Install Web App". Replace `public/pwa-192x192.png`, `pwa-512x512.png`, `apple-touch-icon.png` with final artwork when ready (keep the logo inside the centre 80% so maskable cropping is safe).

NL Rating = (R/W rating + all reader ratings) / (1 + number of reader ratings).
