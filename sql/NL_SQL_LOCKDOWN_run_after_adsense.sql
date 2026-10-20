-- =====================================================================
-- NL LOCKDOWN  (Fix #2 + Fix #4)   *** DO NOT RUN UNTIL v2.12 IS LIVE ***
-- Run only after AdSense review is done AND the new frontend (2.12+) is
-- deployed to production. v1.116 reads raw community_reviews / reviews and
-- WILL BREAK (empty lists, errors) the moment this runs.
-- Verified beforehand: public_community_reviews and public_reviews expose
-- NO email, user_id, admin_notes, form_feedback, contact columns.
-- =====================================================================
begin;

-- 0. PRE-FLIGHT: confirm the safe views carry no PII columns (expect 0 rows)
do $$
declare bad int;
begin
  select count(*) into bad from information_schema.columns
  where table_schema='public'
    and table_name in ('public_community_reviews','public_reviews')
    and column_name in ('email','reviewer_email','user_id','admin_notes','form_feedback','contact_required','agreement','suggestions','heard_from','blogger_draft');
  if bad > 0 then raise exception 'PII column found in public view - aborting'; end if;
end $$;

-- 1. community_reviews (Fix #2) -------------------------------------------
-- The views are security_invoker, so they inherit the caller's table rights.
-- Switch them to definer mode (with the published filter baked in) BEFORE revoking.
create or replace view public.public_community_reviews with (security_invoker = false) as
select id, review_no, book_title, author, genre, series, book_number, language, translated_in,
       traits, review, verdict, reviewers_rating, goodreads_rating, amazon_rating, name,
       novelty_username,
       case when private.instagram_visible(novelty_username) then instagram else null::text end as instagram,
       website, book_cover, amazon_link, blog_url, poster_url, poster_link, review_date,
       published_on, created_at, updated_at, is_published, source_master_id
from public.community_reviews
where deleted_at is null and coalesce(is_published,false) = true;

grant select on public.public_community_reviews to anon, authenticated;

drop policy if exists community_reviews_public_select on public.community_reviews;
revoke all on public.community_reviews from anon;
revoke select, insert, update, delete on public.community_reviews from authenticated;
-- re-grant only what the admin policy (is_admin()) needs
grant select, insert, update, delete on public.community_reviews to authenticated;
-- NOTE: RLS now leaves authenticated users with ONLY community_reviews_admin_all (is_admin()).

-- 2. reviews (Fix #4) -----------------------------------------------------
-- community_review_stats joins raw reviews: make it definer + approved-only first.
create or replace view public.community_review_stats with (security_invoker = false) as
select r.id as review_id,
       coalesce(l.like_count,0::bigint) as like_count,
       coalesce(fr.rating_count,0::bigint) as rating_count,
       coalesce(fr.rating_sum,0::bigint)::numeric as rating_sum,
       coalesce(fr.review_count,0::bigint) as review_count
from public.reviews r
left join (select review_id, count(*) as like_count from public.community_review_likes group by review_id) l on l.review_id = r.id
left join (select review_id, count(rating) as rating_count, coalesce(sum(rating),0::bigint) as rating_sum,
                  count(*) filter (where nullif(trim(coalesce(review_text,'')),'') is not null) as review_count
           from public.community_review_feedback group by review_id) fr on fr.review_id = r.id
where r.status = 'approved' and r.deleted_at is null;
grant select on public.community_review_stats to anon, authenticated;

-- public_reviews: same columns as today, definer mode, approved only
create or replace view public.public_reviews with (security_invoker = false) as
select id, slug, title, author, genre, traits, language, review_text, rw_rating, rating_integer,
       goodreads_rating, amazon_rating, verdict, series_name, series_number, translated_from,
       reviewer_name, reviewer_handle, novelty_username, review_number, master_review_no,
       cover_image_url, cover_storage_path, poster_url, poster_link, buy_link, labels,
       review_date, published_at, published_on, created_at, updated_at
from public.reviews
where deleted_at is null and status = 'approved';
grant select on public.public_reviews to anon, authenticated;

-- raw table: no more public reads (leaks reviewer_email, user_id, admin_notes)
drop policy if exists reviews_public_select on public.reviews;
revoke all on public.reviews from anon;            -- anon can no longer touch the raw table
-- authenticated keeps: own rows (reviews_owner_select), admin rows, own insert/update/delete via RLS

commit;

-- =====================================================================
-- VERIFY (run after commit)
--   set role anon;  select count(*) from public.community_reviews;   -- expect: permission denied
--   select count(*) from public.public_community_reviews;            -- expect: published rows
--   select count(*) from public.public_reviews;                      -- expect: approved rows
--   reset role;
--
-- ROLLBACK (restores today's behaviour)
--   create policy community_reviews_public_select on public.community_reviews for select to anon, authenticated
--     using (coalesce(is_published,false)=true and deleted_at is null);
--   grant select on public.community_reviews to anon;
--   create policy reviews_public_select on public.reviews for select to public
--     using (status='approved' and deleted_at is null);
--   grant select, insert on public.reviews to anon;
--   alter view public.public_community_reviews set (security_invoker = true);
--   alter view public.public_reviews set (security_invoker = true);
--   alter view public.community_review_stats set (security_invoker = true);
-- =====================================================================
