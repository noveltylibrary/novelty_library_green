# v2.11 — Back button, Taste Match polish

- **Back button closes popups, not the page.** Every popup, sheet and lightbox (profile sections, followers list, stories and highlights, share card, feedback, submit-page dialogs, guidelines, report, admin dialogs, mobile menu) now owns one history entry: Back / swipe-back closes just the popup and you stay on the same page, at the same scroll position, on the control you tapped. Closing with X / backdrop / Esc removes that entry again so Back still goes to the previous page. (`src/lib/overlayHistory.ts`)
- **Back between pages restores your place.** Going Back / Forward returns to the scroll position you left (waits for content to load); opening a link starts at the top. A link clicked inside a popup closes it cleanly first.
- **About: Taste Match** now a short teaser blurb with no scoring details.
- **Taste Match results** no longer show internal metric names or "Metric signals"; reasons are friendly and generic ("Echoes your words", "Shares the story feel").
- **New Taste Match icon** everywhere (organic mind + lens + spark, same curves in every size) and a new animated page emblem: outline draws itself, lens drops in, spark pops, then gentle idle motion (respects reduced-motion).

---

# v2.10 — Author profiles, reviewer profiles, smarter names

- **Names on profile cards**: the first name stays big; middle name(s) and surname are set smaller beside it (wrapping inside their own column). A very long first name steps its own size down, so a full name no longer eats the card. Used on every reader card format and the new author/reviewer cards (`NameBlock`).
- **Author pages** (`#/author/Name`): purple + gold AUTHOR ribbon at the top, avatar, big-first-name heading, follower count, reviews, average R/W, genres, Follow button, a shareable 4:5 **author card** (PNG download, purple/gold) and the author's reviews.
- **Author followers**: signed-in readers follow through Supabase so the count is real (anonymous visitors are sent to sign in, like reader profiles). If `NL_SQL_200` has not been run, Follow keeps working in this browser only and the count is hidden.
- **Reviewer profiles**: every reviewer e-mail found in reviews gets a private random unique ID (e-mails are never public). Reviewers with an account go to their normal `@username` profile; reviewers without one get `#/reviewer/<id>` (REVIEWER tag, teal card, their reviews). The review page links to the reviewer.
- **Directories**: `#/authors` (with follower counts) and `#/reviewers` (grouped by unique ID, searchable), linked from the footer.
- **SQL**: `sql/NL_SQL_200_author_reviewer_profiles.sql` — additive only (new tables/functions, no existing table, view or row changed; `public_community_reviews` untouched).

---

# Taste Match — standalone TMAI-40 page

- Added the dedicated `#/taste-match` destination, backed by the same published review catalog and NL-rating calculation used by Live Rankings.
- Added an Open Taste Match CTA to Live Rankings and replaced the Home shortcut formerly labeled About with Taste Match; About remains available in the main navigation. Taste Match now appears among the first four Home shortcuts.
- Introduced a distinctive reusable SVG identity combining a thinking brain, search lens and golden insight spark. Reused across the Home shortcut, Live Rankings CTA, Taste Match page, panel and featured Taste Match poster.
- Redirected built-in Taste Match posters to the new route and migrated the legacy `/live-rankings#taste` link.
- The recommendation model still uses the catalog evidence available in published reviews; unavailable metric metadata is not fabricated.

---

# Novelty Library — Changelog

All version notes in one place, newest first. (Per-version files were merged here in v1.136.)


# v1.168b
- Live Rankings Taste Match now calls the browser-native TMAI-40 engine: free-text taste description, moods, loved-book similarity, language and reviewer-verdict filters feed the recommendation ranking.
- Added the 40-metric registry, weighted TF-IDF-style text retrieval, metric-level match explanations, optional structured `metricValues` for future catalog metadata, and honest coverage reporting for missing fields.
- Existing NL Rating and R/W star leaderboards remain unchanged. No SQL or environment-variable changes required.
- Metrics that lack catalog evidence are skipped; text-derived numeric values are heuristics, not calibrated predictions. Dedicated regional, sales, author-popularity, PQI and narrative-probe data still need to be supplied before those dimensions can be scored.
- Footer/Admin version label and `package.json` bumped to v1.168b / `1.168.0-b`.

# v1.167b
- Build fix, no feature changes. The previous GitHub upload was missing 59 files (the rest of `src/lib` after `moderation.ts`, all of `src/pages`, and `src/types/review.ts`), so Vercel failed with `Could not resolve "./lib/pwa"`. This package contains the complete project. Upload it with git (push or GitHub Desktop) rather than the browser drag-and-drop, which stops at 100 files.
- Footer and Admin dashboard now show v1.167b. `package.json` carries it as `1.167.0-b` because npm needs a valid semver string.
- No SQL.

