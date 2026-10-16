-- =====================================================================
-- STEP 3 - RUN ONLY AFTER the patched site (reviews.ts) is deployed AND you have
-- opened the home page, a review page and a profile page and seen them load.
-- This is the only step that can break anything. To undo, run the ROLLBACK block below.
-- =====================================================================

-- Anonymous visitors (and crawlers) may no longer read private columns of community_reviews:
-- email, contact_required, suggestions, blogger_draft, heard_from, form_rating,
-- agreement, status, timestamp.
revoke select on public.community_reviews from anon;

grant select (
  id, review_no, book_title, author, genre, series, book_number, language,
  translated_in, traits, review, verdict, reviewers_rating, goodreads_rating,
  amazon_rating, name, novelty_username, instagram, website, book_cover,
  amazon_link, blog_url, poster_url, poster_link, review_date, published_on,
  created_at, updated_at, is_published, source_master_id, deleted_at
) on public.community_reviews to anon;

-- ---------------------------------------------------------------------
-- ROLLBACK (instant undo if anything looks wrong):
--   grant select on public.community_reviews to anon;
-- ---------------------------------------------------------------------
