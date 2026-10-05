-- Novelty Library 1.24
-- Additive migration for user reports, automatic 30-report blacklisting,
-- grievances, and admin moderation alerts.

create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists is_blacklisted boolean not null default false,
  add column if not exists blacklisted_at timestamptz,
  add column if not exists blacklist_reason text,
  add column if not exists blacklist_report_count integer not null default 0;

create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  details text,
  created_at timestamptz not null default now(),
  constraint user_reports_not_self check (reporter_id <> target_user_id),
  constraint user_reports_reason_len check (char_length(reason) between 2 and 120),
  constraint user_reports_details_len check (details is null or char_length(details) <= 2000),
  constraint user_reports_one_per_reporter_target unique (reporter_id, target_user_id)
);

create index if not exists user_reports_target_idx on public.user_reports(target_user_id, created_at desc);
create index if not exists user_reports_reporter_idx on public.user_reports(reporter_id, created_at desc);

create table if not exists public.user_grievances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  subject text not null,
  details text not null,
  status text not null default 'Submitted',
  reference_no text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_grievances_status_check check (status in ('Submitted','Under Review','Resolved','Rejected')),
  constraint user_grievances_category_len check (char_length(category) between 2 and 80),
  constraint user_grievances_subject_len check (char_length(subject) between 2 and 160),
  constraint user_grievances_details_len check (char_length(details) between 5 and 5000)
);

create index if not exists user_grievances_user_idx on public.user_grievances(user_id, created_at desc);
create index if not exists user_grievances_status_idx on public.user_grievances(status, created_at desc);

create or replace function public.nl_is_admin()
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  begin
    return coalesce(public.is_admin(), false);
  exception when undefined_function then
    return false;
  end;
end;
$$;

grant execute on function public.nl_is_admin() to authenticated;

