-- Novelty Library 1.89 — run once in the Supabase SQL editor.
-- 1) allows the new "marked" (Mark for Review) status on reviews
-- 2) adds public.admin_send_notification(...) used by the admin Notify Users page, the
--    Notify buttons in the Submitted / Reserved lists, and the automatic "accepted" messages.

-- ── 1. reviews.status: add 'marked' ─────────────────────────────────────────────
do $$
declare
  col_type text;
  c record;
begin
  select udt_name into col_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'reviews' and column_name = 'status';

  if exists (select 1 from pg_type t join pg_enum e on e.enumtypid = t.oid where t.typname = col_type) then
    -- status is a Postgres enum: add the value if it is missing
    if not exists (select 1 from pg_type t join pg_enum e on e.enumtypid = t.oid
                   where t.typname = col_type and e.enumlabel = 'marked') then
      execute format('alter type public.%I add value %L', col_type, 'marked');
    end if;
  else
    -- status is text with (maybe) a CHECK constraint: replace it
    for c in
      select conname from pg_constraint
      where conrelid = 'public.reviews'::regclass and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%status%'
        and pg_get_constraintdef(oid) ilike '%pending%'
    loop
      execute format('alter table public.reviews drop constraint %I', c.conname);
    end loop;
    alter table public.reviews
      add constraint reviews_status_check check (status in ('pending','approved','declined','marked'));
  end if;
end $$;

-- ── 2. admin → user notifications ──────────────────────────────────────────────
-- p_user_id = null  → every registered user (broadcast).
-- p_dedupe = true   → skip a user who already got the same kind/title/body in the last 10 minutes
--                     (stops doubles if a database trigger already sends the same message).
create or replace function public.admin_send_notification(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_kind text default 'system',
  p_dedupe boolean default false
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text := case when p_kind in ('system','reservation_accepted','reservation_rejected','review_published') then p_kind else 'system' end;
  v_title text := left(btrim(coalesce(p_title, '')), 120);
  v_body text := left(btrim(coalesce(p_body, '')), 1000);
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'Only admins can send notifications' using errcode = '42501';
  end if;
  if v_title = '' or v_body = '' then
    raise exception 'Title and message are required';
  end if;

  insert into public.notifications (user_id, kind, title, body)
  select u.id, v_kind, v_title, v_body
  from (
    select p_user_id as id where p_user_id is not null
    union all
    select pr.id from public.profiles pr where p_user_id is null
  ) u
  where not (
    p_dedupe and exists (
      select 1 from public.notifications n
      where n.user_id = u.id and n.kind = v_kind and n.title = v_title and n.body = v_body
        and n.created_at > now() - interval '10 minutes'
    )
  );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.admin_send_notification(uuid, text, text, text, boolean) from public, anon;
grant execute on function public.admin_send_notification(uuid, text, text, text, boolean) to authenticated;
