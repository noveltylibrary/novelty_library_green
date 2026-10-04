-- Novelty Library — Security Hardening V1
-- 2026-10-04
-- Run as a single migration in the Supabase SQL Editor.
-- This migration is deliberately defensive against the existing Novelty Library
-- schema: it does not ALTER storage.objects ownership or assume site_settings.value is jsonb.

begin;

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. Server-authoritative admin directory
-- -----------------------------------------------------------------------------
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  email_verified_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

alter table public.admin_users add column if not exists email text;
alter table public.admin_users add column if not exists email_verified_at timestamptz;
alter table public.admin_users add column if not exists created_at timestamptz not null default now();

-- Backfill administrator email metadata from Auth without trusting client input.
update public.admin_users a
set email = u.email,
    email_verified_at = u.email_confirmed_at
from auth.users u
where u.id = a.user_id;

-- Preserve an older admin_emails table if one exists, but only promote an
-- already-created and email-verified Auth account.
do $$
begin
  if to_regclass('public.admin_emails') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema='public' and table_name='admin_emails' and column_name='email'
     ) then
    insert into public.admin_users (user_id, email, email_verified_at)
    select u.id, u.email, u.email_confirmed_at
    from auth.users u
    join public.admin_emails ae on lower(ae.email) = lower(u.email)
    where u.email_confirmed_at is not null
    on conflict (user_id) do update
      set email = excluded.email,
          email_verified_at = excluded.email_verified_at;
  end if;
end $$;

create unique index if not exists admin_users_email_lower_idx
  on public.admin_users (lower(email))
  where email is not null;

-- Admin lookup is SECURITY DEFINER and checks Auth verification state.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select exists (
    select 1
    from public.admin_users a
    join auth.users u on u.id = a.user_id
    where a.user_id = auth.uid()
      and u.email_confirmed_at is not null
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- No direct client access to the administrator directory.
do $$
declare
  p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname='public' and tablename='admin_users'
  loop
    execute format('drop policy if exists %I on public.admin_users', p.policyname);
  end loop;
end $$;

create policy admin_users_admin_only_select
  on public.admin_users for select to authenticated
  using (public.is_admin());

create policy admin_users_admin_only_insert
  on public.admin_users for insert to authenticated
  with check (public.is_admin());

create policy admin_users_admin_only_update
  on public.admin_users for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy admin_users_admin_only_delete
  on public.admin_users for delete to authenticated
  using (public.is_admin());

-- -----------------------------------------------------------------------------
-- 2. Reviews — fix guest submission / moderation boundary
-- -----------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.reviews') is null then
    raise notice 'public.reviews does not exist; skipping review policies';
    return;
  end if;

  -- Remove every existing review policy so an older permissive policy cannot
  -- accidentally survive and bypass the new boundary.
  for r in
    select policyname from pg_policies
    where schemaname='public' and tablename='reviews'
  loop
    execute format('drop policy if exists %I on public.reviews', r.policyname);
  end loop;

  alter table public.reviews enable row level security;

  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='reviews' and column_name='status') then
    alter table public.reviews alter column status set default 'pending';
  end if;

  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='reviews' and column_name='approved') then
    alter table public.reviews alter column approved set default false;
  end if;
end $$;

-- Force every new public submission into the moderation queue. This is the
-- database backstop even if a malicious client explicitly sends approved=true
-- or status='approved'. Existing approved records are left untouched.
create or replace function public.enforce_review_moderation_state()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.is_admin() then
    if tg_op = 'INSERT' then
      if to_regclass('public.reviews') is not null then
        -- Never trust a client-supplied reviewer identity. Anonymous inserts
        -- remain NULL; authenticated inserts are bound to auth.uid().
        if to_jsonb(new) ? 'user_id' then
          new := jsonb_populate_record(new, jsonb_build_object('user_id', auth.uid()));
        end if;
        if to_jsonb(new) ? 'status' then
          new := jsonb_populate_record(new, jsonb_build_object('status', 'pending'));
        end if;
        if to_jsonb(new) ? 'approved' then
          new := jsonb_populate_record(new, jsonb_build_object('approved', false));
        end if;
      end if;
    elsif tg_op = 'UPDATE' then
      if to_jsonb(old) ? 'status' then
        new := jsonb_populate_record(new, jsonb_build_object('status', to_jsonb(old)->'status'));
      end if;
      if to_jsonb(old) ? 'approved' then
        new := jsonb_populate_record(new, jsonb_build_object('approved', to_jsonb(old)->'approved'));
      end if;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_review_moderation_state() from public;

