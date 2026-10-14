-- Novelty Library v1.114: persist the admin-selected Blogger post URL.
-- Safe and idempotent: adds one nullable text column, without altering existing data or policies.
ALTER TABLE public.community_reviews
  ADD COLUMN IF NOT EXISTS blog_url text;

COMMENT ON COLUMN public.community_reviews.blog_url IS
  'Canonical Blogger post URL, manually editable from the Novelty Library Publishing Queue';

NOTIFY pgrst, 'reload schema';
