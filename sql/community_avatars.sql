-- Run once in the Supabase SQL editor.
-- Lets comments, replies and reader reviews show each reader's profile-card picture.
-- Returns avatar_url only when the reader has NOT switched their profile picture off
-- (profile_visibility.avatar = false hides it).
create or replace function public.community_user_avatars(p_ids uuid[])
returns table (id uuid, avatar_url text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.avatar_url
  from public.profiles p
  where p.id = any(p_ids)
    and (p.profile_visibility ->> 'avatar') is distinct from 'false'
    and p.avatar_url is not null;
$$;

revoke all on function public.community_user_avatars(uuid[]) from public;
grant execute on function public.community_user_avatars(uuid[]) to anon, authenticated;
