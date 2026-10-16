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
