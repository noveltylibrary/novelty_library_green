# Novelty Library 3.1 — security rollout

Deploy in this order:
1. Run `supabase/migrations/20261003000000_security_hardening_v3_1.sql` in the SQL editor (safe to re-run).
2. Deploy edge functions: `supabase functions deploy sheet-proxy ig-poster`
   (optional extra origins: `supabase secrets set ALLOWED_ORIGINS=https://your-alias.vercel.app,https://other.example`).
3. Deploy the front-end to Vercel (picks up the new `vercel.json` headers + CSP).
4. Admins: open the app once and, if "Sync Now" says 403, sign out and in again.

Edit `PREVIEW_ORIGIN` / `STATIC_ORIGINS` in `supabase/functions/_shared/auth.ts` if your
Vercel project slug or production domain differs from `novelty-library` / `novelty.co.in`.
