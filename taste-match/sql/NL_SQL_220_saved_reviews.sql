-- NL_SQL_220: "My Reviews" (saved reviews) synced to the reader's account, so the list follows them to every device.
-- Run once in Supabase -> SQL editor. ADDITIVE ONLY: one new table, its policies and one trigger.
-- No existing table, column, policy or function is changed. Safe for the live site: older versions simply ignore it
-- (they keep using the browser-only list).

create table if not exists public.user_saved_reviews (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  review_no  text        not null check (char_length(review_no) between 1 and 40),  -- same value as the review's master review no. / review number
  saved_at   timestamptz not null default now(),
  primary key (user_id, review_no)
);
create index if not exists user_saved_reviews_user_idx on public.user_saved_reviews (user_id, saved_at desc);

alter table public.user_saved_reviews enable row level security;

-- Private list: a reader can only see and change their own rows. Nobody else (including anon) can read it.
drop policy if exists saved_reviews_owner_select on public.user_saved_reviews;
drop policy if exists saved_reviews_owner_insert on public.user_saved_reviews;
drop policy if exists saved_reviews_owner_delete on public.user_saved_reviews;
create policy saved_reviews_owner_select on public.user_saved_reviews for select to authenticated using (user_id = auth.uid());
create policy saved_reviews_owner_insert on public.user_saved_reviews for insert to authenticated with check (user_id = auth.uid());
create policy saved_reviews_owner_delete on public.user_saved_reviews for delete to authenticated using (user_id = auth.uid());

revoke all on public.user_saved_reviews from anon;
grant select, insert, delete on public.user_saved_reviews to authenticated;

-- Keep the list sane: at most 200 saved reviews per reader (same cap as the browser list).
create or replace function public.limit_saved_reviews() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.user_saved_reviews where user_id = new.user_id) >= 200 then
    raise exception 'You can keep at most 200 saved reviews.';
  end if;
  return new;
end $$;
drop trigger if exists trg_limit_saved_reviews on public.user_saved_reviews;
create trigger trg_limit_saved_reviews before insert on public.user_saved_reviews for each row execute function public.limit_saved_reviews();

-- ROLLBACK (only if you ever need to undo):
--   drop table if exists public.user_saved_reviews;
--   drop function if exists public.limit_saved_reviews();
