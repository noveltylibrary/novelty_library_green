-- Novelty Library: follow / privacy functions the profile pages call.
-- These did not exist in the live database (checked), which made the public
-- profile page fail. Safe to run more than once.

create or replace function public.get_follow_stats(p_username text)
returns jsonb language sql stable security definer set search_path = public as $$
  with t as (
    select id from public.profiles
    where lower(novelty_username) = lower(regexp_replace(btrim(p_username), '^@', '')) limit 1)
  select jsonb_build_object(
    'followers',    (select count(*) from public.profile_follows f where f.following_id = (select id from t)),
    'following',    (select count(*) from public.profile_follows f where f.follower_id  = (select id from t)),
    'is_following', exists (select 1 from public.profile_follows f
                            where f.following_id = (select id from t) and f.follower_id = auth.uid()));
$$;

create or replace function public.get_profile_privacy(p_username text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'hide_followers', coalesce(p.hide_followers, false),
    'hide_following', coalesce(p.hide_following, false))
  from public.profiles p
  where lower(p.novelty_username) = lower(regexp_replace(btrim(p_username), '^@', '')) limit 1;
$$;

create or replace function public.get_profile_connections(p_username text, p_kind text)
returns table(id uuid, novelty_username text, name text, avatar_url text)
language sql stable security definer set search_path = public as $$
  with t as (
    select * from public.profiles
    where lower(novelty_username) = lower(regexp_replace(btrim(p_username), '^@', '')) limit 1)
  select o.id, o.novelty_username, o.name, o.avatar_url
  from t
  join public.profile_follows f
    on (p_kind = 'followers' and f.following_id = t.id) or (p_kind = 'following' and f.follower_id = t.id)
  join public.profiles o
    on o.id = case when p_kind = 'followers' then f.follower_id else f.following_id end
  where t.id = auth.uid()
     or (p_kind = 'followers' and not coalesce(t.hide_followers, false))
     or (p_kind = 'following' and not coalesce(t.hide_following, false))
  order by f.created_at desc;
$$;

create or replace function public.follow_username(p_username text)
returns void language plpgsql security definer set search_path = public as $$
declare target uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to follow readers.'; end if;
  select id into target from public.profiles
   where lower(novelty_username) = lower(regexp_replace(btrim(p_username), '^@', '')) limit 1;
  if target is null then raise exception 'Reader not found.'; end if;
  if target = auth.uid() then return; end if;
  insert into public.profile_follows(follower_id, following_id) values (auth.uid(), target) on conflict do nothing;
end $$;

create or replace function public.unfollow_username(p_username text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  delete from public.profile_follows
   where follower_id = auth.uid()
     and following_id = (select id from public.profiles
                         where lower(novelty_username) = lower(regexp_replace(btrim(p_username), '^@', '')) limit 1);
end $$;

revoke all on function public.get_follow_stats(text), public.get_profile_privacy(text),
  public.get_profile_connections(text, text), public.follow_username(text), public.unfollow_username(text) from public;
grant execute on function public.get_follow_stats(text), public.get_profile_privacy(text),
  public.get_profile_connections(text, text) to anon, authenticated;
grant execute on function public.follow_username(text), public.unfollow_username(text) to authenticated;
