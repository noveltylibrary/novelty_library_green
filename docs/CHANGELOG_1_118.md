# Novelty Library v1.118 — Sign-in cooldown

- Email/password sign-in now has a client-side cooldown: after 5 wrong-password attempts the Sign In button is disabled for 30s, then 60s, 120s and 300s on each further lockout. A successful sign-in resets it.
- Only "Invalid login credentials" counts as a failure; network errors and unconfirmed-email errors do not.
- State is kept in `localStorage` (guarded by try/catch) so a refresh does not clear the lockout.
- Google sign-in, sign-up, forgot-password and resend are unchanged.
- This is a deterrent only; Supabase's server-side rate limits remain the real protection.
- Change is limited to `src/pages/AuthPage.tsx`. No SQL, Supabase, `vercel.json`, `index.html` or AdSense changes.
