-- Robust admin save for profile_questions.
-- Uses jsonb_populate_record so PostgreSQL converts values to the live column types
-- (including text[], json/jsonb and enum types) instead of relying on fragile casts.
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

alter table if exists public.profile_questions
  add column if not exists section_order integer not null default 999;

create or replace function public.admin_save_profile_question_v2(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  incoming public.profile_questions;
  saved public.profile_questions;
  target_id uuid;
  has_id boolean;
begin
  if not public.is_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;

  if p_payload is null then
    raise exception 'Question payload is required.' using errcode = '22023';
  end if;

  if btrim(coalesce(p_payload->>'question','')) = '' then
    raise exception 'Question text is required.' using errcode = '22023';
  end if;

  if btrim(coalesce(p_payload->>'section','')) = '' then
    raise exception 'Question section is required.' using errcode = '22023';
  end if;

  if btrim(coalesce(p_payload->>'key','')) = '' then
    raise exception 'Question key is required.' using errcode = '22023';
  end if;

  has_id := nullif(btrim(coalesce(p_payload->>'id','')), '') is not null;

  -- Populate a composite row so PostgreSQL handles the actual live column types.
  incoming := jsonb_populate_record(null::public.profile_questions, p_payload);

  incoming.question := btrim(incoming.question);
  incoming.section := btrim(incoming.section);
  incoming.key := btrim(incoming.key);
  incoming.section_order := greatest(0, coalesce(incoming.section_order, 999));
  incoming.placeholder := nullif(btrim(coalesce(incoming.placeholder, '')), '');
  incoming.allow_other := coalesce(incoming.allow_other, true);
  incoming.image_count := greatest(1, least(6, coalesce(incoming.image_count, 1)));
  incoming.image_max_mb := greatest(1, least(25, coalesce(incoming.image_max_mb, 5)));
  incoming.image_max_width := greatest(320, least(6000, coalesce(incoming.image_max_width, 1600)));
  incoming.image_max_height := greatest(320, least(6000, coalesce(incoming.image_max_height, 1600)));
  incoming.required := coalesce(incoming.required, false);
  incoming.public_default := coalesce(incoming.public_default, true);
  incoming.show_in_profile_card := coalesce(incoming.show_in_profile_card, true);
  incoming.sort_order := coalesce(incoming.sort_order, 0);
  incoming.active := coalesce(incoming.active, true);

  if has_id then
    target_id := (p_payload->>'id')::uuid;

    update public.profile_questions
       set section = incoming.section,
           section_order = incoming.section_order,
           question = incoming.question,
           key = incoming.key,
           type = incoming.type,
           options = incoming.options,
           placeholder = incoming.placeholder,
           allow_other = incoming.allow_other,
           image_count = incoming.image_count,
           image_max_mb = incoming.image_max_mb,
           image_max_width = incoming.image_max_width,
           image_max_height = incoming.image_max_height,
           required = incoming.required,
           public_default = incoming.public_default,
           show_in_profile_card = incoming.show_in_profile_card,
           sort_order = incoming.sort_order,
           active = incoming.active
     where id = target_id
     returning * into saved;

    if saved.id is null then
      raise exception 'Profile question was not found.' using errcode = 'P0002';
    end if;
  else
    insert into public.profile_questions(
      section, section_order, question, key, type, options, placeholder,
      allow_other, image_count, image_max_mb, image_max_width, image_max_height,
      required, public_default, show_in_profile_card, sort_order, active
    ) values (
      incoming.section, incoming.section_order, incoming.question, incoming.key, incoming.type,
      incoming.options, incoming.placeholder, incoming.allow_other, incoming.image_count,
      incoming.image_max_mb, incoming.image_max_width, incoming.image_max_height,
      incoming.required, incoming.public_default, incoming.show_in_profile_card,
      incoming.sort_order, incoming.active
    )
    returning * into saved;
  end if;

  return to_jsonb(saved);
exception
  when others then
    raise exception '%', sqlerrm using errcode = sqlstate;
end;
$$;

revoke all on function public.admin_save_profile_question_v2(jsonb) from public;
grant execute on function public.admin_save_profile_question_v2(jsonb) to authenticated;

commit;

select routine_schema, routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'admin_save_profile_question_v2';
