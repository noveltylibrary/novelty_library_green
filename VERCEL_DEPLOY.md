# Novelty Library — Vercel deployment

## 1. Deploy
Upload this entire folder to Vercel as a Vite project.

Build command: `npm run build`
Output directory: `dist`

The included `vercel.json` already contains the SPA rewrite.

## 2. Vercel environment variables
Add these under Project Settings → Environment Variables:

- `VITE_SUPABASE_URL` = your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` = your Supabase anon/public key

Optional:
- `VITE_GOOGLE_DRIVE_API_KEY`

Adsterra is embedded through the isolated 300×250 iframe slot and does not require an Adsterra environment variable.

Do not put a Supabase service-role key in Vercel frontend variables.

## 3. Supabase SQL
If the existing Novelty Library Supabase project already has all previous migrations, run:

`SUPABASE_3_8_1_UPDATE.sql`

in Supabase → SQL Editor.

This adds:
- Finances & Payments module storage
- editable About / Privacy / Terms pages
- profile field visibility
- follower-only story reads/storage access
- story upload ownership fix

If this is a completely new Supabase project, the older migrations in `supabase/migrations/` must also be applied because the application depends on the existing Novelty Library schema.

## 4. After deployment
Open the deployed site and test:
- Login
- Admin Hub
- Finances & Payments
- WebApp Pages Moderation
- Profile visibility
- Add Story
- Analytics button

If an external finance dashboard refuses to appear inside the embedded panel, that is controlled by the dashboard provider's own anti-iframe headers; the app still provides the external-open fallback.

## Profile Card Update
Run `PROFILE_CARD_UPDATE.sql` in Supabase SQL Editor after the 3.8.1 update. It adds the profile-card header image, social links, dynamic profile questions and the public-profile RPC used by the new UI.
