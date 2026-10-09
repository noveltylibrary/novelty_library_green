-- Reviewer verdict: optional, nullable, no default. Idempotent; safe to re-run.
-- Already present on the live project; this file documents it / fixes other environments.
-- Allowed values: perfection | go_for_it | timepass (NULL for legacy rows and sheet imports).

ALTER TABLE public.reviews           ADD COLUMN IF NOT EXISTS verdict text DEFAULT NULL;
ALTER TABLE public.master_list       ADD COLUMN IF NOT EXISTS verdict text DEFAULT NULL;
ALTER TABLE public.community_reviews ADD COLUMN IF NOT EXISTS verdict text DEFAULT NULL;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['reviews','master_list','community_reviews'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = t || '_verdict_chk' AND conrelid = ('public.' || t)::regclass) THEN
      -- NOT VALID: enforced for new/updated rows, never scans or rejects existing rows.
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (verdict IS NULL OR verdict = ANY (ARRAY[''perfection'',''go_for_it'',''timepass''])) NOT VALID', t, t || '_verdict_chk');
    END IF;
  END LOOP;
END $$;