create or replace function public.nl_notify_admins(p_kind text, p_title text, p_body text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  r record;
begin
  -- admin_list_admins() is already used by the existing admin-management UI.
  -- Dynamic SQL keeps this migration installable even if an older database has
  -- not exposed that function in its schema cache yet.
  begin
    for r in execute 'select u.id from auth.users u where lower(coalesce(u.email, '''')) in (select lower(email) from public.admin_list_admins())' loop
      insert into public.notifications (user_id, kind, title, body, review_id, review_number, read_at, created_at)
      values (r.id, 'system', p_title, p_body, null, null, null, now());
    end loop;
  exception when undefined_function then
    -- No admin directory function: the existing admin system can be upgraded
    -- later without preventing the report/grievance transaction itself.
    null;
  end;
end;
$$;

grant execute on function public.nl_notify_admins(text,text,text) to authenticated;

create or replace function public.submit_user_report(p_target_user_id uuid, p_reason text, p_details text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_reporter uuid := auth.uid();
  v_count integer;
  v_blacklisted boolean;
  v_reason text := left(trim(coalesce(p_reason, '')), 120);
  v_details text := nullif(left(trim(coalesce(p_details, '')), 2000), '');
  v_name text;
begin
  if v_reporter is null then raise exception 'You must be signed in to report a user.'; end if;
  if p_target_user_id is null or p_target_user_id = v_reporter then raise exception 'You cannot report your own profile.'; end if;
  if char_length(v_reason) < 2 then raise exception 'Choose a report reason.'; end if;

  insert into public.user_reports(reporter_id, target_user_id, reason, details)
  values (v_reporter, p_target_user_id, v_reason, v_details)
  on conflict (reporter_id, target_user_id) do nothing;

  select count(*) into v_count from public.user_reports where target_user_id = p_target_user_id;
  v_blacklisted := v_count >= 30;

  if v_blacklisted then
    select coalesce(nullif(trim(p.name), ''), p.novelty_username, 'Novelty Library user')
      into v_name from public.profiles p where p.id = p_target_user_id;

    update public.profiles
      set is_blacklisted = true,
          blacklisted_at = coalesce(blacklisted_at, now()),
          blacklist_report_count = v_count,
          blacklist_reason = coalesce(blacklist_reason, 'Automatic blacklist: 30 or more community reports.'),
          updated_at = now()
      where id = p_target_user_id;

    if not exists (select 1 from public.notifications where kind = 'user_blacklisted' and body like '%' || p_target_user_id::text || '%' limit 1) then
      perform public.nl_notify_admins(
        'user_blacklisted',
        'User automatically blacklisted',
        'User ' || coalesce(v_name, p_target_user_id::text) || ' (' || p_target_user_id::text || ') reached ' || v_count || ' reports and was automatically blacklisted.'
      );
    end if;
  else
    update public.profiles set blacklist_report_count = v_count where id = p_target_user_id;
  end if;

  return jsonb_build_object('report_count', v_count, 'blacklisted', v_blacklisted);
end;
$$;

grant execute on function public.submit_user_report(uuid,text,text) to authenticated;

create or replace function public.is_profile_blacklisted(p_username text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce((select is_blacklisted from public.profiles where lower(novelty_username) = lower(trim(both '@' from p_username)) limit 1), false);
$$;

grant execute on function public.is_profile_blacklisted(text) to anon, authenticated;

create or replace function public.submit_grievance(p_category text, p_subject text, p_details text)
returns public.user_grievances
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_row public.user_grievances;
  v_ref text;
begin
  if v_user is null then raise exception 'You must be signed in to submit a grievance.'; end if;
  if char_length(trim(coalesce(p_category,''))) < 2 then raise exception 'Choose a grievance category.'; end if;
  if char_length(trim(coalesce(p_subject,''))) < 2 then raise exception 'Enter a grievance subject.'; end if;
  if char_length(trim(coalesce(p_details,''))) < 5 then raise exception 'Please provide more detail.'; end if;

  v_ref := 'GRV-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 10));
  insert into public.user_grievances(user_id, category, subject, details, reference_no)
  values (v_user, left(trim(p_category),80), left(trim(p_subject),160), left(trim(p_details),5000), v_ref)
  returning * into v_row;

  perform public.nl_notify_admins(
    'grievance_submitted',
    'New grievance submitted',
    'A new grievance ' || v_row.reference_no || ' was submitted by user ' || v_user::text || ': ' || v_row.subject
  );

  return v_row;
end;
$$;

grant execute on function public.submit_grievance(text,text,text) to authenticated;

create or replace function public.admin_list_blacklisted_users()
returns table (
  user_id uuid,
  name text,
  novelty_username text,
  avatar_url text,
  report_count integer,
  blacklisted_at timestamptz,
  blacklist_reason text
)
language sql
security definer
set search_path = public
as $$
  select p.id, p.name, p.novelty_username, p.avatar_url, p.blacklist_report_count, p.blacklisted_at, p.blacklist_reason
  from public.profiles p
  where public.nl_is_admin() and p.is_blacklisted = true
  order by p.blacklisted_at desc nulls last;
$$;

grant execute on function public.admin_list_blacklisted_users() to authenticated;

drop policy if exists "users can submit reports" on public.user_reports;
drop policy if exists "users can see own reports" on public.user_reports;
drop policy if exists "users can create own grievances" on public.user_grievances;
drop policy if exists "users can read own grievances" on public.user_grievances;
drop policy if exists "admins can update grievances" on public.user_grievances;

alter table public.user_reports enable row level security;
alter table public.user_grievances enable row level security;

create policy "users can submit reports" on public.user_reports
  for insert to authenticated
  with check (reporter_id = auth.uid() and reporter_id <> target_user_id);

create policy "users can see own reports" on public.user_reports
  for select to authenticated
  using (reporter_id = auth.uid() or public.nl_is_admin());

create policy "users can create own grievances" on public.user_grievances
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "users can read own grievances" on public.user_grievances
  for select to authenticated
  using (user_id = auth.uid() or public.nl_is_admin());

create policy "admins can update grievances" on public.user_grievances
  for update to authenticated
  using (public.nl_is_admin())
  with check (public.nl_is_admin());

-- Keep report counts synchronized if an administrator removes a report manually.
create or replace function public.nl_sync_blacklist_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target uuid := coalesce(new.target_user_id, old.target_user_id);
  v_count integer;
begin
  select count(*) into v_count from public.user_reports where target_user_id = v_target;
  update public.profiles set blacklist_report_count = v_count where id = v_target;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_nl_sync_blacklist_count on public.user_reports;
create trigger trg_nl_sync_blacklist_count
after delete on public.user_reports
for each row execute function public.nl_sync_blacklist_count();

comment on table public.user_reports is 'Community reports of user profiles; one report per reporter/target pair.';
comment on table public.user_grievances is 'Private grievance/support records submitted by signed-in Novelty Library users.';
