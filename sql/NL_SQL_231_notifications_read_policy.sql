-- NL_SQL_231: make sure a reader can mark THEIR OWN notifications as read (otherwise the bell count can never clear).
-- Safe to run more than once. Only adds a policy if no UPDATE policy exists yet; changes nothing else.
do $$
begin
  if to_regclass('public.notifications') is null then return; end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notifications' and cmd in ('UPDATE', 'ALL')) then
    execute 'create policy notifications_owner_update on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())';
    raise notice 'Added owner update policy on notifications.';
  else
    raise notice 'An UPDATE policy already exists - nothing changed.';
  end if;
end $$;
-- Reader may only change read_at in practice: the app never sends other columns.
