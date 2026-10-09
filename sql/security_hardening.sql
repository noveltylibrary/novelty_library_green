-- Security hardening for community interactions. Run in the Supabase SQL editor (safe to re-run).
-- 1) The database, not the browser, decides WHO posted a comment / reply / reader review and under WHAT name,
--    so nobody can post as another reader or invent a display name.
-- 2) Block edits that move a row to another reader.
-- Tables/columns used (taken from the app code): user_id, user_name.

create or replace function public.nl_stamp_author()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid  uuid := auth.uid();
  v_name text;
begin
  -- Service-role / dashboard writes (no signed-in user) are left untouched.
  if v_uid is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
    raise exception 'user_id cannot be changed';
  end if;

  new.user_id := v_uid;

  select left(coalesce(nullif(btrim(p.name), ''), nullif(btrim(p.novelty_username), ''), split_part(u.email, '@', 1), 'Reader'), 60)
    into v_name
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = v_uid;

  new.user_name := coalesce(v_name, 'Reader');
  return new;
end;
$$;

revoke all on function public.nl_stamp_author() from public;

do $$
declare t text;
begin
  foreach t in array array['community_review_comments', 'community_review_feedback', 'community_review_feedback_replies']
  loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists nl_stamp_author on public.%I', t);
      execute format('create trigger nl_stamp_author before insert or update on public.%I for each row execute function public.nl_stamp_author()', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- AUDIT (read-only): run these and review the results.
-- ---------------------------------------------------------------------------
-- A) Public tables WITHOUT row level security  (every row should be 'true' for rls_enabled):
--    select c.relname as table_name, c.relrowsecurity as rls_enabled
--    from pg_class c join pg_namespace n on n.oid = c.relnamespace
--    where n.nspname = 'public' and c.relkind = 'r' order by c.relrowsecurity, c.relname;
--
-- B) Policies that let anyone write ('true' checks are red flags):
--    select tablename, policyname, cmd, roles, qual, with_check from pg_policies
--    where schemaname = 'public' and (coalesce(qual,'') in ('true','(true)') or coalesce(with_check,'') in ('true','(true)'))
--    order by tablename;
--
-- C) SECURITY DEFINER functions callable by anon (review each one):
--    select p.proname, pg_get_function_arguments(p.oid) as args
--    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.prosecdef
--      and has_function_privilege('anon', p.oid, 'execute');
