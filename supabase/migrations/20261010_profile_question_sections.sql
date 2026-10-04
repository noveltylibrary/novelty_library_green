-- Novelty Library: editable profile-question sections.
-- Admins can rename the four seeded sections and add additional sections.
-- Renaming a section updates existing questions so no answers/questions are lost.

begin;

create table if not exists public.profile_question_sections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 10,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profile_question_sections_name_unique
  on public.profile_question_sections (lower(btrim(name)));

create unique index if not exists profile_question_sections_sort_unique
  on public.profile_question_sections (sort_order);

insert into public.profile_question_sections (name, sort_order, active)
values
  ('Personal Details', 10, true),
  ('Book Journey', 20, true),
  ('Reading Identity', 30, true),
  ('Custom', 40, true)
on conflict do nothing;

-- Make sure the existing question rows have the correct section ordering.
update public.profile_questions q
set section_order = s.sort_order
from public.profile_question_sections s
where q.section = s.name;

alter table public.profile_question_sections enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='profile_question_sections' and policyname='profile_question_sections_public_select'
  ) then
    create policy profile_question_sections_public_select
      on public.profile_question_sections
      for select
      to anon, authenticated
      using (active = true or public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='profile_question_sections' and policyname='profile_question_sections_admin_insert'
  ) then
    create policy profile_question_sections_admin_insert
      on public.profile_question_sections
      for insert
      to authenticated
      with check (public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='profile_question_sections' and policyname='profile_question_sections_admin_update'
  ) then
    create policy profile_question_sections_admin_update
      on public.profile_question_sections
      for update
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

create or replace function public.create_profile_question_section(
  p_name text,
  p_sort_order integer
)
returns public.profile_question_sections
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  result public.profile_question_sections;
  normalized_name text := btrim(p_name);
  next_order integer := coalesce(p_sort_order, 10);
begin
  if not public.is_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  if normalized_name = '' then
    raise exception 'Section name is required.' using errcode = '22023';
  end if;
  if exists (select 1 from public.profile_question_sections where lower(btrim(name)) = lower(normalized_name)) then
    raise exception 'A profile question section with that name already exists.' using errcode = '23505';
  end if;

  -- Always put newly-created sections after the current last section if the requested
  -- order is already occupied. This avoids conflicting sort-order values.
  if exists (select 1 from public.profile_question_sections where sort_order = next_order) then
    select coalesce(max(sort_order), 0) + 10 into next_order
    from public.profile_question_sections;
  end if;

  insert into public.profile_question_sections(name, sort_order, active)
  values (normalized_name, next_order, true)
  returning * into result;

  return result;
end;
$$;

create or replace function public.rename_profile_question_section(
  p_section_id uuid,
  p_name text
)
returns public.profile_question_sections
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  result public.profile_question_sections;
  old_name text;
  normalized_name text := btrim(p_name);
begin
  if not public.is_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  if normalized_name = '' then
    raise exception 'Section name is required.' using errcode = '22023';
  end if;

  select name into old_name
  from public.profile_question_sections
  where id = p_section_id;

  if old_name is null then
    raise exception 'Profile question section was not found.' using errcode = 'P0002';
  end if;

  if lower(old_name) <> lower(normalized_name)
     and exists (
       select 1 from public.profile_question_sections
       where lower(btrim(name)) = lower(normalized_name) and id <> p_section_id
     ) then
    raise exception 'A profile question section with that name already exists.' using errcode = '23505';
  end if;

  update public.profile_question_sections
  set name = normalized_name, updated_at = now()
  where id = p_section_id
  returning * into result;

  -- Keep all existing questions attached to the renamed section.
  update public.profile_questions
  set section = normalized_name,
      section_order = result.sort_order
  where section = old_name;

  return result;
end;
$$;

revoke all on function public.create_profile_question_section(text, integer) from public;
revoke all on function public.rename_profile_question_section(uuid, text) from public;
grant execute on function public.create_profile_question_section(text, integer) to authenticated;
grant execute on function public.rename_profile_question_section(uuid, text) to authenticated;

commit;