do $$
begin
  if to_regclass('public.reviews') is not null then
    drop trigger if exists trg_reviews_enforce_moderation_state on public.reviews;
    create trigger trg_reviews_enforce_moderation_state
      before insert or update on public.reviews
      for each row execute function public.enforce_review_moderation_state();
  end if;
end $$;

-- Guest + authenticated INSERT. The trigger above forces moderation state.
do $$
begin
  if to_regclass('public.reviews') is not null then
    execute 'create policy reviews_public_insert on public.reviews for insert to public with check (true)';
  end if;
end $$;

-- Public SELECT is strictly approved/published. Authenticated users do not get
-- a second unrestricted SELECT policy here; admin UI should use admin authority.
do $$
begin
  if to_regclass('public.reviews') is null then return; end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='reviews' and column_name='approved') then
    execute 'create policy reviews_public_select on public.reviews for select to public using (approved = true)';
  elsif exists (select 1 from information_schema.columns where table_schema='public' and table_name='reviews' and column_name='status') then
    execute 'create policy reviews_public_select on public.reviews for select to public using (status = ''approved'')';
  else
    raise exception 'public.reviews has neither approved nor status; refusing to create an unsafe public SELECT policy';
  end if;
end $$;

-- Administrators must be able to review pending/declined submissions. The
-- public SELECT policy remains limited to approved rows; PostgreSQL combines
-- SELECT policies with OR semantics.
create policy reviews_admin_select
  on public.reviews for select to authenticated
  using (public.is_admin());

-- Owner-only writes, plus server-authoritative admin moderation.
do $$
begin
  if to_regclass('public.reviews') is not null and exists (
    select 1 from information_schema.columns where table_schema='public' and table_name='reviews' and column_name='user_id'
  ) then
    execute 'create policy reviews_owner_or_admin_update on public.reviews for update to authenticated using (auth.uid() = user_id or public.is_admin()) with check (auth.uid() = user_id or public.is_admin())';
    execute 'create policy reviews_owner_or_admin_delete on public.reviews for delete to authenticated using (auth.uid() = user_id or public.is_admin())';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 3. Profiles — users cannot promote themselves
-- -----------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.profiles') is null then return; end if;

  alter table public.profiles enable row level security;

  -- Remove only policies that explicitly allow profile self-update; the trigger
  -- below remains the final authority over privileged columns.
  for r in
    select policyname from pg_policies
    where schemaname='public' and tablename='profiles'
  loop
    if r.policyname ilike '%update%' or r.policyname ilike '%insert%' then
      execute format('drop policy if exists %I on public.profiles', r.policyname);
    end if;
  end loop;

  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='id') then
    execute 'create policy profiles_self_insert on public.profiles for insert to authenticated with check (auth.uid() = id)';
    execute 'create policy profiles_self_update on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id)';
  end if;
end $$;

create or replace function public.protect_profile_privilege_fields()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if to_jsonb(old) ? 'is_admin' then
      new := jsonb_populate_record(new, jsonb_build_object('is_admin', to_jsonb(old)->'is_admin'));
    end if;
    if to_jsonb(old) ? 'role' then
      new := jsonb_populate_record(new, jsonb_build_object('role', to_jsonb(old)->'role'));
    end if;
  elsif tg_op = 'INSERT' then
    if to_jsonb(new) ? 'is_admin' then
      new := jsonb_populate_record(new, jsonb_build_object('is_admin', false));
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.protect_profile_privilege_fields() from public;

