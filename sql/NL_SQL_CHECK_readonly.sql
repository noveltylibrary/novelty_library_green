-- NL_SQL_CHECK: READ-ONLY. Changes nothing. Run in Supabase -> SQL editor, then send me the result grid.
select 'table' as kind, t as name, to_regclass('public.' || t) is not null as exists
from unnest(array['profiles','community_reviews','community_review_likes','community_review_feedback','community_review_comments',
                  'community_review_comment_likes','community_review_feedback_replies','stories','story_likes','story_reposts',
                  'notifications','user_saved_reviews','user_settings','user_login_devices','user_login_places']) t
union all
select 'column', table_name || '.' || column_name, true
from information_schema.columns
where table_schema = 'public'
  and (table_name, column_name) in (
    ('community_reviews','id'),('community_reviews','review_no'),('community_reviews','email'),('community_reviews','novelty_username'),
    ('community_reviews','is_published'),('community_reviews','deleted_at'),('community_reviews','book_title'),('community_reviews','title'),
    ('profiles','id'),('profiles','email'),('profiles','name'),('profiles','novelty_username'),('profiles','is_blacklisted'),
    ('community_review_likes','review_id'),('community_review_likes','user_id'),
    ('community_review_feedback','id'),('community_review_feedback','review_id'),('community_review_feedback','user_id'),('community_review_feedback','rating'),('community_review_feedback','review_text'),
    ('community_review_comments','id'),('community_review_comments','review_id'),('community_review_comments','parent_id'),('community_review_comments','comment_text'),
    ('community_review_comment_likes','comment_id'),
    ('community_review_feedback_replies','id'),('community_review_feedback_replies','feedback_id'),('community_review_feedback_replies','reply_text'),
    ('stories','id'),('stories','user_id'),('story_likes','story_id'),('story_reposts','story_id'),
    ('notifications','user_id'),('notifications','kind'),('notifications','title'),('notifications','body'),('notifications','read_at'),
    ('notifications','event'),('notifications','dedupe_key'))
union all
select 'notifications.kind type', data_type || coalesce(' / ' || udt_name, ''), true
from information_schema.columns where table_schema = 'public' and table_name = 'notifications' and column_name = 'kind'
union all
select 'notifications constraint', conname || ': ' || pg_get_constraintdef(oid), true
from pg_constraint where conrelid = to_regclass('public.notifications') and contype = 'c'
union all
select 'notifications trigger', tgname, true
from pg_trigger where tgrelid = to_regclass('public.notifications') and not tgisinternal
order by 1, 2;
