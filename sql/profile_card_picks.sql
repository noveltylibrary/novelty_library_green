-- Profile card picks: each reader shows at most 5 questions and 3 tags, chosen from the
-- "Advanced Reader" questions (section name "Reading Identity", heading "Advanced Reader").
-- Safe to run more than once in the Supabase SQL editor.
--
--   profiles.selected_question_ids  jsonb  question keys shown as Question + Answer (max 5)
--   profiles.profile_display_tags   text[] question keys shown as answer-only tags   (max 3)

-- 1. Columns + hard limits (already present on your project; kept so a fresh database matches).
alter table public.profiles add column if not exists selected_question_ids jsonb  not null default '[]'::jsonb;
alter table public.profiles add column if not exists profile_display_tags  text[] not null default '{}'::text[];

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'check_max_five_questions') then
    alter table public.profiles add constraint check_max_five_questions
      check (jsonb_array_length(coalesce(selected_question_ids, '[]'::jsonb)) <= 5);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'check_max_three_tags') then
    alter table public.profiles add constraint check_max_three_tags
      check (cardinality(coalesce(profile_display_tags, '{}'::text[])) <= 3);
  end if;
end $$;

-- 2. Clean the picks on every write: must be a JSON array of strings, no duplicates, only active
--    Advanced Reader questions that are allowed on the card, and a key can't be both a question and a tag.
--    (The two CHECK constraints above then reject anything over 5 / 3.)
create or replace function public.clean_profile_card_picks()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  valid_keys text[];
  qa         text[];
  tg         text[];
begin
  select coalesce(array_agg(q.key), '{}') into valid_keys
  from public.profile_questions q
  where q.section = 'Reading Identity'
    and q.active is true
    and q.show_in_profile_card is true
    and q.type <> 'image_upload';

  if new.selected_question_ids is null or jsonb_typeof(new.selected_question_ids) <> 'array' then
    new.selected_question_ids := '[]'::jsonb;
  end if;

  select coalesce(array_agg(k order by first_pos), '{}') into qa
  from (
    select e.k, min(e.pos) as first_pos
    from jsonb_array_elements_text(new.selected_question_ids) with ordinality as e(k, pos)
    where e.k = any (valid_keys)
    group by e.k
  ) s;

  select coalesce(array_agg(k order by first_pos), '{}') into tg
  from (
    select e.k, min(e.pos) as first_pos
    from unnest(coalesce(new.profile_display_tags, '{}'::text[])) with ordinality as e(k, pos)
    where e.k = any (valid_keys) and not (e.k = any (qa))
    group by e.k
  ) s;

  new.selected_question_ids := to_jsonb(qa);
  new.profile_display_tags  := tg;
  return new;
end;
$$;

drop trigger if exists trg_clean_profile_card_picks on public.profiles;
create trigger trg_clean_profile_card_picks
  before insert or update of selected_question_ids, profile_display_tags on public.profiles
  for each row execute function public.clean_profile_card_picks();

-- 3. One call to save both lists for the signed-in reader (the app also writes the columns directly).
create or replace function public.set_profile_card_picks(p_questions jsonb, p_tags text[])
returns table (selected_question_ids jsonb, profile_display_tags text[])
language sql
security invoker
set search_path = public
as $$
  update public.profiles p
     set selected_question_ids = coalesce(p_questions, '[]'::jsonb),
         profile_display_tags  = coalesce(p_tags, '{}'::text[]),
         updated_at            = now()
   where p.id = auth.uid()
  returning p.selected_question_ids, p.profile_display_tags;
$$;

revoke all on function public.set_profile_card_picks(jsonb, text[]) from public;
grant execute on function public.set_profile_card_picks(jsonb, text[]) to authenticated;

-- 4. Public profiles: hand the owner's picks to other readers inside profile_answers
--    (keys __card_qa / __card_tags), so the function's return shape does not change.
create or replace function public.public_profile_by_username(p_username text)
returns table(id uuid, novelty_username text, name text, avatar_url text, header_image_url text, email text,
              instagram_id text, website text, social_links jsonb, favorite_book text, favorite_author text,
              favorite_genre text, books_read_this_month integer, total_books_read integer, reading_since integer,
              profile_answers jsonb, created_at timestamp with time zone)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    p.id,
    p.novelty_username,
    case when coalesce((p.profile_visibility->>'name')::boolean, true)         then p.name else null end,
    case when coalesce((p.profile_visibility->>'avatar')::boolean, true)       then p.avatar_url else null end,
    case when coalesce((p.profile_visibility->>'header_image')::boolean, true) then p.header_image_url else null end,
    case when coalesce((p.profile_visibility->>'email')::boolean, false)       then p.email else null end,
    case when coalesce((p.profile_visibility->>'instagram_id')::boolean, true) then p.instagram_id else null end,
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

-- 5. One-time backfill for readers who have not chosen yet: their first 5 answered questions
--    and first 3 answered tag-style questions from the Advanced Reader section (admin order).
update public.profiles p
set selected_question_ids = coalesce((
      select jsonb_agg(s.key order by s.sort_order)
      from (
        select q.key, q.sort_order
        from public.profile_questions q
        where q.section = 'Reading Identity' and q.active and q.show_in_profile_card and q.type <> 'image_upload'
          and q.profile_card_mode in ('answer', 'answer_no_question')
          and p.profile_answers ? q.key
          and p.profile_answers -> q.key not in ('""'::jsonb, '[]'::jsonb, 'null'::jsonb)
        order by q.sort_order
        limit 5
      ) s
    ), '[]'::jsonb),
    profile_display_tags = coalesce((
      select array_agg(s.key order by s.sort_order)
      from (
        select q.key, q.sort_order
        from public.profile_questions q
        where q.section = 'Reading Identity' and q.active and q.show_in_profile_card and q.type <> 'image_upload'
          and q.profile_card_mode in ('tag', 'tag_no_question')
          and p.profile_answers ? q.key
          and p.profile_answers -> q.key not in ('""'::jsonb, '[]'::jsonb, 'null'::jsonb)
        order by q.sort_order
        limit 3
      ) s
    ), '{}'::text[])
where jsonb_array_length(coalesce(p.selected_question_ids, '[]'::jsonb)) = 0
  and cardinality(coalesce(p.profile_display_tags, '{}'::text[])) = 0;