do $$
begin
  if to_regclass('public.profiles') is not null then
    if exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name in ('is_admin','role')) then
      drop trigger if exists trg_profiles_protect_privilege_fields on public.profiles;
      create trigger trg_profiles_protect_privilege_fields
        before insert or update on public.profiles
        for each row execute function public.protect_profile_privilege_fields();
    end if;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 4. site_settings — admin-only database access
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.site_settings') is null then return; end if;
  alter table public.site_settings enable row level security;
  for r in select policyname from pg_policies where schemaname='public' and tablename='site_settings' loop
    execute format('drop policy if exists %I on public.site_settings', r.policyname);
  end loop;
  execute 'create policy site_settings_admin_select on public.site_settings for select to authenticated using (public.is_admin())';
  execute 'create policy site_settings_admin_insert on public.site_settings for insert to authenticated with check (public.is_admin())';
  execute 'create policy site_settings_admin_update on public.site_settings for update to authenticated using (public.is_admin()) with check (public.is_admin())';
  execute 'create policy site_settings_admin_delete on public.site_settings for delete to authenticated using (public.is_admin())';
end $$;

-- Keep the public support-email RPC working without exposing the settings table.
create or replace function public.get_site_support_email()
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v text;
begin
  if to_regclass('public.site_settings') is null then
    return 'support.noveltylibrary@gmail.com';
  end if;

  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='site_settings' and column_name='value') then
    select s.value::text into v
    from public.site_settings s
    where s.key = 'support_email'
    limit 1;
  end if;

  if v is null or btrim(v) = '' then
    return 'support.noveltylibrary@gmail.com';
  end if;

  -- Existing Novelty Library deployments store this as TEXT. If legacy data
  -- happens to contain JSON, safely extract {"email": ...} without requiring
  -- the column itself to be jsonb.
  if left(btrim(v), 1) = '{' then
    begin
      v := (v::jsonb ->> 'email');
    exception when others then
      null;
    end;
  end if;

  return coalesce(nullif(btrim(v), ''), 'support.noveltylibrary@gmail.com');
end;
$$;

grant execute on function public.get_site_support_email() to anon, authenticated;

create or replace function public.set_site_support_email(p_email text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if btrim(p_email) !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Invalid support email';
  end if;
  if to_regclass('public.site_settings') is null then raise exception 'site_settings table is missing'; end if;

  update public.site_settings
  set value = lower(btrim(p_email))
  where key = 'support_email';

  if not found then
    insert into public.site_settings(key, value)
    values ('support_email', lower(btrim(p_email)));
  end if;
end;
$$;

revoke all on function public.set_site_support_email(text) from public;
grant execute on function public.set_site_support_email(text) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Finance tables/modules — admin-only
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['finances','finance_modules'] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      for r in select policyname from pg_policies where schemaname='public' and tablename=t loop
        execute format('drop policy if exists %I on public.%I', r.policyname, t);
      end loop;
      execute format('create policy %I_admin_select on public.%I for select to authenticated using (public.is_admin())', t, t);
      execute format('create policy %I_admin_insert on public.%I for insert to authenticated with check (public.is_admin())', t, t);
      execute format('create policy %I_admin_update on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())', t, t);
      execute format('create policy %I_admin_delete on public.%I for delete to authenticated using (public.is_admin())', t, t);
    end if;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 6. Storage — bucket-level 5 MB/MIME enforcement + object RLS
-- Do NOT ALTER storage.objects ownership. Supabase owns this managed table.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg','image/png','image/webp']::text[]),
  ('posters', 'posters', true, 5242880, array['image/jpeg','image/png','image/webp']::text[])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- The app currently stores review posters under covers/posters/{review_no}/... .
-- Harden that existing bucket too when it exists.
do $$
begin
  if exists (select 1 from storage.buckets where id='covers') then
    update storage.buckets
    set file_size_limit = 5242880,
        allowed_mime_types = array['image/jpeg','image/png','image/webp']::text[]
    where id='covers';
  end if;
end $$;

-- Drop only our known policy names so unrelated Storage policies are preserved.
do $$
begin
  execute 'drop policy if exists avatars_public_read on storage.objects';
  execute 'drop policy if exists avatars_owner_insert on storage.objects';
  execute 'drop policy if exists avatars_owner_update on storage.objects';
  execute 'drop policy if exists avatars_owner_delete on storage.objects';
  execute 'drop policy if exists posters_public_read on storage.objects';
  execute 'drop policy if exists posters_owner_or_admin_insert on storage.objects';
  execute 'drop policy if exists posters_owner_or_admin_update on storage.objects';
  execute 'drop policy if exists posters_owner_or_admin_delete on storage.objects';
  execute 'drop policy if exists covers_posters_public_read on storage.objects';
  execute 'drop policy if exists covers_posters_admin_insert on storage.objects';
  execute 'drop policy if exists covers_posters_admin_update on storage.objects';
  execute 'drop policy if exists covers_posters_admin_delete on storage.objects';
end $$;

create policy avatars_public_read
  on storage.objects for select to public
  using (bucket_id = 'avatars');

create policy avatars_owner_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (storage.extension(name) in ('jpg','jpeg','png','webp'))
  );

