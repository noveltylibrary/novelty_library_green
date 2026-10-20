-- Fix #5: only signed-in users can insert reviews (anon blocked). Fix #3: owners can read back their own rows.
-- Safe for v1.116 and 2.12 (additive owner SELECT; public approved SELECT stays untouched).
begin;
drop policy if exists reviews_public_insert on public.reviews;
create policy reviews_authenticated_insert on public.reviews for insert to authenticated
  with check (status='pending' and coalesce(is_published,false)=false and published_on is null
              and deleted_at is null and admin_notes is null and user_id = auth.uid());
drop policy if exists reviews_owner_select on public.reviews;
create policy reviews_owner_select on public.reviews for select to authenticated using (auth.uid() = user_id);
commit;
