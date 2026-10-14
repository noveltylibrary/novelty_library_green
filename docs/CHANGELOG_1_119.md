# Novelty Library v1.119 — Cloudflare Turnstile (CAPTCHA) support

- New `src/lib/captcha.ts`: `getCaptchaToken()` mints a Turnstile token on demand. The widget is hidden unless Cloudflare needs interaction, and the Turnstile script loads only when a token is first needed (never on page load or on the public review pages).
- Token passed as `options.captchaToken` to every password sign-in, sign-up, resend-confirmation and reset-password call: `auth.tsx`, `OnboardingModal.tsx` (sign-in and sign-up) and `AccountPage.tsx` (password re-auth for change-password and delete-account).
- Google sign-in is unchanged.
- Inert until `VITE_TURNSTILE_SITE_KEY` is set: with no key the helper returns undefined and behaviour is identical to v1.118.
- `vercel.json` CSP: `https://challenges.cloudflare.com` added to `script-src`, `frame-src` and `connect-src`.
- `AuthPage` shows a friendly message for CAPTCHA failures; they do not count toward the v1.118 sign-in cooldown.
- `.env.example` documents `VITE_TURNSTILE_SITE_KEY`.
- No SQL or database changes. Privacy/Cookies page wording is NOT changed in this version (pending your review).

## Rollout order
1. Cloudflare → Turnstile: create widget (Managed), copy Site Key and Secret Key.
2. Vercel: add `VITE_TURNSTILE_SITE_KEY`, deploy v1.119, confirm sign-in still works.
3. Supabase → Authentication → Attack Protection: enable CAPTCHA → Turnstile → paste Secret Key.
4. Rollback: disable CAPTCHA in Supabase (instant).
