-- NL_SQL_200: Author follower counts + reviewer unique IDs.
-- Run once in Supabase -> SQL editor. ADDITIVE ONLY: no existing table, column, view, policy or function is
-- changed or removed, and no existing row is modified. public_community_reviews (what the AdSense crawler and
-- the review pages read) is NOT touched. Reviewer e-mails are never exposed: only an opaque random ID leaves the database.
-- The site keeps working if you never run this file (author Follow falls back to "this browser only", reviewer
-- pages simply stay hidden); running it switches on real follower counts and reviewer IDs.

-- 1) AUTHOR FOLLOWS ---------------------------------------------------------------------------------------------
-- Authors are not accounts, so they are identified by the same normalised key the site already uses in the URL
-- (lower-case, punctuation collapsed to single spaces).
create table if not exists public.author_follows (
  author_key  text        not null check (char_length(author_key) between 1 and 200),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (author_key, user_id)
);
create index if not exists author_follows_user_idx on public.author_follows (user_id);
alter table public.author_follows enable row level security;
-- No direct table policies on purpose: everything goes through the three functions below.

create or replace function public.get_author_follow_stats(p_author_key text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'followers',    (select count(*) from public.author_follows f where f.author_key = lower(btrim(p_author_key))),
    'is_following', exists (select 1 from public.author_follows f where f.author_key = lower(btrim(p_author_key)) and f.user_id = auth.uid())
  );
$$;

-- Follower counts for every author at once (Authors directory).
create or replace function public.author_follower_counts()
returns table (author_key text, followers bigint) language sql stable security definer set search_path = public as $$
  select f.author_key, count(*) from public.author_follows f group by f.author_key;
$$;

create or replace function public.follow_author(p_author_key text)
returns void language plpgsql security definer set search_path = public as $$
declare k text := lower(btrim(p_author_key));
begin
  if auth.uid() is null then raise exception 'Sign in to follow authors.'; end if;
  if k is null or k = '' or char_length(k) > 200 then raise exception 'Author not found.'; end if;
  if (select count(*) from public.author_follows where user_id = auth.uid()) >= 500 then raise exception 'You can follow at most 500 authors.'; end if;
  insert into public.author_follows(author_key, user_id) values (k, auth.uid()) on conflict do nothing;
end $$;

create or replace function public.unfollow_author(p_author_key text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  delete from public.author_follows where author_key = lower(btrim(p_author_key)) and user_id = auth.uid();
end $$;

grant execute on function public.get_author_follow_stats(text) to anon, authenticated;
grant execute on function public.author_follower_counts()      to anon, authenticated;
grant execute on function public.follow_author(text)           to authenticated;
grant execute on function public.unfollow_author(text)         to authenticated;

-- 2) REVIEWER UNIQUE IDs ----------------------------------------------------------------------------------------
-- One private row per distinct reviewer e-mail (as typed in the reviews) with a random, unguessable public ID.
-- When that e-mail belongs to a Novelty Library account, the public ID is the account's own profile ID and the
-- site sends visitors to the normal @username profile; otherwise the reviewer gets a reviewer page at /reviewer/<id>.
create table if not exists public.reviewer_identities (
  email_key  text        primary key,
  uid        uuid        not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);
alter table public.reviewer_identities enable row level security;  -- no policies: never readable through the API

create or replace function public.register_reviewer_identity(p_email text)
returns void language plpgsql security definer set search_path = public as $$
declare k text := lower(btrim(coalesce(p_email, '')));
begin
  if k <> '' then insert into public.reviewer_identities(email_key) values (k) on conflict do nothing; end if;
end $$;
revoke all on function public.register_reviewer_identity(text) from public, anon, authenticated;

-- Back-fill every e-mail already present in the reviews.
insert into public.reviewer_identities(email_key)
select distinct lower(btrim(email)) from public.community_reviews
where coalesce(btrim(email), '') <> '' and deleted_at is null
on conflict do nothing;

-- Keep it current when a review is added or its e-mail changes. Never allowed to block a publish.
create or replace function public.trg_register_reviewer_identity() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin perform public.register_reviewer_identity(new.email); exception when others then null; end;
  return new;
end $$;
drop trigger if exists trg_community_reviews_reviewer_identity on public.community_reviews;
create trigger trg_community_reviews_reviewer_identity after insert or update of email on public.community_reviews
  for each row execute function public.trg_register_reviewer_identity();

-- Public index: published review -> reviewer ID. No e-mail, no contact details, only what the review page already shows
-- (the reviewer's public name and Novelty username).
create or replace function public.public_reviewer_index()
returns table (review_no text, reviewer_uid uuid, novelty_username text, reviewer_name text, has_account boolean)
language sql stable security definer set search_path = public as $$
  select c.review_no,
         coalesce(p.id, i.uid),
         nullif(btrim(coalesce(nullif(btrim(c.novelty_username), ''), p.novelty_username)), ''),
         nullif(btrim(coalesce(c.name, '')), ''),
         p.id is not null
  from public.community_reviews c
  left join public.reviewer_identities i on i.email_key = lower(btrim(c.email))
  left join lateral (
    select pp.id, pp.novelty_username, pp.is_blacklisted from public.profiles pp
    where (coalesce(btrim(c.novelty_username), '') <> '' and lower(pp.novelty_username) = lower(btrim(c.novelty_username)))
       or (coalesce(btrim(c.email), '') <> '' and lower(btrim(pp.email)) = lower(btrim(c.email)))
    order by (lower(pp.novelty_username) = lower(btrim(coalesce(c.novelty_username, '')))) desc
    limit 1
  ) p on true
  where c.is_published = true and c.deleted_at is null
    and coalesce(p.is_blacklisted, false) = false;
$$;
grant execute on function public.public_reviewer_index() to anon, authenticated;
