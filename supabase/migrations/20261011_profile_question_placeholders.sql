-- Novelty Library: admin-configurable placeholders for text-style profile questions.
begin;

alter table if exists public.profile_questions
  add column if not exists placeholder text not null default '';

commit;
