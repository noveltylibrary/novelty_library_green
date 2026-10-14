-- Historical Novelty Library 1.93 migration.
-- For current deployments use blog_url_1_102.sql, which adds blog_url to both
-- community_reviews and master_list. This file is retained for compatibility.

alter table public.community_reviews add column if not exists blog_url text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'community_reviews_blog_url_http'
      and conrelid = 'public.community_reviews'::regclass
  ) then
    alter table public.community_reviews
      add constraint community_reviews_blog_url_http
      check (blog_url is null or blog_url ~* '^https?://') not valid;
  end if;
end $$;
