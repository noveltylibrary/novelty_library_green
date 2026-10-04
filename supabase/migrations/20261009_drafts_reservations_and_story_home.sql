-- Novelty Library: named review drafts (max 5) + book reservations + availability guardrails + notifications
begin;

-- -----------------------------------------------------------------------------
-- 1. Named review drafts, up to 5 per account
-- -----------------------------------------------------------------------------
create table if not exists public.review_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Draft [1]',
  draft_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.review_drafts add column if not exists name text;
alter table public.review_drafts alter column name set default 'Draft [1]';
update public.review_drafts set name = 'Draft [1]' where name is null or btrim(name) = '';
alter table public.review_drafts alter column name set not null;
alter table public.review_drafts add column if not exists created_at timestamptz not null default now();
alter table public.review_drafts add column if not exists updated_at timestamptz not null default now();

-- An older deployment stored only one draft per user. Remove only a unique
-- constraint/index whose sole key is user_id so the account can hold five.
do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'review_drafts'
      and c.contype = 'u'
      and (
        select string_agg(a.attname, ',' order by x.ordinality)
        from unnest(c.conkey) with ordinality as x(attnum, ordinality)
        join pg_attribute a on a.attrelid = t.oid and a.attnum = x.attnum
      ) = 'user_id'
  loop
    execute format('alter table public.review_drafts drop constraint if exists %I', r.conname);
  end loop;
end $$;

do $$
declare r record;
begin
  for r in
    select indexname
    from pg_indexes
    where schemaname = 'public' and tablename = 'review_drafts'
      and indexdef ilike '%UNIQUE%'
      and indexdef ilike '%(user_id)%'
      and indexname not ilike '%pkey%'
  loop
    execute format('drop index if exists public.%I', r.indexname);
  end loop;
end $$;

alter table public.review_drafts enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='review_drafts' and policyname='review_drafts_owner_select') then
    create policy review_drafts_owner_select on public.review_drafts for select to authenticated using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='review_drafts' and policyname='review_drafts_owner_insert') then
    create policy review_drafts_owner_insert on public.review_drafts for insert to authenticated with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='review_drafts' and policyname='review_drafts_owner_update') then
    create policy review_drafts_owner_update on public.review_drafts for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='review_drafts' and policyname='review_drafts_owner_delete') then
    create policy review_drafts_owner_delete on public.review_drafts for delete to authenticated using (auth.uid() = user_id);
  end if;
end $$;

create or replace function public.enforce_review_draft_limit()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  draft_count integer;
begin
  if public.is_admin() then return new; end if;
  select count(*) into draft_count from public.review_drafts where user_id = new.user_id and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);
  if draft_count >= 5 then
    raise exception 'You can save up to 5 drafts per account.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_review_drafts_limit on public.review_drafts;
create trigger trg_review_drafts_limit
before insert on public.review_drafts
for each row execute function public.enforce_review_draft_limit();

-- -----------------------------------------------------------------------------
-- 2. Book reservations
-- -----------------------------------------------------------------------------
create table if not exists public.book_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  book_name text not null,
  author_name text,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  admin_note text,
  admin_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.book_reservations enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='book_reservations' and policyname='book_reservations_owner_select') then
    create policy book_reservations_owner_select on public.book_reservations for select to authenticated using (auth.uid() = user_id or public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='book_reservations' and policyname='book_reservations_owner_insert') then
    create policy book_reservations_owner_insert on public.book_reservations for insert to authenticated with check (auth.uid() = user_id or public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='book_reservations' and policyname='book_reservations_admin_update') then
    create policy book_reservations_admin_update on public.book_reservations for update to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='book_reservations' and policyname='book_reservations_admin_delete') then
    create policy book_reservations_admin_delete on public.book_reservations for delete to authenticated using (public.is_admin());
  end if;
end $$;

create index if not exists book_reservations_status_idx on public.book_reservations(status);
create index if not exists book_reservations_book_name_idx on public.book_reservations(lower(book_name));

create or replace function public.normalize_book_title(p_title text)
returns text
language sql
immutable
as $$
  select regexp_replace(lower(coalesce(p_title,'')), '[^a-z0-9]+', '', 'g');
$$;

