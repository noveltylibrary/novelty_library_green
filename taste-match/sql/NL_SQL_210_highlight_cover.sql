-- NL_SQL_210: optional cover image for story highlights (picked from the 30-day archive or the gallery).
-- Additive and safe: one nullable column. The site works without it (covers fall back to the first photo).
alter table public.story_highlights add column if not exists cover_path text;
