-- Novelty Library: make profile-question admin writes reliable by routing them through
-- SECURITY DEFINER functions. This avoids client-side RLS/policy mismatches while still
-- enforcing the existing public.is_admin() check.

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

create or replace function public.admin_upsert_profile_question(
  p_id uuid,
  p_section text,
  p_section_order integer,
  p_question text,
  p_key text,
  p_type text,
  p_options jsonb default '[]'::jsonb,
  p_placeholder text default null,
  p_allow_other boolean default true,
  p_image_count integer default 1,
  p_image_max_mb integer default 5,
  p_image_max_width integer default 1600,
  p_image_max_height integer default 1600,
  p_required boolean default false,
  p_public_default boolean default true,
  p_show_in_profile_card boolean default true,
  p_sort_order integer default 0,
  p_active boolean default true
)
returns public.profile_questions
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  result public.profile_questions;
  normalized_question text := btrim(coalesce(p_question, ''));
  normalized_section text := btrim(coalesce(p_section, ''));
  normalized_key text := btrim(coalesce(p_key, ''));
  options_udt text;
  options_type text;
  options_array text[];
  existing_id uuid;
  resolved_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;

  if normalized_question = '' then
    raise exception 'Question text is required.' using errcode = '22023';
  end if;
  if normalized_section = '' then
    raise exception 'Question section is required.' using errcode = '22023';
  end if;
  if normalized_key = '' then
    raise exception 'Question key is required.' using errcode = '22023';
  end if;

  select c.udt_name, c.data_type
    into options_udt, options_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'profile_questions'
    and c.column_name = 'options';

  if p_options is null then
    p_options := '[]'::jsonb;
  end if;

  if options_udt = '_text' then
    select coalesce(array_agg(value order by ord), '{}'::text[])
      into options_array
    from jsonb_array_elements_text(p_options) with ordinality as t(value, ord);
  end if;

  if p_id is not null then
    if not exists (select 1 from public.profile_questions where id = p_id) then
      raise exception 'Profile question was not found.' using errcode = 'P0002';
    end if;
    resolved_id := p_id;
  else
    resolved_id := gen_random_uuid();
  end if;

  -- Use dynamic SQL only for the options column because older deployments may have
  -- it as text[], while newer deployments may have it as jsonb/json.
  if p_id is not null then
    if options_udt = '_text' then
      update public.profile_questions
      set section = normalized_section,
          section_order = coalesce(p_section_order, 999),
          question = normalized_question,
          key = normalized_key,
          type = p_type,
          options = options_array,
          placeholder = p_placeholder,
          allow_other = coalesce(p_allow_other, true),
          image_count = greatest(1, least(6, coalesce(p_image_count, 1))),
          image_max_mb = greatest(1, least(25, coalesce(p_image_max_mb, 5))),
          image_max_width = greatest(320, least(6000, coalesce(p_image_max_width, 1600))),
          image_max_height = greatest(320, least(6000, coalesce(p_image_max_height, 1600))),
          required = coalesce(p_required, false),
          public_default = coalesce(p_public_default, true),
          show_in_profile_card = coalesce(p_show_in_profile_card, true),
          sort_order = coalesce(p_sort_order, 0),
          active = coalesce(p_active, true)
      where id = p_id
      returning * into result;
    elsif options_type = 'json' then
      update public.profile_questions
      set section = normalized_section,
          section_order = coalesce(p_section_order, 999),
          question = normalized_question,
          key = normalized_key,
          type = p_type,
          options = p_options::json,
          placeholder = p_placeholder,
          allow_other = coalesce(p_allow_other, true),
          image_count = greatest(1, least(6, coalesce(p_image_count, 1))),
          image_max_mb = greatest(1, least(25, coalesce(p_image_max_mb, 5))),
          image_max_width = greatest(320, least(6000, coalesce(p_image_max_width, 1600))),
          image_max_height = greatest(320, least(6000, coalesce(p_image_max_height, 1600))),
          required = coalesce(p_required, false),
          public_default = coalesce(p_public_default, true),
          show_in_profile_card = coalesce(p_show_in_profile_card, true),
          sort_order = coalesce(p_sort_order, 0),
          active = coalesce(p_active, true)
      where id = p_id
      returning * into result;
    else
      update public.profile_questions
      set section = normalized_section,
          section_order = coalesce(p_section_order, 999),
          question = normalized_question,
          key = normalized_key,
          type = p_type,
          options = p_options,
          placeholder = p_placeholder,
          allow_other = coalesce(p_allow_other, true),
          image_count = greatest(1, least(6, coalesce(p_image_count, 1))),
          image_max_mb = greatest(1, least(25, coalesce(p_image_max_mb, 5))),
          image_max_width = greatest(320, least(6000, coalesce(p_image_max_width, 1600))),
          image_max_height = greatest(320, least(6000, coalesce(p_image_max_height, 1600))),
          required = coalesce(p_required, false),
          public_default = coalesce(p_public_default, true),
          show_in_profile_card = coalesce(p_show_in_profile_card, true),
          sort_order = coalesce(p_sort_order, 0),
          active = coalesce(p_active, true)
      where id = p_id
      returning * into result;
    end if;
  else
    if options_udt = '_text' then
      insert into public.profile_questions(
        id, section, section_order, question, key, type, options, placeholder, allow_other,
        image_count, image_max_mb, image_max_width, image_max_height, required,
        public_default, show_in_profile_card, sort_order, active
      ) values (
        resolved_id, normalized_section, coalesce(p_section_order, 999), normalized_question,
        normalized_key, p_type, options_array, p_placeholder, coalesce(p_allow_other, true),
        greatest(1, least(6, coalesce(p_image_count, 1))),
        greatest(1, least(25, coalesce(p_image_max_mb, 5))),
        greatest(320, least(6000, coalesce(p_image_max_width, 1600))),
        greatest(320, least(6000, coalesce(p_image_max_height, 1600))),
        coalesce(p_required, false), coalesce(p_public_default, true),
        coalesce(p_show_in_profile_card, true), coalesce(p_sort_order, 0), coalesce(p_active, true)
      ) returning * into result;
    elsif options_type = 'json' then
      insert into public.profile_questions(
        id, section, section_order, question, key, type, options, placeholder, allow_other,
        image_count, image_max_mb, image_max_width, image_max_height, required,
        public_default, show_in_profile_card, sort_order, active
      ) values (
        resolved_id, normalized_section, coalesce(p_section_order, 999), normalized_question,
        normalized_key, p_type, p_options::json, p_placeholder, coalesce(p_allow_other, true),
        greatest(1, least(6, coalesce(p_image_count, 1))),
        greatest(1, least(25, coalesce(p_image_max_mb, 5))),
        greatest(320, least(6000, coalesce(p_image_max_width, 1600))),
        greatest(320, least(6000, coalesce(p_image_max_height, 1600))),
        coalesce(p_required, false), coalesce(p_public_default, true),
        coalesce(p_show_in_profile_card, true), coalesce(p_sort_order, 0), coalesce(p_active, true)
      ) returning * into result;
    else
      insert into public.profile_questions(
        id, section, section_order, question, key, type, options, placeholder, allow_other,
        image_count, image_max_mb, image_max_width, image_max_height, required,
        public_default, show_in_profile_card, sort_order, active
      ) values (
        resolved_id, normalized_section, coalesce(p_section_order, 999), normalized_question,
        normalized_key, p_type, p_options, p_placeholder, coalesce(p_allow_other, true),
        greatest(1, least(6, coalesce(p_image_count, 1))),
        greatest(1, least(25, coalesce(p_image_max_mb, 5))),
        greatest(320, least(6000, coalesce(p_image_max_width, 1600))),
        greatest(320, least(6000, coalesce(p_image_max_height, 1600))),
        coalesce(p_required, false), coalesce(p_public_default, true),
        coalesce(p_show_in_profile_card, true), coalesce(p_sort_order, 0), coalesce(p_active, true)
      ) returning * into result;
    end if;
  end if;

  if result.id is null then
    raise exception 'Profile question could not be saved.' using errcode = 'P0001';
  end if;

  return result;
end;
$$;

revoke all on function public.admin_upsert_profile_question(
  uuid, text, integer, text, text, text, jsonb, text, boolean, integer, integer, integer, integer,
  boolean, boolean, boolean, integer, boolean
) from public;
grant execute on function public.admin_upsert_profile_question(
  uuid, text, integer, text, text, text, jsonb, text, boolean, integer, integer, integer, integer,
  boolean, boolean, boolean, integer, boolean
) to authenticated;

commit;

-- Verification: confirms the RPC exists.
select routine_schema, routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'admin_upsert_profile_question';
