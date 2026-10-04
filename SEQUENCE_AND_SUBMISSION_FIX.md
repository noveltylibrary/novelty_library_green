# Novelty Library — Submission / Google Sheet sequence fix

1. Run `supabase/migrations/20261006_fix_reviews_moderation_and_master_sequence.sql` in Supabase SQL Editor.
2. Deploy the project, including the updated `sheet-proxy` Edge Function.
3. Existing Google Sheet entries remain in the master list. Google Sheets is NOT removed.
4. Website acceptance uses the next master-list number. A new Sheet row is identified by its Sheet row index and receives the next available master-list number, even if the Sheet itself says a conflicting number.

Example:
- Sheet currently has 1..237.
- Website review accepted -> #238.
- Sheet adds a row labelled 238 -> imported as #239.
- Next website review -> #240.

The SQL also replaces the unsafe moderation trigger that caused PostgreSQL 42703 (`NEW.approved` on a table without an `approved` column).
