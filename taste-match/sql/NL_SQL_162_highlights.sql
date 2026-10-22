-- NL_SQL_162: Story Highlights + 30-day story archive.
-- Run once in Supabase -> SQL editor. Additive only: no existing table, column or policy is changed or removed.
-- Reading pages, reviews and everything the AdSense crawler sees are untouched.

-- 1) Archive: an owner can read their OWN stories for 30 days (the old policy only showed unexpired ones).
create policy stories_owner_archive_read on public.stories
  for select to authenticated
  using (user_id = auth.uid() and created_at > now() - interval '30 days');

-- 2) Highlights (max 7 per reader) and their photos (max 30 per highlight).
create table if not exists public.story_highlights (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 24),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create table if not exists public.story_highlight_items (
  id               uuid primary key default gen_random_uuid(),
  highlight_id     uuid not null references public.story_highlights(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  image_path       text not null,                      -- path inside the public 'highlights' bucket
  caption          text check (caption is null or char_length(caption) <= 240),
  source_story_id  uuid,                               -- no FK: the story row is deleted after 30 days, the highlight stays
  story_created_at timestamptz,
  created_at       timestamptz not null default now(),
  unique (highlight_id, source_story_id)
);
create index if not exists story_highlights_user_idx on public.story_highlights (user_id, sort_order, created_at);
create index if not exists story_highlight_items_hl_idx on public.story_highlight_items (highlight_id, created_at);

alter table public.story_highlights enable row level security;
alter table public.story_highlight_items enable row level security;

create policy highlights_public_read on public.story_highlights for select to anon, authenticated using (true);
create policy highlights_owner_insert on public.story_highlights for insert to authenticated with check (user_id = auth.uid());
create policy highlights_owner_update on public.story_highlights for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy highlights_owner_delete on public.story_highlights for delete to authenticated using (user_id = auth.uid());

create policy highlight_items_public_read on public.story_highlight_items for select to anon, authenticated using (true);
create policy highlight_items_owner_insert on public.story_highlight_items for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.story_highlights h where h.id = highlight_id and h.user_id = auth.uid()));
create policy highlight_items_owner_delete on public.story_highlight_items for delete to authenticated using (user_id = auth.uid());

create or replace function public.limit_story_highlights() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.story_highlights where user_id = new.user_id) >= 7 then
    raise exception 'You can keep at most 7 highlights.';
  end if;
  return new;
end $$;
drop trigger if exists trg_limit_story_highlights on public.story_highlights;
create trigger trg_limit_story_highlights before insert on public.story_highlights for each row execute function public.limit_story_highlights();

create or replace function public.limit_highlight_items() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.story_highlight_items where highlight_id = new.highlight_id) >= 30 then
    raise exception 'A highlight can hold at most 30 photos.';
  end if;
  return new;
end $$;
drop trigger if exists trg_limit_highlight_items on public.story_highlight_items;
create trigger trg_limit_highlight_items before insert on public.story_highlight_items for each row execute function public.limit_highlight_items();

-- 3) Public bucket for highlight photos (copied from the private 'stories' bucket so they outlive the 30-day purge).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('highlights', 'highlights', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy highlights_storage_own_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'highlights' and (storage.foldername(name))[1] = auth.uid()::text
              and lower(storage.extension(name)) in ('jpg','jpeg','png','webp'));
create policy highlights_storage_own_delete on storage.objects for delete to authenticated
  using (bucket_id = 'highlights' and (storage.foldername(name))[1] = auth.uid()::text);

-- 4) Deleting stories after 30 days: deploy the 'purge-stories' Edge Function (supabase/functions/purge-stories),
--    then schedule it once a day. Needs the pg_cron and pg_net extensions (Dashboard -> Database -> Extensions).
--    Replace YOUR_SECRET with the same value you set as the function secret CRON_SECRET.
-- select cron.schedule('purge-old-stories', '30 21 * * *', $$
--   select net.http_post(
--     url := 'https://aelcemxrwyddaqaupxaw.supabase.co/functions/v1/purge-stories',
--     headers := '{"Content-Type":"application/json","x-cron-secret":"YOUR_SECRET"}'::jsonb
--   ) $$);
