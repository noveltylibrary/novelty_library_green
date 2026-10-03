# Novelty Library 3.1 - deploy anywhere

Everything needed is inside this folder. Supabase keys (public "anon" keys, safe in a browser app)
are in `.env` AND baked in as fallbacks in `vite.config.ts`, so the build works with zero settings.

## Vercel
Import / upload the folder. Framework = Vite (auto). Build `npm run build`, output `dist`. Done.

## Netlify / Cloudflare Pages
Build `npm run build`, publish `dist`. (`netlify.toml` and `public/_redirects` are included.)

## GitHub Pages
Push this folder to a GitHub repo (branch `main`), then Settings -> Pages -> Source: GitHub Actions.
The included workflow builds with the right sub-path automatically.

## Optional
- Batch poster matching in admin: put your Google Drive API key in `VITE_GOOGLE_DRIVE_API_KEY` (.env or host settings).
- Override any value: set the same-named environment variable on your host; it wins over the built-in default.
- Backend (Supabase): migrations are in `supabase/migrations`, edge functions in `supabase/functions`.

## Supabase 3.2 feature rollout
- Apply all SQL migrations in `supabase/migrations` (including the account/profile, notifications/comments and home-analytics migrations).
- Deploy the account-deletion function with `supabase functions deploy delete-account`. It validates the signed-in JWT before using the server-side service role to remove the account.
- The normal Supabase Edge Function environment supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`; do not place the service-role key in `.env` or client code.


## 3.6 migration

Apply `supabase/migrations/20261002193000_support_email_and_review_count_automation.sql` after the existing migrations. It creates the protected site Support email setting and the automatic accepted-review count floor for Total Books Read.
