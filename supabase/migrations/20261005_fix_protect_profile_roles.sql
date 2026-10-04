-- v1.7: protect_profile_roles() referenced NEW.role / NEW.is_admin directly, but
-- public.profiles has no such columns, so every UPDATE on profiles failed with
-- 'record "new" has no field "role"'. That also broke "Sync Now" (the master_list
-- trigger updates profiles.total_books_read). Read the fields through jsonb so the
-- trigger works whether or not those columns exist. Already applied to the live
-- project; safe to re-run.
CREATE OR REPLACE FUNCTION public.protect_profile_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_email TEXT;
BEGIN
  current_email := auth.jwt() ->> 'email';

  IF ((to_jsonb(NEW) -> 'role') IS DISTINCT FROM (to_jsonb(OLD) -> 'role'))
     OR ((to_jsonb(NEW) -> 'is_admin') IS DISTINCT FROM (to_jsonb(OLD) -> 'is_admin')) THEN
    IF current_email IS NULL OR current_email NOT IN ('noveltylibrary@gmail.com') THEN
      RAISE EXCEPTION 'Unauthorized: Users cannot modify their own privileges or role.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
