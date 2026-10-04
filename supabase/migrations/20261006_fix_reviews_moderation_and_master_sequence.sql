-- Novelty Library — review submission + shared Review No. sequence fix
-- Run this whole file once in Supabase SQL Editor.
--
-- This migration DOES NOT remove Google Sheets fetching/sync.
-- Google Sheets remains an import source. The website and Sheet share one
-- Review No. sequence through the master_list table.

begin;

-- ---------------------------------------------------------------------------
-- 1. Fix the 42703 "record NEW has no field approved" submission error.
-- ---------------------------------------------------------------------------
-- Some live deployments still have an older moderation trigger/function that
-- references NEW.approved directly even though the current reviews table has
-- status instead. The replacement below only touches fields that actually
-- exist on the row, using jsonb so it is safe on either schema.

create or replace function public.enforce_review_moderation_state()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if not public.is_admin() then
    if tg_op = 'INSERT' then
      if to_jsonb(new) ? 'user_id' then
        new := jsonb_populate_record(new, jsonb_build_object('user_id', auth.uid()));
      end if;
      if to_jsonb(new) ? 'status' then
        new := jsonb_populate_record(new, jsonb_build_object('status', 'pending'));
      end if;
      if to_jsonb(new) ? 'approved' then
        new := jsonb_populate_record(new, jsonb_build_object('approved', false));
      end if;
    elsif tg_op = 'UPDATE' then
      if to_jsonb(old) ? 'status' then
        new := jsonb_populate_record(new, jsonb_build_object('status', to_jsonb(old)->'status'));
      end if;
      if to_jsonb(old) ? 'approved' then
        new := jsonb_populate_record(new, jsonb_build_object('approved', to_jsonb(old)->'approved'));
      end if;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_review_moderation_state() from public;

do $$
begin
  if to_regclass('public.reviews') is not null then
    drop trigger if exists trg_reviews_enforce_moderation_state on public.reviews;
    create trigger trg_reviews_enforce_moderation_state
      before insert or update on public.reviews
      for each row execute function public.enforce_review_moderation_state();
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Make the master-list Review No. column safe for the shared sequence.
-- ---------------------------------------------------------------------------
-- Do not delete or renumber existing rows here. In particular, if the current
-- Google Sheet has 237 imported entries, they stay 1..237. A website review
-- accepted next gets 238. If the Sheet later contains a new row labelled 238,
-- the updated sheet-proxy code assigns that new row 239 instead of colliding.
--
-- sheet_row_index is the stable identity of a Google Sheet row. Website-created
-- rows have NULL sheet_row_index.

alter table public.master_list
  add column if not exists sheet_row_index integer;

create index if not exists master_list_sheet_row_index_idx
  on public.master_list(sheet_row_index)
  where sheet_row_index is not null;

-- If the existing 237 Sheet rows were imported by the current importer but the
-- sheet_row_index values were lost/never added, this conservative backfill
-- restores their row identity from the known 1..237 sequence. It does NOT touch
-- rows above 237 (including a website-created #238).
update public.master_list
set sheet_row_index = cast(review_no as integer)
where sheet_row_index is null
  and review_no ~ '^[0-9]+$'
  and cast(review_no as integer) between 1 and 237;

commit;