# v1.164
- Profile Card page: the Followers | Following bar now sits inside the same width box as the profile card (380 px for portrait formats, 560 px for 16:9) and follows the card when you switch format. Same on public profiles.
- Highlights moved into the right column directly under the "Share a reading moment" story card, same width as it, with the normal gap between the two (it used to sit under the card on the left with a big empty gap beside it). On phones it still comes after the story card.
- Followers/Following popup recoloured to the Novelty Library teal/cyan (tabs, hover, avatars, @handles, the "who can see this list" panel). Only the Follow / Following buttons stay blue.
- No SQL.

# v1.163
- Story Highlights (Instagram-style, max 7 per reader, up to 30 photos each) under the followers bar on public profiles. Owners get a New button, "From archive" picker (own stories from the last 30 days, live ones included), add/remove photos and delete in the highlight viewer, and a Highlight button on their own story on Home. Highlights are public; photos are copied into a separate public `highlights` bucket so they outlive the purge.
- Stories are deleted after 30 days. The notice is shown in the story composer, profile story card, the archive picker, Terms and Privacy.
- **Needs SQL + a function** (`sql/NL_SQL_162_highlights.sql`, `supabase/functions/purge-stories`). Until the SQL is run, the Highlights row stays hidden for visitors and the New/archive actions will show an error.
- Not yet: video stories (needs the `stories` bucket opened to video and the 90 s cap).

