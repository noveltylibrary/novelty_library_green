-- Novelty Library: richer profile-question answers.
-- Adds configurable "Other" choices and image-answer settings.

begin;

alter table if exists public.profile_questions
  add column if not exists allow_other boolean not null default true;

alter table if exists public.profile_questions
  add column if not exists image_count integer not null default 1;

alter table if exists public.profile_questions
  add column if not exists image_max_mb integer not null default 5;

update public.profile_questions
set image_count = greatest(1, least(6, coalesce(image_count, 1))),
    image_max_mb = greatest(1, least(5, coalesce(image_max_mb, 5)))
where true;

-- A small dedicated public bucket for profile-question images. Uploads are
-- always placed under the authenticated user's UUID, and only the owner can
-- insert/update/delete. Public read is intentional because profile answers
-- can be shown on a public reader card when the user makes the question visible.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-question-images',
  'profile-question-images',
  true,
  5242880,
  array['image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists profile_question_images_public_read on storage.objects;
drop policy if exists profile_question_images_owner_insert on storage.objects;
drop policy if exists profile_question_images_owner_update on storage.objects;
drop policy if exists profile_question_images_owner_delete on storage.objects;

create policy profile_question_images_public_read
  on storage.objects for select to public
  using (bucket_id = 'profile-question-images');

create policy profile_question_images_owner_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-question-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and storage.extension(name) in ('jpg','jpeg','png','webp')
  );

create policy profile_question_images_owner_update
  on storage.objects for update to authenticated
  using (
    bucket_id = 'profile-question-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'profile-question-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and storage.extension(name) in ('jpg','jpeg','png','webp')
  );

create policy profile_question_images_owner_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'profile-question-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

commit;
