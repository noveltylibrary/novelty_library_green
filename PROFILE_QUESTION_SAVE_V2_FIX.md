# Profile question save fix v2

The admin profile-question editor now calls `public.admin_save_profile_question_v2(jsonb)` instead of the older `admin_upsert_profile_question(...)` RPC.

## Required Supabase step
Run:
`supabase/migrations/20261018_profile_question_admin_save_v2.sql`

The new RPC validates the current admin session and lets PostgreSQL coerce the submitted values to the actual live column types using `jsonb_populate_record`.

No existing questions are deleted by this migration.
