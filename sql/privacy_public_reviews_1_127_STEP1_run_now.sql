-- =====================================================================
-- STEP 1 - RUN NOW. Purely additive: nothing the live site uses changes.
-- Safe for AdSense crawling (public pages keep reading exactly what they read today).
-- =====================================================================

-- 1a) A private helper that answers "may this reviewer's Instagram be shown?"
--     Lives in a schema that is NOT exposed through the API (private), so it cannot
--     be called from the browser; it is only used by the view below.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create or replace function private.instagram_visible(p_username text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(
    (select not (
              coalesce(p.profile_visibility->>'instagram', 'true')    = 'false'
           or coalesce(p.profile_visibility->>'instagram_id', 'true') = 'false')
       from public.profiles p
      where lower(p.novelty_username) = lower(regexp_replace(btrim(coalesce(p_username, '')), '^@', ''))
      limit 1),
    true  -- review has no linked profile (older reviews): keep showing the handle as today
  );
$$;
revoke all on function private.instagram_visible(text) from public;
grant execute on function private.instagram_visible(text) to anon, authenticated;

-- 1b) Extend the EXISTING public view (it already omits email / contact_required /
--     suggestions / blogger_draft). Same columns in the same order, plus two appended
--     columns the app needs, and instagram now respects the reviewer's choice.
create or replace view public.public_community_reviews
with (security_invoker = true) as
select
  id, review_no, book_title, author, genre, series, book_number, language,
  translated_in, traits, review, verdict, reviewers_rating, goodreads_rating,
  amazon_rating, name, novelty_username,
  case when private.instagram_visible(novelty_username) then instagram else null end as instagram,
  website, book_cover, amazon_link, blog_url, poster_url, poster_link,
  review_date, published_on, created_at, updated_at,
  is_published,        -- new (appended)
  source_master_id     -- new (appended)
from public.community_reviews
where deleted_at is null;

-- 1c) Bug fix: the profile page's "show Instagram" switch saves the key 'instagram',
--     but this function only looked at 'instagram_id', so the switch never worked.
--     Now it honours either key. Everything else in the function is unchanged.
create or replace function public.public_profile_by_username(p_username text)
returns table(id uuid, novelty_username text, name text, avatar_url text, header_image_url text, email text, instagram_id text, website text, social_links jsonb, favorite_book text, favorite_author text, favorite_genre text, books_read_this_month integer, total_books_read integer, reading_since integer, profile_answers jsonb, created_at timestamp with time zone)
language sql
stable security definer
set search_path to 'public'
as $function$
  select
    p.id,
    p.novelty_username,
    case when coalesce((p.profile_visibility->>'name')::boolean, true)         then p.name else null end,
    case when coalesce((p.profile_visibility->>'avatar')::boolean, true)       then p.avatar_url else null end,
    case when coalesce((p.profile_visibility->>'header_image')::boolean, true) then p.header_image_url else null end,
    case when coalesce((p.profile_visibility->>'email')::boolean, false)       then p.email else null end,
    case when coalesce((p.profile_visibility->>'instagram')::boolean, (p.profile_visibility->>'instagram_id')::boolean, true) then p.instagram_id else null end,
    case when coalesce((p.profile_visibility->>'website')::boolean, true)      then p.website else null end,
    coalesce((
      select jsonb_agg(link)
      from jsonb_array_elements(case when jsonb_typeof(p.social_links) = 'array' then p.social_links else '[]'::jsonb end) link
      where jsonb_typeof(link) = 'object'
    ), '[]'::jsonb),
    case when coalesce((p.profile_visibility->>'favorite_book')::boolean, true)         then p.favorite_book else null end,
    case when coalesce((p.profile_visibility->>'favorite_author')::boolean, true)       then p.favorite_author else null end,
    case when coalesce((p.profile_visibility->>'favorite_genre')::boolean, true)        then p.favorite_genre else null end,
    case when coalesce((p.profile_visibility->>'books_read_this_month')::boolean, true) then p.books_read_this_month else null end,
    case when coalesce((p.profile_visibility->>'total_books_read')::boolean, true)      then p.total_books_read else null end,
    case when coalesce((p.profile_visibility->>'reading_since')::boolean, true)         then p.reading_since else null end,
    coalesce((
      select jsonb_object_agg(q.key, p.profile_answers -> q.key)
      from public.profile_questions q
      where q.active = true
        and q.show_in_profile_card = true
        and p.profile_answers ? q.key
        and coalesce((p.profile_visibility ->> ('question:' || q.key))::boolean, q.public_default) = true
    ), '{}'::jsonb)
    || jsonb_build_object(
         '__card_qa',   coalesce(p.selected_question_ids, '[]'::jsonb),
         '__card_tags', to_jsonb(coalesce(p.profile_display_tags, '{}'::text[]))
       ),
    p.created_at
  from public.profiles p
  where lower(p.novelty_username) = lower(regexp_replace(btrim(p_username), '^@', ''))
  limit 1;
$function$;
