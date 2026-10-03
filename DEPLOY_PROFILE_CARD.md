# Novelty Library — Profile Card Update

## Vercel
1. Upload this whole project to Vercel.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel Environment Variables.
3. Deploy.

## Supabase
If you have already run the previous 3.8.1 SQL, you can run `PROFILE_CARD_UPDATE.sql` only.
If you want one combined migration, run `SUPABASE_FINAL_ALL_UPDATES.sql` once in Supabase SQL Editor.

The update adds:
- profile header image (X/Twitter 1500×500 composition)
- up to 3 unique social links: Instagram, Goodreads, Wattpad, Facebook, LinkedIn, X
- eye / eye-off per-field visibility controls
- profile answers with privacy-aware public RPC
- profile question builder in Admin → WebApp Pages Moderation
- question sections and ordering
- profile-card downloads in 9:16, 16:9, 3:4, 4:5 and 1:1 PNG resolutions
- Novelty Library logo/name permanently included on exported cards
- published-review count and average rating on cards
- active story status on the user's profile

The SQL also preserves the previous finance/pages/story updates.