# v1.162
- Profile page redone. Public profile now has an Instagram-style three-tab strip: Reading (Currently reading, Up Next, Someday), Questions (the answers that don't fit on the card) and Published (reviews capped at three with Show more). Above the published reviews a summary tank shows reviews published, average R/W rating, most read genres, most reviewed language and average read time (published reviews only). Same summary and cap on your own page.
- A blue Followers | Following table now sits just above the profile card (respects each list's privacy). Tapping it opens one popup with both lists as two columns; it opens on the one you tapped and every row has a blue Follow/Unfollow button. Your own page keeps the "who can see this list" setting inside that popup.
- All Follow buttons are blue. Author pages now have a Follow button too (stored in this browser only; authors are not accounts, so no database change).
- Own profile: the section tiles are now behind one "Edit profile" tab that drops down when clicked.
- No SQL.

# v1.161
- WebApp Pages Moderation tabs reorganised so each tab is one thing: Policy Editor (Privacy, Terms, Cookies, Cookie banner), Review Guide, About, Announcements, Roadmap, Submit Freeze, Profile Page. `#/admin/pages/guide` and `#/admin/pages/about` open the new tabs.

# v1.160
- WebApp Pages Moderation now holds Announcements and Roadmap (moved out of Control Settings; old `#/admin/announcements` and `#/admin/roadmap` links still open them there).
- New Submit Freeze (Pages Moderation): admins freeze the Submit page with a reason and a note. Readers still see every question but the form, Quick Search, Save Draft and Reserve are read-only, a banner shows on top and a popup shows the note once per visit. Admins can still use the form. Stored in `editable_pages` (no SQL). Note: this locks the page in the browser; it is not enforced on the database.
- Control Settings: new Taste Match tab explaining what the feature does, plus a Settings lab that runs the real matching engine on the published reviews with adjustable settings (field weights, text, concept tags, TF/IDF modes, minimum similarity), shows the query's weighted words, each review's top contributing words and how it moves against the live ranking. The lab is a sandbox: the live site is unchanged. The engine now takes a settings object internally; with default settings it produces exactly the same results as 1.159 (checked on 50 published reviews).

# v1.159
- Review page final order: review text, tags, More like this, Read next (any future taste-match blocks go here too), ad slot, note about R/W and NL, reader reviews with Rate & Review, comments.

# v1.158
- Review page order: review text and tags, ad, the note about R/W and NL ratings, then "Reader reviews" with Rate & Review, then the comments, then More like this and Read next.
- An ad slot after every third reader review and after every third comment (never after the last one).

# v1.157
- Share card layout rebuilt: one column with equal gaps and identical left/right edges; logo and "Novelty Library" always on one line (name in the site's serif); excerpt capped at 4 lines; scores read "Reviewer score 9.0 / 10" and "readers" for the NL score. Popup tightened (narrower, smaller heading and buttons).
- Share card covers: more address forms tried for Google Drive / Blogger images. Covers stored in Supabase are embedded normally.

# v1.156
- About: "How we rate" and "What's live, what's next" now sit right after the "How It Works" section, with space between them and an ad slot between and after each.
- About: the Live Rankings button uses the same trophy icon as the Home Rankings tile.
- Admin hub card renamed "Open Control Settings" (its page heading is now "Control Settings").

# v1.155
- Genre pages (`#/genre/Thriller`, and `#/genres` for the full list): an automatic intro written from real numbers (review count, authors, languages, average R/W, verdict counts, top rated), every review in that genre sorted by rating, and chips for other genres. The genre chip on a review page now opens its genre page. Compound genres such as "Self-Help/ Non-Fiction" appear under each part. No SQL.

# v1.154
- Removed the technical wording (TF-IDF, cosine similarity) from everything readers see: the Taste Match note and the Taste Match poster caption. The method stays in the code only.

# v1.153
- Removed the Quick Verdict card from review pages (it repeated information already shown above it). "Save for later" is now a button under "Share as card" in the left column, with a "My list (n)" link once something is saved. Reading time moved into the review's meta line ("1 min read").

# v1.152
- Share as card popup redesigned: opens above everything (it was shifted inside the page on phones), bottom sheet on phones, two-column on PC with the card on a soft stage, Download PNG / Share / Copy review link, page scroll locked behind it.
- Share card: cover images are now embedded so they can't disappear in the export; books whose image can't be read get a drawn cover (initials on a teal jacket) instead of an empty box.

# v1.151
- Review page: "Share as card" button (under Buy Now / View in Blog). Builds a rounded 4:5 PNG (1080×1350, transparent corners) with cover, verdict, R/W, NL, title, author, a short excerpt, genre and language, using the same export method and palette as the profile card. Preview, Download PNG and (on phones) Share.
- Up Next and Someday shelves are now limited to 5 books (was 8). Existing longer lists show their first 5.

# v1.150
- Home shortcuts are now Reviews, Rankings, Submit, Analytics, About, Blog.
- Announcements: new built-in Taste Match poster next to Live Rankings. Both built-in posters are editable in the admin panel (title, caption, link, badge, show from / until, reset to default). The Taste Match poster opens Live Rankings scrolled to the taste match.
- Every uploaded or imported poster now has optional "show from" and "show until" dates. New posters default to a one-week run (This week / Always buttons); existing posters stay always-on. HTML import also reads data-from / data-until.
- Saved settings from earlier versions (Live Rankings poster on/off and end date) carry over. Stored in the same editable_pages row, no SQL.

# v1.149
- Fix: spaces could not be typed in Currently Reading, Up Next and Someday (the editor trimmed each keystroke). Names saved without spaces are repaired on display where possible ("CrimeandPunishment" shows as "Crime and Punishment"); re-saving them with spaces is still best.
- Review page: Quick Verdict box (verdict, R/W, NL, genre, language, read time) with Save for later; author name now links to an Author page (`#/author/Name`); Read next (older / newer in the same genre, plus all reviews of the author).
- New pages: Author page and My list (`#/saved`, saved reviews are kept in this browser only).
- About: "How we rate" table (verdicts, R/W, NL) above the roadmap.
- Live Rankings: "Surprise me" in the Taste Match; the word "beta"/"basic" removed from that page; redesigned Live Rankings poster on Home.
- Home: new Rankings shortcut between Analytics and Blog.
- UI only. No SQL.

# v1.148
- Live Rankings taste match: new Verdict filter (Perfection / Go for it / Timepass, each with its count; pick one or several). Combines with moods, a loved book and language. Choosing a verdict alone lists the best-rated reviews with that verdict. Verdict shows as a reason chip on each pick. Reviews published before verdicts existed are left out while a verdict is chosen. UI only, no SQL.

# v1.147
- Live Rankings search: "Did you mean ..." suggestions (clickable) when the typed word is not an exact genre/language/trait/author, and when nothing matches a "Closest we have" list (or top-rated picks as a last resort) instead of an empty box. No SQL.

# v1.146
- Review pages: new "More like this" block (3 most similar published reviews by TF-IDF cosine similarity, with % similar and why), shown above the comments. No SQL / Supabase change.

# v1.145
- Live Rankings search and Taste Match now use TF-IDF + cosine similarity over the published reviews (genre, traits, title, author, language, verdict, review text, plus related-genre concept tags; typo-tolerant), the same recipe as scikit-learn's TfidfVectorizer + cosine_similarity, but running in the browser. Wider/related results and taste picks show a "NN% match" (cosine similarity). Row 1 still lists exact genre/language/trait/author matches first.
- No server, SQL or Supabase change.

# v1.144
- Live Rankings page order: NL and R/W ranking tables, then the search (Search by + the "Tell us more" line), then the taste match.

# v1.143
- (superseded by 1.144) order tables, taste match, search.

# v1.142
- Profile card no longer shows "Currently Reading" (or Up Next / Someday) as a strip; the card content is otherwise unchanged.
- Your own profile page no longer shows the Currently Reading panel or the Up Next / Someday tables under the card; you fill them in at their questions (Currently Reading first in Basic Reader, shelves in Advanced Reader). They show on the public "view profile" page only.

# v1.141
- About: "Read the Review Guide" button moved below the "Why share your review" points.
- About: closing "Got a book that hit different?" card uses a fixed cyan/teal gradient in light and dark mode (it looked green in dark mode).

# v1.140
- Fix: the rate/review popup on a scrolled page showed the footer through it. The popup now renders on the page body, the page behind it is locked while it is open, and finished fade-in animations no longer leave a stacking layer that trapped other page popups under the footer.

# v1.139
- Reviews on phones: action row is now one line - like / rate / comment on the left with room between them, NL rating on the right.
- Profile card downloads: PNG and PDF keep the rounded card shape (transparent corners, PDF via a soft mask) instead of a rectangle.
- Profile card video now records the card's real opening animation (frames rendered step by step), with rounded corners.

# v1.138
- SQL files are no longer inside the webapp zip; they ship separately as NL_SQL_1_138 (with a README saying what to run).
- Reviews page on phones: one post per row (feed style) so each card has room; 3-4 columns unchanged on larger screens.
- Home: the announcements strip now sits below the stories bar.
- Public profile: "Reader questions" subtitle reworded ("A little more about their reading life.") and the internal section name "Reading Identity" shows as "Reading taste".

# v1.137 (fix release)
- Fix: cover/image uploads in profile questions (Currently Reading cover) failed because the `profile-question-images` bucket was never created on the project. They now use the existing public `covers` bucket under the user's own folder (no Supabase change).
- Privacy Policy and Terms refreshed (profiles, uploaded images, cookies/AdSense, rankings independence); fixed a hook-order bug in both pages.

# v1.136 (built on 1.135)

- Live Rankings: new "Search by" (Genre / Language / Traits / Author) + exact-first text box, and a wider "Tell us more about your search" line. Basic taste match below it.
- About: "What's live, what's next" table (anchor `#/about#roadmap`), editable in Control Panel > Roadmap.
- "Admins & Contacts" renamed to **Control Panel**; new Roadmap tab (`#/admin/roadmap`).
- Profile: Currently Reading is now the FIRST Basic Reader question; Up Next and Someday shelves (tables) in Advanced Reader, shown under the profile card.
- Home strip: built-in Live Rankings poster (until 2026-11-17, editable in Announcements); poster badges ADAPTATION / EVENT / NEWS / LIVE.
- About hero: third button, Live Rankings.
- Footer trust line, skip-to-content link.
- Optional SQL (run once, inserts 2 rows only): `sql/shelves_questions_1_136.sql` so visitors can see shelves.


# v1.135 – built directly on the 1.130 zip
Base: NL_WA_1_130 (all of its edits untouched: blog speed, hero buttons, Currently Reading).
Added on top, nothing removed:
- Home featured poster strip (PES-style, max 10, 6 recommended).
- Admins & Contacts split into Control / Notifications / Announcements (upload, per-poster links, HTML import, live preview).
- Visible build label via src/lib/version.ts (footer "v1.135", Admin Dashboard "build v1.135"). Unlike 1.134, vite.config.ts and vite-env.d.ts are NOT modified.
- Two unproven icons replaced with ones already used in the app.
No SQL / Supabase changes.


# v1.131 – Featured poster strip + Admins & Contacts tabs
- Home: new PES-style wide (16:9) poster strip between the Submit/Reviews buttons and the shortcut cards. Swipe on phones, arrows/dots on desktop, slow auto-slide (pauses on touch/hover, off for reduced motion). Hidden until posters are published.
- Admin → Admins & Contacts is now 3 tabs: Control (admin access + Support email, unchanged), Notifications (existing panel), Announcements (new). Routes: /admin/admins, /admin/notifications, /admin/announcements.
- Announcements: upload up to 10 posters (6 recommended, 1600x900), title/caption/link per poster, reorder, show/hide, auto-slide speed, heading, live preview, and "Import from HTML" parser into the fixed poster format (only https image/title/caption/link are read; scripts ignored).
- Storage: images in the existing `posters` bucket (admin upload policy), settings in the existing `editable_pages` row `home-announcement-posters`. No SQL / Supabase changes.


# v1.130 – "Currently Reading" rewired (UI only)
- Editor: "Currently Reading" moves from Advanced Reader to the END of the tier before it (Basic Reader). UI-only re-tiering (`moveCurrentlyReadingToBasic`); the database question is untouched.
- It is now a book block: book name + optional cover upload (5 MB, JPEG/PNG/WebP, stored with the existing profile-question-images bucket).
- Saved inside the existing answer (plain text, or `{ value, cover }` when a cover exists) so visitors receive it through the existing public-profile function. answerText() already reads both forms.
- Profile (own + public) shows a new "Currently reading" panel with the cover under the card. The profile card itself is unchanged.
- No SQL / Supabase changes.


# v1.129 – Home hero buttons redesign
- New `src/components/HeroCta.tsx`: "Submit Nominations" (teal→cyan gradient pill, cyan dot, pen icon) and "Reviews" (white pill, teal dot, north-east arrow).
- Hover: pill grows, white flash follows the cursor, dot icon turns 45° (arrow points right, pen into writing pose). Slow idle drift/sway on the icons.
- Light + dark mode tokens; reduced-motion and touch (no-hover) handled; buttons wrap to two full-width rows under 400px so nothing overlaps.
- Removed the old `.home-primary-actions > button` mobile overrides and the pulse animation on the old button (they clashed with the new styling).
- Includes v1.128 blog-speed fix. No Supabase changes.


# v1.128 – Faster "View in Blog" / blog review pages

Cause: the public review page only learned its blog link after the `blog-posts` edge function
crawled all of Blogger live (up to 3 sequential requests) on every visit, with no shared cache.

Changes (browser-side only; no Supabase / edge function / SQL changes):
- `src/lib/blog.ts`: archive cached in memory + localStorage (`nl_blog_archive_v1`), one shared in-flight
  request, stale-while-revalidate (cached copy returned instantly, refreshed in background after 10 min),
  new `peekBlogPosts()` and `warmBlogPosts()`.
- `src/App.tsx`: archive warmed in the background (idle) when the site opens.
- `src/pages/ReviewPage.tsx`: blog link/poster merge applied instantly from the cache, refreshed after.
- `src/pages/BlogReviewPage.tsx`: renders instantly from cache, no skeleton on repeat visits.


# Novelty Library v1.127 — Reviewer privacy (email no longer publicly readable)

Built on **v1.122**. The cinematic intro added in v1.123-1.126 (SplashIntro rewrite, `novelty-library-intro-scene.png` 2.2 MB, the splash CSS block and the Workbox 3 MB cache allowance) is **not** included: the original book-pop intro from v1.122 is unchanged.

## What changed
- `src/lib/reviews.ts`: `fetchReviews()` and `fetchReviewBySlug()` (the only two public readers of published reviews) now read the privacy-safe view `public_community_reviews` instead of the `community_reviews` table. The view has no `email`, `contact_required`, `suggestions` or `blogger_draft`.
- Page content is identical to v1.122 for visitors and for the AdSense crawler.
- Instagram handle on a review page is shown only if the reviewer has not switched Instagram off in their profile (reviews with no linked profile still show the handle, as before).
- Admin pages are unchanged (they read the tables directly as a signed-in admin).
- `package.json` version 1.127.0.

## SQL (new files in `sql/`)
1. `privacy_public_reviews_1_127_STEP1_run_now.sql` — additive only. Creates `private.instagram_visible()`, extends the `public_community_reviews` view (adds `is_published`, `source_master_id`; Instagram respects the reviewer's choice) and fixes `public_profile_by_username` so the profile "show Instagram" switch (key `instagram`) actually works (it previously only looked at `instagram_id`).
2. Deploy v1.127, then open the home page, a review page and a profile page.
3. `privacy_public_reviews_1_127_STEP3_run_last.sql` — run only after step 2 and after any old cached builds have expired (a day or two) and any external reader (e.g. a Blogger widget) is confirmed not to read `community_reviews` directly. Blocks anonymous reads of the private columns.

## Rollout order (important)
Step 1 SQL -> deploy v1.127 -> verify -> (wait) -> Step 3 SQL. Deploying v1.127 before Step 1 would make public pages load empty.

## Rollback
- Step 3: `grant select on public.community_reviews to anon;` (instant).
- Code: redeploy v1.122.

## Known limitation (not changed here)
Signed-in users can still read `community_reviews.email` through the API; closing that needs an admin-only table/function for private fields (planned follow-up).


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


# Novelty Library v1.118 — Sign-in cooldown

- Email/password sign-in now has a client-side cooldown: after 5 wrong-password attempts the Sign In button is disabled for 30s, then 60s, 120s and 300s on each further lockout. A successful sign-in resets it.
- Only "Invalid login credentials" counts as a failure; network errors and unconfirmed-email errors do not.
- State is kept in `localStorage` (guarded by try/catch) so a refresh does not clear the lockout.
- Google sign-in, sign-up, forgot-password and resend are unchanged.
- This is a deterrent only; Supabase's server-side rate limits remain the real protection.
- Change is limited to `src/pages/AuthPage.tsx`. No SQL, Supabase, `vercel.json`, `index.html` or AdSense changes.


# Novelty Library v1.117 — Google Analytics

- Added the Google Analytics (GA4) tag, measurement ID `G-DS65FK6MNF`, to `index.html`.
- The `gtag` init code lives in `public/gtag-init.js` (external file) because the site CSP does not allow inline scripts.
- `vercel.json` CSP updated: `https://www.googletagmanager.com` added to `script-src` and `connect-src`; `https://*.google-analytics.com` and `https://*.analytics.google.com` added to `connect-src`.
- No SQL or database schema changes.


# Novelty Library v1.116 — Public Community Reviews ordering

- The reader-facing Community Reviews page now sorts all published reviews by Review No. in descending numeric order.
- Numeric parsing handles values such as `48`, `#48`, and `Review No. 48`, so #48 appears above #30 and #100 above #99.
- Entries with missing or unreadable Review No. values are placed after numbered reviews.
- The change is limited to the public Community Reviews page; the admin Publishing Queue is unchanged from v1.114.
- No SQL or database schema changes.


# Novelty Library v1.114

## Publishing Queue manual metadata overrides

- The Save action now sends the manually entered Blogger post URL to the persistence layer instead of silently omitting it.
- The save helper attempts to store `blog_url` in `community_reviews` when that optional column exists, then safely retries without it on deployments where the column is absent. It also attempts the optional legacy `master_list.blog_url` field when applicable.
- When neither database table has a `blog_url` column, manual Blogger URLs are retained in browser local storage and take precedence over future Blogger crawl results on refresh.
- Manually changed `Published On` values are saved to `community_reviews.published_on` and retained as overrides so a delayed Blogger crawl cannot replace them.
- The Save action now updates the visible queue row in place instead of reloading the full queue immediately.
- Individual published review pages now prefer the saved admin blog URL over a crawler match, so the public “View in Blog” button follows the manual correction.
- Optional migration: `sql/blog_url_publishing_queue_1_114.sql` adds the nullable `community_reviews.blog_url` column if the deployment does not have it. It is idempotent and does not alter policies or existing records. Applying it makes manual blog URLs persist across browsers and devices.


# Novelty Library v1.113

## Live Rankings refinement
- Replaced the technical/policy-sounding hero note with a reader-facing description.
- Centered the main Live Rankings layout, hero copy, section headings, genre controls, and pagination while retaining the existing ranking card size and two-column desktop layout.
- Added responsive AdSense slots to the left and right page margins on large desktop screens. Side ads are not mounted on phone-sized layouts, so they cannot appear before the text or above the ranking content on mobile.
- Replaced Show more with Previous/Next pagination. Each list switches in place between five-book pages and preserves global rank numbers (1–5, 6–10, and so on).
- Moved genre filtering into the top of both NL Rating and R/W Rating sections; removed the separate third genre panel. Each section filters its own sorted ranking in place.
- Normalized genre matching without case sensitivity, grouped Psychological Thriller / Psychological Suspense Thriller and Self-Help / Self-Help Non-Fiction labels, and kept Historical Fiction separate from Historical Fantasy.
- No database, SQL, or schema changes.


# Novelty Library v1.112.0

- Profile cards now use the published Community Reviews poster first and fetch matched Blogger poster artwork as a fallback when legacy published rows have no `poster_url` saved.
- Review numbers are normalized when connecting published profile entries to community publication metadata, including leading-zero variants.
- Removed forced anonymous-CORS mode from the profile-card shelf image so Blogger-hosted images can display even when their server does not send permissive CORS headers. Book covers remain the fallback.
- Applied the Blogger poster fallback to both the downloadable owner profile card and public profile card, and to published-review shelf cards.
- No database or SQL changes.


# Novelty Library v1.111.0

## Live Rankings
- Added a mobile-friendly animated Live Rankings entry immediately after the Live Library Signal block in Analytics, with a short one-line description visible on phones.
- Replaced the prior Love Rankings page naming and heart artwork with Live Rankings, a rankings-star SVG, and responsive styling/animations.
- Added the `#/live-rankings` route. Legacy `#/love-rankings` and `#/rankings` hashes remain aliases for compatibility.
- Rankings use `community_reviews` rows where `is_published = true` only. The NL leaderboard is sorted by NL Rating; the R/W leaderboard is sorted by the underlying R/W score and displays its corresponding star score.
- Added genre selection, ranks beside each book, and a Show more action that expands rankings by the next five entries (ranks 6–10, 11–15, etc.).
- Added mobile and reduced-motion styles. No database schema or SQL changes.


# Novelty Library 1.109

- Kept the Google Search Console verification meta tag and the requested JavaScript-disabled crawler fallback in `index.html`.
- Hardened AdSense exclusion on Submit, Account, Profile, Auth/Login, Notifications, Analytics, and Admin SPA routes: the app removes previously loaded ad slots/scripts and applies a route-level CSS guard against late-injected Google ad markup.
- No database, Supabase, or SQL changes.


# Novelty Library 1.108

- Added the Google Search Console site-verification meta tag to `index.html`.
- Added a simple Novelty Library crawler/no-JavaScript fallback inside `#root`. React replaces this fallback when the app mounts.
- Removed the site-wide AdSense script from `index.html`. AdSense now loads only when a page containing an enabled `AdSenseAdSlot` is rendered after cookie consent.
- Submit, Account, Profile, Login/Auth, Admin, and Analytics pages do not render AdSense slots; opening those pages directly does not load the AdSense script, and client-side navigation into them removes the AdSense loader tag if it was loaded on a prior public page.
- No database, SQL, or Supabase changes.


# Version 1.107

- Blogger affiliate-link matching now considers outbound product URLs in separate Buy Now / Amazon / Flipkart buttons, explicit affiliate redirects, sponsored links, and links attached to poster images instead of relying only on tracking query parameters or poster-wrapped anchors.
- Metadata matching falls back to an accepted review's existing purchase link only when the matched Blogger post does not expose a usable outbound link.
- All Auto-Match source selections continue to retrieve Blogger post URL, published date, and affiliate link when a Blogger match is available, including when the poster itself is sourced from Drive.
- No database schema or SQL changes.


# Novelty Library 1.106

- Publishing Queue Blogger matching now searches explicit affiliate/tracking URLs before falling back to a poster's outbound image link. HTML entities and common affiliate network/short links are handled more reliably.
- Instant Publish and Batch Publish now preserve discovered affiliate/Buy Now links as well as poster URLs.
- Individual review pages now derive the Blogger post URL at runtime using the same Review No./title matcher, so “View in Blog” does not depend on an optional `blog_url` database column. Missing affiliate links on older published rows can also be hydrated from the Blogger feed. No database migration is needed.
- “Sync Now” sends a cache-busting, no-store request to the existing Supabase `sheet-proxy` import function so cached GET responses cannot hide recent sheet edits. The server-side `sheet-proxy` implementation is deployed separately and is not present in this project ZIP; field reconciliation logic there remains dependent on the deployed function.


# Changelog 1.93

## Admin can blacklist any user
- **Admin → Users & Accounts**: every row (and the user detail window) has a **Blacklist** button. A reason is required and is kept on record; admins cannot blacklist themselves.
- Blacklisted users show a red **Blacklisted** badge in the table and appear in the Blacklist panel with the reason and whether it was set by an admin or automatically (30+ reports).
- **Restore** (table, detail window or Blacklist panel) lifts the blacklist after confirmation.
- Blacklisted profiles keep showing the existing "blacklisted" flag on their public profile.
- **Run `sql/admin_blacklist_1_93.sql` once in Supabase.** It adds `admin_blacklist_user`, `admin_unblacklist_user`, the `blacklisted_by_admin` flag, and re-defines `admin_list_blacklisted_users` / `is_profile_blacklisted` to read the profile flags. All are admin-only (`is_admin()`).

## Notifications moved under Admins & Contacts
- The **Notify Users** composer (one reader / everyone) now lives at the bottom of **Admin → Admins & Contacts**.
- The separate "Notify Users" card is removed from the admin dashboard; the old `#/admin/notify` link redirects to Admins & Contacts.
- Component: `src/components/AdminNotifyPanel.tsx` (replaces `AdminNotifyPage.tsx`).

## Blog link + About button
- Footer → Explore now has **Blog** (opens noveltylibrary.blogspot.com in a new tab).
- About → "Read the Review Guide" button stays on a single line on phones (text and padding scale with screen width).

## Blog & Instagram shortcuts
- **Home**: the shortcut buttons are now a swipeable row (phones and desktop). Reviews, Submit, About and Analytics show first; **Blog** is the fifth, one swipe away. Desktop also gets arrow buttons; two dots show the position.
- **Analytics**: "Read our Blog" button added to the share row at the bottom (animated icon and shimmer).
- **About**: **Blog** and **Follow on Instagram** buttons sit above the closing "Got a book that hit different?" card.
- Shared URLs live in `src/lib/links.ts` (blog and Instagram `@novelty.lib`).

## Blog link in the Publishing Queue → "View in Blog" on reviews
- **Run `sql/blog_url_1_93.sql` once in Supabase** (adds `community_reviews.blog_url`). Until then the app works as before; saving a blog link needs the column.
- **Publishing Queue**: every review has a **Blog post link** box (table and card views) plus a **Blog** open-link button. It is saved with Save / Publish / RePublish and survives republishing.
- **Auto-Match picks up the link**: "From blog" saves the matched post's poster *and* link; "Drive, then blog" takes the poster from Drive and still attaches the blog link. Instant Publish and Batch Publish do the same (existing links are never overwritten; the summary reports how many links were attached). A blog post without an image still gives the link.
- **Review page**: a **View in Blog** button appears under Buy Now whenever a blog link is set.

## Home shortcut row polish
- Arrows moved out of the cards into a small pager under the row (‹ dots ›): glass-white circles that fill teal on hover, the next arrow nudges to invite a click. Hidden on touch screens, which swipe as before.
- Desktop: a slice of the **Blog** card peeks in at the right edge with a soft fade, so it is obvious there is more. Phones are unchanged (four tiles, swipe for Blog).
- Card shadows and hover lift are no longer clipped into a visible box behind the row.
- Fix: the pager's ‹ button could not be clicked because the row's shadow padding sat on top of it; the pager now sits above the row.
- Phones now also show a sliver of the **Blog** tile at the right edge (desktop shows a bigger slice).


# Changelog 1.90

## Publishing Queue — Auto-Match is now a dropdown
- **Drive, then blog** (tries the Drive folder, falls back to the blog), **From Drive folder**, **From blog**.
- Blog matching finds the review's post by "Review No. N" in the post (title or opening text) or by book title, and uses the post's first image as the poster. The notice names the matched post; always check the preview.
- Instant Publish and Batch Publish now use "Drive, then blog" automatically.

## Compression on upload
- Every upload is scaled and re-encoded as WebP (JPEG fallback) before it reaches Supabase: posters 1000px, covers 900px, avatars 512px, profile headers/question images ≤1600px, stories 1080px. If compression would not make a file smaller, the original is kept.
- Poster upload notice shows the saving, e.g. "compressed 2.4 MB → 140 KB".

## Faster posters
- Drive posters are requested at 800px (was 1600) and Blogger posters at 1000px (was 1600).


# Changelog 1.89

## Admin — Submitted Reviews List
- New **Mark for Review** tab beside Pending / Approved / Declined (new review status `marked`).
- "Mark for Review" now moves a review into that tab (it used to just send it back to Pending); a **Move to Pending** button returns it.
- **Notify** button on every submission with a signed-in reviewer: type a message that lands in their notification bell.
- Accepting a review now automatically notifies the reviewer ("Your review was accepted", with the Review No.).

## Admin — Reserved Book Reviews List
- **Notify** button on every reservation made by a user.
- Accepting a reservation automatically sends a "Your book reservation was accepted" notification.

## Admin — new "Notify Users" section (/admin/notify)
- Hub card + page: searchable contact list, compose title + message, send to one reader or broadcast to everyone.

## Profile (1.88 carry-over)
- Basic Reader section icon: custom reader-with-bookmark SVG (matches by section name or header).
- Ad slot: collapses when no ad rendered; non-personalised frame sends origin referrer.

## Database — run once
`sql/admin_notifications_1_89.sql` (adds the `marked` status and `admin_send_notification`).

## Ads: Adsterra replaced with Google AdSense
- New `AdSenseAdSlot` (in-page `<ins class="adsbygoogle">`, responsive). Adsterra component, `ad-frame.html/js` and their headers removed.
- Cookie choice: "Accept all" = personalised, "Essential only" = non-personalised. Slot collapses if blocked/unfilled.
- Publisher ID ca-pub-4287486804733527 is built in (index.html tag, ads.txt, slot default). Ad unit 7417970298 ("Novelty Library WebApp") is the built-in default, so no Vercel variables are needed.
- CSP in `vercel.json` now allows Google ad domains.


# Novelty Library — Version 1.83 Release Notes

## Profile card icon refinement

- Replaced the generic Basic Reader icon with a custom inline SVG emblem.
- The icon combines an open book, page-line details, and a small star motif for a more distinctive Novelty Library identity.
- Kept the icon vector-based so it stays crisp at different display sizes.
- No profile-card data, rating calculations, or other format layouts were changed.


# Novelty Library 1.82 — Profile Card and Export Improvements

## Profile-card layout
- Standardized the heights of the Advanced Reader information blocks so titles and descriptions align consistently.
- Limited About/Bio text to 140 characters.
- For 16:9 cards, placed the Bio line and profile tags in a right-aligned area beside the identity block, leaving the body available for the card fields.
- Tightened spacing between the 16:9 content columns to help the shelf and bottom question fields fit without clipping.

## Download dialog
- Replaced the simple download menu with a modal that shows each card layout and its exact pixel dimensions.
- PNG exports download directly at the selected layout dimensions.
- PDF export opens the browser print sheet with the card prepared; choose “Save as PDF” there.
- Animated video export creates a 2.5-second animated card. MP4 is used if supported by the browser; otherwise WebM is used.

## Notes
- Browser support affects whether MP4 recording is available. WebM is the fallback for browsers that do not expose MP4 recording.
- PDF creation uses the browser print-to-PDF flow rather than a bundled PDF library.
- A full application build still requires installing the dependencies listed in `package.json`.
