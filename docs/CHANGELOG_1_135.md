# v1.135 – built directly on the 1.130 zip
Base: NL_WA_1_130 (all of its edits untouched: blog speed, hero buttons, Currently Reading).
Added on top, nothing removed:
- Home featured poster strip (PES-style, max 10, 6 recommended).
- Admins & Contacts split into Control / Notifications / Announcements (upload, per-poster links, HTML import, live preview).
- Visible build label via src/lib/version.ts (footer "v1.135", Admin Dashboard "build v1.135"). Unlike 1.134, vite.config.ts and vite-env.d.ts are NOT modified.
- Two unproven icons replaced with ones already used in the app.
No SQL / Supabase changes.
