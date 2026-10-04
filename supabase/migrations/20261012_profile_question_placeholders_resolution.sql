-- Novelty Library: admin-configurable profile question placeholders and image resolution.
begin;

alter table if exists public.profile_questions
  add column if not exists placeholder text;

alter table if exists public.profile_questions
  add column if not exists image_max_width integer not null default 1600;

alter table if exists public.profile_questions
  add column if not exists image_max_height integer not null default 1600;

update public.profile_questions
set image_max_width = greatest(320, least(6000, coalesce(image_max_width, 1600))),
    image_max_height = greatest(320, least(6000, coalesce(image_max_height, 1600)))
where true;

commit;