create or replace function public.check_book_availability(p_title text)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select case
    when exists (
      select 1 from public.book_reservations br
      where br.status = 'accepted'
        and public.normalize_book_title(br.book_name) = public.normalize_book_title(p_title)
    ) then jsonb_build_object('unavailable', true, 'reason', 'reserved')
    when exists (
      select 1 from public.master_list ml
      where public.normalize_book_title(ml.book_title) = public.normalize_book_title(p_title)
    ) then jsonb_build_object('unavailable', true, 'reason', 'reviewed')
    when exists (
      select 1 from public.reviews r
      where r.status = 'approved'
        and public.normalize_book_title(r.title) = public.normalize_book_title(p_title)
    ) then jsonb_build_object('unavailable', true, 'reason', 'reviewed')
    else jsonb_build_object('unavailable', false, 'reason', 'available')
  end;
$$;
revoke all on function public.check_book_availability(text) from public;
grant execute on function public.check_book_availability(text) to anon, authenticated;

create or replace function public.guard_review_book_availability()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  result jsonb;
begin
  if public.is_admin() then return new; end if;
  result := public.check_book_availability(new.title);
  if coalesce((result->>'unavailable')::boolean, false) then
    if result->>'reason' = 'reserved' then
      raise exception 'This book is already reserved. Please pick another book.' using errcode = 'unique_violation';
    else
      raise exception 'This book is already reviewed. Please pick another book.' using errcode = 'unique_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_review_book_availability on public.reviews;
create trigger trg_guard_review_book_availability
before insert on public.reviews
for each row execute function public.guard_review_book_availability();

create or replace function public.guard_book_reservation_acceptance()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  normalized text := public.normalize_book_title(new.book_name);
begin
  if new.status = 'accepted' and coalesce(old.status,'') <> 'accepted' then
    if exists (select 1 from public.master_list ml where public.normalize_book_title(ml.book_title) = normalized)
       or exists (select 1 from public.reviews r where r.status = 'approved' and public.normalize_book_title(r.title) = normalized) then
      raise exception 'This book is already reviewed. Please choose another book.' using errcode = 'unique_violation';
    end if;
    if exists (select 1 from public.book_reservations br where br.status = 'accepted' and br.id <> new.id and public.normalize_book_title(br.book_name) = normalized) then
      raise exception 'This book is already reserved. Please choose another book.' using errcode = 'unique_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_book_reservation_acceptance on public.book_reservations;
create trigger trg_guard_book_reservation_acceptance
before insert or update on public.book_reservations
for each row execute function public.guard_book_reservation_acceptance();

-- -----------------------------------------------------------------------------
-- 3. Reservation notifications
-- -----------------------------------------------------------------------------
create or replace function public.notify_book_reservation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  admin_row record;
begin
  if tg_op = 'INSERT' then
    if new.user_id is not null then
      insert into public.notifications (user_id, kind, title, body, review_id, review_number)
      values (new.user_id, 'reservation_requested', 'Reservation request filled',
        'Your reservation request for “' || new.book_name || '” has been sent to Novelty Library for admin approval.', null, null);
    end if;
    for admin_row in select user_id from public.admin_users loop
      insert into public.notifications (user_id, kind, title, body, review_id, review_number)
      values (admin_row.user_id, 'reservation_requested', 'New reservation request',
        case when new.author_name is null or btrim(new.author_name) = ''
          then 'A reservation request was filled for “' || new.book_name || '”.'
          else 'A reservation request was filled for “' || new.book_name || '” by ' || new.author_name || '.' end,
        null, null);
    end loop;
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status and new.user_id is not null then
    if new.status = 'accepted' then
      insert into public.notifications (user_id, kind, title, body, review_id, review_number)
      values (new.user_id, 'reservation_accepted', 'Book reserved',
        '“' || new.book_name || '” has been reserved for you.', null, null);
    elsif new.status = 'rejected' then
      insert into public.notifications (user_id, kind, title, body, review_id, review_number)
      values (new.user_id, 'reservation_rejected', 'Reservation declined',
        'Your reservation request for “' || new.book_name || '” was declined.', null, null);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_book_reservation on public.book_reservations;
create trigger trg_notify_book_reservation
after insert or update on public.book_reservations
for each row execute function public.notify_book_reservation();

commit;
