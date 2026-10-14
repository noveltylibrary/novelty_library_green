# Novelty Library 1.109

- Kept the Google Search Console verification meta tag and the requested JavaScript-disabled crawler fallback in `index.html`.
- Hardened AdSense exclusion on Submit, Account, Profile, Auth/Login, Notifications, Analytics, and Admin SPA routes: the app removes previously loaded ad slots/scripts and applies a route-level CSS guard against late-injected Google ad markup.
- No database, Supabase, or SQL changes.
