# Novelty Library 1.108

- Added the Google Search Console site-verification meta tag to `index.html`.
- Added a simple Novelty Library crawler/no-JavaScript fallback inside `#root`. React replaces this fallback when the app mounts.
- Removed the site-wide AdSense script from `index.html`. AdSense now loads only when a page containing an enabled `AdSenseAdSlot` is rendered after cookie consent.
- Submit, Account, Profile, Login/Auth, Admin, and Analytics pages do not render AdSense slots; opening those pages directly does not load the AdSense script, and client-side navigation into them removes the AdSense loader tag if it was loaded on a prior public page.
- No database, SQL, or Supabase changes.
