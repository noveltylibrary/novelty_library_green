# Profile Question Admin Save Fix

This update makes the Profile Questions editor robust when the latest question configuration columns or admin write policies were missing from the live Supabase schema.

Run `supabase/migrations/20261014_profile_questions_admin_save_fix.sql` once.

The UI now preserves the current scroll position when Edit is clicked, focuses the question field without jumping the document, reports the actual Supabase error when save fails, and disables the save button while saving.
