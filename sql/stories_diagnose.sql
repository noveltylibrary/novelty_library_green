-- Run in Supabase SQL editor; returns ONE result set (export as CSV and send back).
select 'constraint' as kind, conname::text as name, pg_get_constraintdef(oid) as detail
  from pg_constraint
 where conrelid = 'public.stories'::regclass and contype in ('u','x','p')
union all
select 'unique_index', indexname::text, indexdef
  from pg_indexes
 where schemaname='public' and tablename='stories' and indexdef ilike '%unique%'
union all
select 'trigger', t.tgname::text, pg_get_triggerdef(t.oid)
  from pg_trigger t
 where t.tgrelid = 'public.stories'::regclass and not t.tgisinternal
union all
select 'trigger_function_source', p.proname::text, p.prosrc
  from pg_trigger t join pg_proc p on p.oid = t.tgfoid
 where t.tgrelid = 'public.stories'::regclass and not t.tgisinternal
union all
select 'column', column_name::text, data_type || coalesce(' default ' || column_default, '')
  from information_schema.columns
 where table_schema='public' and table_name='stories';
