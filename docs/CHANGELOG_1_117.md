# Novelty Library v1.117 — Google Analytics

- Added the Google Analytics (GA4) tag, measurement ID `G-DS65FK6MNF`, to `index.html`.
- The `gtag` init code lives in `public/gtag-init.js` (external file) because the site CSP does not allow inline scripts.
- `vercel.json` CSP updated: `https://www.googletagmanager.com` added to `script-src` and `connect-src`; `https://*.google-analytics.com` and `https://*.analytics.google.com` added to `connect-src`.
- No SQL or database schema changes.
