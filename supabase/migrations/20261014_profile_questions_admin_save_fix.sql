-- Novelty Library: make profile-question administration save reliably.
-- Idempotent: safe to run even when some/all columns already exist.
begin;

alter table if exists public.profile_questions
  add column if not exists placeholder text;

alter table if exists public.profile_questions
  add column if not exists allow_other boolean not null default true;

alter table if exists public.profile_questions
  add column if not exists image_count integer not null default 1;

alter table if exists public.profile_questions
  add column if not exists image_max_mb integer not null default 5;

alter table if exists public.profile_questions
  add column if not exists image_max_width integer not null default 1600;

alter table if exists public.profile_questions
  add column if not exists image_max_height integer not null default 1600;

update public.profile_questions
set image_count = greatest(1, least(6, coalesce(image_count, 1))),
    image_max_mb = greatest(1, least(25, coalesce(image_max_mb, 5))),
    image_max_width = greatest(320, least(6000, coalesce(image_max_width, 1600))),
    image_max_height = greatest(320, least(6000, coalesce(image_max_height, 1600))),
    placeholder = coalesce(placeholder, '')
where true;

-- Ensure admin CRUD is permitted even when the original profile-question policies
-- were created without admin write access.
alter table if exists public.profile_questions enable row level security;

do $$
begin
  if to_regprocedure('public.is_admin()') is not null then
    if not exists (
      select 1 from pg_policies
      where schemaname='public' and tablename='profile_questions'
        and policyname='profile_questions_admin_insert'
    ) then
      execute 'create policy profile_questions_admin_insert on public.profile_questions for insert to authenticated with check (public.is_admin())';
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname='public' and tablename='profile_questions'
        and policyname='profile_questions_admin_update'
    ) then
      execute 'create policy profile_questions_admin_update on public.profile_questions for update to authenticated using (public.is_admin()) with check (public.is_admin())';
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname='public' and tablename='profile_questions'
        and policyname='profile_questions_admin_delete'
    ) then
      execute 'create policy profile_questions_admin_delete on public.profile_questions for delete to authenticated using (public.is_admin())';
    end if;
  end if;
end $$;

-- Keep values within the UI's supported range where constraints are not already present.
do $$
begin
  if not exists (select 1 from pg_constraint where conname='profile_questions_image_count_range') then
    alter table public.profile_questions
      add constraint profile_questions_image_count_range
      check (image_count between 1 and 6);
  end if;
  if not exists (select 1 from pg_constraint where conname='profile_questions_image_max_mb_range') then
    alter table public.profile_questions
      add constraint profile_questions_image_max_mb_range
      check (image_max_mb between 1 and 25);
  end if;
  if not exists (select 1 from pg_constraint where conname='profile_questions_image_width_range') then
    alter table public.profile_questions
      add constraint profile_questions_image_width_range
      check (image_max_width between 320 and 6000);
  end if;
  if not exists (select 1 from pg_constraint where conname='profile_questions_image_height_range') then
    alter table public.profile_questions
      add constraint profile_questions_image_height_range
      check (image_max_height between 320 and 6000);
  end if;
end $$;

commit;

-- Verification
select column_name, data_type
from information_schema.columns
where table_schema='public'
  and table_name='profile_questions'
  and column_name in ('placeholder','allow_other','image_count','image_max_mb','image_max_width','image_max_height')
order by column_name;
