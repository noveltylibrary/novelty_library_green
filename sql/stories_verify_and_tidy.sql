-- 1) VERIFY: are older stories still in the table after a new upload? (read-only)
--    You should see several rows per user_id, each with a different created_at.
select user_id, novelty_username, id, created_at, expires_at,
       left(image_url, 60) as image_path, caption
  from public.stories
 where expires_at > now()
 order by user_id, created_at desc;

-- 2) OPTIONAL speed-up for the active-stories lookup (safe to run).
create index if not exists stories_user_created_idx on public.stories (user_id, created_at desc);
create index if not exists stories_expires_idx       on public.stories (expires_at);

-- 3) OPTIONAL privacy fix - run ONLY if stories must be visible to followers only.
--    Today "stories_public_read" lets everyone read every active story, which
--    overrides "stories_followers_active_read" (permissive policies are OR-ed).
-- drop policy if exists stories_public_read on public.stories;