create policy avatars_owner_update
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (storage.extension(name) in ('jpg','jpeg','png','webp'))
  );

create policy avatars_owner_delete
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy posters_public_read
  on storage.objects for select to public
  using (bucket_id = 'posters');

create policy posters_owner_or_admin_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'posters'
    and (public.is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
    and storage.extension(name) in ('jpg','jpeg','png','webp')
  );

create policy posters_owner_or_admin_update
  on storage.objects for update to authenticated
  using (bucket_id = 'posters' and (public.is_admin() or (storage.foldername(name))[1] = auth.uid()::text))
  with check (
    bucket_id = 'posters'
    and (public.is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
    and storage.extension(name) in ('jpg','jpeg','png','webp')
  );

create policy posters_owner_or_admin_delete
  on storage.objects for delete to authenticated
  using (bucket_id = 'posters' and (public.is_admin() or (storage.foldername(name))[1] = auth.uid()::text));

-- Existing Novelty Library poster workflow: covers/posters/{review_no}/...
do $$
begin
  if exists (select 1 from storage.buckets where id='covers') then
    execute 'create policy covers_posters_public_read on storage.objects for select to public using (bucket_id = ''covers'' and name like ''posters/%'')';
    execute 'create policy covers_posters_admin_insert on storage.objects for insert to authenticated with check (bucket_id = ''covers'' and name like ''posters/%'' and public.is_admin() and storage.extension(name) in (''jpg'',''jpeg'',''png'',''webp''))';
    execute 'create policy covers_posters_admin_update on storage.objects for update to authenticated using (bucket_id = ''covers'' and name like ''posters/%'' and public.is_admin()) with check (bucket_id = ''covers'' and name like ''posters/%'' and public.is_admin() and storage.extension(name) in (''jpg'',''jpeg'',''png'',''webp''))';
    execute 'create policy covers_posters_admin_delete on storage.objects for delete to authenticated using (bucket_id = ''covers'' and name like ''posters/%'' and public.is_admin())';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 7. Verification output
-- -----------------------------------------------------------------------------
select 'reviews_rls' as check_name,
       case when to_regclass('public.reviews') is not null and c.relrowsecurity then 'enabled' else 'missing_or_disabled' end as result
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='reviews';

select tablename, policyname, cmd
from pg_policies
where schemaname='public'
  and tablename in ('reviews','profiles','site_settings','finances','finance_modules','admin_users')
order by tablename, policyname;

select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in ('avatars','posters','covers')
order by id;

commit;
