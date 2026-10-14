-- Novelty Library 1.93 — run once in the Supabase SQL editor (safe to re-run).
-- Lets admins blacklist / restore ANY user from Admin → Users & Accounts.
-- Uses the same profile flags as the automatic 30-reports blacklist, so both kinds show together.
--
-- NOTE: this REPLACES admin_list_blacklisted_users() and is_profile_blacklisted() so they read the
-- profile flags below. If your current versions also derive the count from a reports table, merge that
-- logic back in (report_count here is taken from profiles.report_count when that column exists).

alter table public.profiles add column if not exists blacklisted_at timestamptz;
alter table public.profiles add column if not exists blacklist_reason text;
alter table public.profiles add column if not exists blacklisted_by_admin boolean not null default false;
alter table public.profiles add column if not exists report_count integer not null default 0;

create or replace function public.admin_blacklist_user(p_user_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can blacklist users' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot blacklist your own account';
  end if;

  update public.profiles
     set blacklisted_at = now(),
         blacklist_reason = nullif(left(btrim(coalesce(p_reason, '')), 500), ''),
         blacklisted_by_admin = true
   where id = p_user_id;
  if not found then
    raise exception 'User profile not found';
  end if;
end;
$$;

create or replace function public.admin_unblacklist_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can restore users' using errcode = '42501';
  end if;
  update public.profiles
     set blacklisted_at = null,
         blacklist_reason = null,
         blacklisted_by_admin = false,
         report_count = 0
   where id = p_user_id;
end;
$$;

create or replace function public.admin_list_blacklisted_users()
returns table (
  user_id uuid, name text, novelty_username text, avatar_url text,
  report_count integer, blacklisted_at timestamptz, blacklist_reason text, blacklisted_by_admin boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can view the blacklist' using errcode = '42501';
  end if;
  return query
    select p.id, p.name, p.novelty_username, p.avatar_url, p.report_count, p.blacklisted_at, p.blacklist_reason, p.blacklisted_by_admin
    from public.profiles p
    where p.blacklisted_at is not null
    order by p.blacklisted_at desc;
end;
$$;

create or replace function public.is_profile_blacklisted(p_username text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where lower(p.novelty_username) = lower(regexp_replace(coalesce(p_username, ''), '^@', ''))
      and p.blacklisted_at is not null
  );
$$;

revoke all on function public.admin_blacklist_user(uuid, text) from public, anon;
revoke all on function public.admin_unblacklist_user(uuid) from public, anon;
revoke all on function public.admin_list_blacklisted_users() from public, anon;
grant execute on function public.admin_blacklist_user(uuid, text) to authenticated;
grant execute on function public.admin_unblacklist_user(uuid) to authenticated;
grant execute on function public.admin_list_blacklisted_users() to authenticated;
grant execute on function public.is_profile_blacklisted(text) to anon, authenticated;
