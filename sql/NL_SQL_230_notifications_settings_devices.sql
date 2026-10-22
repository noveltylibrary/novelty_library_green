-- NL_SQL_230: Notifications for interactions, server-side notification settings, content preferences, new-device sign-in alerts.
-- Run once in Supabase -> SQL editor, AFTER NL_SQL_220.
--
-- ADDITIVE + DEFENSIVE:
--  * New tables: user_settings, user_login_devices, user_login_places, nl_notification_switches.
--  * Existing table `notifications` only gets 5 NULLABLE columns (event, actor_id, link, meta, dedupe_key), one partial unique index
--    and one BEFORE INSERT trigger that honours the reader's notification settings. No existing column/constraint/policy is changed.
--  * New events are stored as kind = 'system' (always valid), with the specific type in `event`, so no CHECK constraint is touched.
--  * Every trigger swallows its own errors: a like, comment, rating or story can NEVER fail because a notification could not be made.
--  * Old versions (1.116 / AdSense crawl) never read the new columns/tables, so nothing changes for them.
-- Rollback block at the bottom.

-- 0) Switches ----------------------------------------------------------------------------------------------------
create table if not exists public.nl_notification_switches (key text primary key, enabled boolean not null default false);
alter table public.nl_notification_switches enable row level security;   -- no policies: not readable through the API
insert into public.nl_notification_switches(key, enabled) values ('broadcast_new_reviews', false) on conflict do nothing;
-- To notify every reader about each newly published review:  update public.nl_notification_switches set enabled = true where key = 'broadcast_new_reviews';

-- 1) Reader settings (notification categories + content preferences) ---------------------------------------------
create table if not exists public.user_settings (
  user_id        uuid        primary key references auth.users(id) on delete cascade,
  notif          jsonb       not null default '{}'::jsonb,   -- { stories, new_reviews, review_interactions, announcements : boolean }  (missing = on)
  content_traits text[]      not null default '{}',          -- ids picked in Content preferences
  updated_at     timestamptz not null default now()
);
alter table public.user_settings enable row level security;
drop policy if exists user_settings_owner_select on public.user_settings;
create policy user_settings_owner_select on public.user_settings for select to authenticated using (user_id = auth.uid());
revoke all on public.user_settings from anon;
grant select on public.user_settings to authenticated;     -- writes only through save_my_settings()

-- Reads the reader's settings. Readers who saved settings with the older version (kept in their sign-in record) are carried over.
create or replace function public.get_my_settings() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r public.user_settings; m jsonb;
begin
  if auth.uid() is null then return null; end if;
  select * into r from public.user_settings where user_id = auth.uid();
  if found then return jsonb_build_object('notif', r.notif, 'content', to_jsonb(r.content_traits), 'source', 'db'); end if;
  select raw_user_meta_data->'nl_prefs' into m from auth.users where id = auth.uid();
  return jsonb_build_object(
    'notif',   case when jsonb_typeof(m->'notif') = 'object' then m->'notif' else '{}'::jsonb end,
    'content', case when jsonb_typeof(m->'content') = 'array' then m->'content' else '[]'::jsonb end,
    'source',  'legacy');
end $$;

create or replace function public.save_my_settings(p_notif jsonb, p_content text[]) returns void
language plpgsql security definer set search_path = public as $$
declare k text; clean jsonb := '{}'::jsonb; items text[];
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if jsonb_typeof(coalesce(p_notif, '{}'::jsonb)) <> 'object' then raise exception 'Invalid notification settings.'; end if;
  for k in select jsonb_object_keys(coalesce(p_notif, '{}'::jsonb)) loop
    if k in ('stories','new_reviews','review_interactions','announcements') and jsonb_typeof(p_notif->k) = 'boolean' then
      clean := clean || jsonb_build_object(k, p_notif->k);
    end if;
  end loop;
  select coalesce(array_agg(distinct left(btrim(x), 60)) filter (where btrim(x) <> ''), '{}') into items from unnest(coalesce(p_content, '{}')) as x;
  if coalesce(array_length(items, 1), 0) > 100 then raise exception 'Too many content preferences.'; end if;
  insert into public.user_settings(user_id, notif, content_traits, updated_at) values (auth.uid(), clean, items, now())
  on conflict (user_id) do update set notif = excluded.notif, content_traits = excluded.content_traits, updated_at = now();
end $$;
grant execute on function public.get_my_settings() to authenticated;
grant execute on function public.save_my_settings(jsonb, text[]) to authenticated;

-- 2) Notifications: extra nullable columns + server-side settings gate -------------------------------------------
do $$
begin
  if to_regclass('public.notifications') is null then
    -- The bell needs this table. It does not exist here, so create the same shape the app already expects.
    execute 'create table public.notifications (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references auth.users(id) on delete cascade,
      kind text not null default ''system'',
      title text not null,
      body text not null default '''',
      review_id text,
      review_number text,
      read_at timestamptz,
      created_at timestamptz not null default now())';
    execute 'create index notifications_user_idx on public.notifications (user_id, created_at desc)';
    execute 'alter table public.notifications enable row level security';
    execute 'create policy notifications_owner_select on public.notifications for select to authenticated using (user_id = auth.uid())';
    execute 'create policy notifications_owner_update on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())';
    begin execute 'alter publication supabase_realtime add table public.notifications'; exception when others then null; end;
    raise notice 'public.notifications did not exist - created it.';
  end if;
  execute 'alter table public.notifications add column if not exists event text';
  execute 'alter table public.notifications add column if not exists actor_id uuid';
  execute 'alter table public.notifications add column if not exists link text';
  execute 'alter table public.notifications add column if not exists meta jsonb';
  execute 'alter table public.notifications add column if not exists dedupe_key text';
  execute 'create unique index if not exists notifications_dedupe_idx on public.notifications (user_id, dedupe_key) where dedupe_key is not null';
end $$;

-- Which settings switch governs a notification. NULL = always delivered (account, security, moderation).
create or replace function public.nl_notif_category(p_kind text, p_event text) returns text language sql immutable as $$
  select case
    when p_event in ('new_device_login','new_location_login') then null
    when p_event in ('review_like','review_rating','review_comment','comment_reply','comment_like','feedback_reply') then 'review_interactions'
    when p_event in ('story_like','story_share','new_story') then 'stories'
    when p_event = 'new_review' then 'new_reviews'
    when p_event = 'announcement' then 'announcements'
    when p_kind in ('review_submitted','review_published','reservation_requested','reservation_accepted','reservation_rejected') then 'review_interactions'
    when p_kind = 'system' then 'announcements'
    else null end
$$;

create or replace function public.nl_notif_allowed(p_user uuid, p_cat text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v jsonb; found_row boolean;
begin
  if p_cat is null or p_user is null then return true; end if;
  select notif, true into v, found_row from public.user_settings where user_id = p_user;
  if not coalesce(found_row, false) then
    select raw_user_meta_data->'nl_prefs'->'notif' into v from auth.users where id = p_user;   -- readers who never used the new settings
  end if;
  if jsonb_typeof(v) <> 'object' then return true; end if;
  return coalesce((v->>p_cat)::boolean, true);
exception when others then return true;
end $$;

-- The gate: a notification the reader switched off is simply never created (covers old and new notification sources).
create or replace function public.trg_notifications_respect_settings() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    if not public.nl_notif_allowed(new.user_id, public.nl_notif_category(new.kind::text, new.event)) then return null; end if;
  exception when others then return new;
  end;
  return new;
end $$;
do $$
begin
  if to_regclass('public.notifications') is not null then
    begin
      execute 'drop trigger if exists trg_notifications_respect_settings on public.notifications';
      execute 'create trigger trg_notifications_respect_settings before insert on public.notifications for each row execute function public.trg_notifications_respect_settings()';
    exception when others then raise notice 'Settings gate skipped (%).', sqlerrm;
    end;
  end if;
end $$;

-- 3) Helpers ------------------------------------------------------------------------------------------------------
create or replace function public.nl_name(p_user uuid) returns text language plpgsql stable security definer set search_path = public as $$
declare n text;
begin
  select coalesce(nullif(btrim(p.name), ''), nullif(btrim(p.novelty_username), '')) into n from public.profiles p where p.id = p_user;
  return coalesce(n, 'A reader');
exception when others then return 'A reader';   -- profiles table/columns missing: still works
end $$;

-- One notification. Skips self-actions, skips duplicates (same dedupe key), never raises.
create or replace function public.nl_notify(p_user uuid, p_actor uuid, p_event text, p_title text, p_body text, p_meta jsonb, p_key text, p_link text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user is null or p_user is not distinct from p_actor then return; end if;
  begin
    insert into public.notifications(user_id, kind, title, body, event, actor_id, link, meta, dedupe_key)
    values (p_user, 'system', left(p_title, 140), left(coalesce(p_body, ''), 400), p_event, p_actor, p_link, p_meta, p_key)
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
  exception when others then null;
  end;
end $$;

-- Review post -> its reviewer's account + title (matched the same way public_reviewer_index() does).
create or replace function public.nl_review_ctx(p_review text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare j jsonb; em text; un text; owner uuid;
begin
  select to_jsonb(c) into j from public.community_reviews c where c.id::text = p_review or c.review_no::text = p_review limit 1;
  if j is null then return null; end if;
  em := lower(btrim(coalesce(j->>'email', '')));
  un := lower(btrim(coalesce(j->>'novelty_username', '')));
  select p.id into owner from public.profiles p
   where (un <> '' and lower(p.novelty_username) = un) or (em <> '' and lower(btrim(p.email)) = em)
   order by (lower(coalesce(p.novelty_username, '')) = un) desc limit 1;
  return jsonb_build_object('owner', owner, 'review_id', j->>'id', 'review_no', j->>'review_no',
                            'title', coalesce(nullif(j->>'book_title', ''), nullif(j->>'title', ''), 'your review'));
exception when others then return null;
end $$;

-- 4) Interaction triggers (all AFTER INSERT, all error-proof) ----------------------------------------------------
-- 4a) Like on a review post -> the reviewer
create or replace function public.trg_nl_review_like() returns trigger language plpgsql security definer set search_path = public as $$
declare c jsonb;
begin
  begin
    c := public.nl_review_ctx(new.review_id::text);
    if c is not null then
      perform public.nl_notify((c->>'owner')::uuid, new.user_id, 'review_like', public.nl_name(new.user_id) || ' liked your review',
        'Your review of "' || (c->>'title') || '" got a new like.', jsonb_build_object('review_id', c->>'review_id', 'review_no', c->>'review_no'),
        'like:' || new.review_id::text || ':' || new.user_id::text);
    end if;
  exception when others then null; end;
  return new;
end $$;

-- 4b) Reader rating / review on a post -> the reviewer
create or replace function public.trg_nl_review_feedback() returns trigger language plpgsql security definer set search_path = public as $$
declare c jsonb; j jsonb := to_jsonb(new); rating text := nullif(j->>'rating', ''); txt text := btrim(coalesce(j->>'review_text', ''));
begin
  begin
    c := public.nl_review_ctx(new.review_id::text);
    if c is not null then
      perform public.nl_notify((c->>'owner')::uuid, new.user_id,
        case when txt <> '' then 'review_comment' else 'review_rating' end,
        public.nl_name(new.user_id) || case when rating is not null and txt <> '' then ' rated and reviewed your review' when rating is not null then ' rated your review' else ' reviewed your review' end,
        '"' || (c->>'title') || '"' || case when rating is not null then ' · ' || rating else '' end || case when txt <> '' then ' · ' || left(txt, 120) else '' end,
        jsonb_build_object('review_id', c->>'review_id', 'review_no', c->>'review_no', 'rating', rating),
        'fb:' || new.review_id::text || ':' || new.user_id::text);
    end if;
  exception when others then null; end;
  return new;
end $$;

-- 4c) Comment on a post -> the reviewer; reply to a comment -> the comment's author
create or replace function public.trg_nl_review_comment() returns trigger language plpgsql security definer set search_path = public as $$
declare c jsonb; j jsonb := to_jsonb(new); parent_author uuid; meta jsonb; snip text := left(btrim(coalesce(j->>'comment_text', '')), 120);
begin
  begin
    c := public.nl_review_ctx(new.review_id::text);
    meta := jsonb_build_object('review_id', coalesce(c->>'review_id', new.review_id::text), 'review_no', c->>'review_no', 'comment_id', j->>'id');
    if nullif(j->>'parent_id', '') is not null then
      select user_id into parent_author from public.community_review_comments where id::text = j->>'parent_id';
      perform public.nl_notify(parent_author, new.user_id, 'comment_reply', public.nl_name(new.user_id) || ' replied to your comment', snip, meta, 'reply:' || (j->>'id'));
    end if;
    if c is not null and (c->>'owner')::uuid is distinct from parent_author then
      perform public.nl_notify((c->>'owner')::uuid, new.user_id, 'review_comment', public.nl_name(new.user_id) || ' commented on your review',
        '"' || (c->>'title') || '" · ' || snip, meta, 'cmt:' || (j->>'id'));
    end if;
  exception when others then null; end;
  return new;
end $$;

-- 4d) Like on a comment -> the comment's author
create or replace function public.trg_nl_comment_like() returns trigger language plpgsql security definer set search_path = public as $$
declare author uuid; rid text;
begin
  begin
    select user_id, review_id::text into author, rid from public.community_review_comments where id = new.comment_id;
    perform public.nl_notify(author, new.user_id, 'comment_like', public.nl_name(new.user_id) || ' liked your comment', 'Someone liked a comment you wrote on a review.',
      jsonb_build_object('review_id', rid, 'comment_id', new.comment_id::text), 'clike:' || new.comment_id::text || ':' || new.user_id::text);
  exception when others then null; end;
  return new;
end $$;

-- 4e) Reply to a reader review -> that reader (and the reviewer of the post)
create or replace function public.trg_nl_feedback_reply() returns trigger language plpgsql security definer set search_path = public as $$
declare fb_author uuid; rid text; c jsonb; j jsonb := to_jsonb(new); snip text := left(btrim(coalesce(j->>'reply_text', '')), 120);
begin
  begin
    select user_id, review_id::text into fb_author, rid from public.community_review_feedback where id = new.feedback_id;
    c := public.nl_review_ctx(rid);
    perform public.nl_notify(fb_author, new.user_id, 'feedback_reply', public.nl_name(new.user_id) || ' replied to your review', snip,
      jsonb_build_object('review_id', rid, 'review_no', c->>'review_no'), 'freply:' || (j->>'id'));
    if c is not null and (c->>'owner')::uuid is distinct from fb_author then
      perform public.nl_notify((c->>'owner')::uuid, new.user_id, 'feedback_reply', public.nl_name(new.user_id) || ' replied on your review post', snip,
        jsonb_build_object('review_id', rid, 'review_no', c->>'review_no'), 'freply-o:' || (j->>'id'));
    end if;
  exception when others then null; end;
  return new;
end $$;

-- 4f) Story like / share -> the story's owner
create or replace function public.trg_nl_story_like() returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  begin
    select user_id into owner from public.stories where id = new.story_id;
    perform public.nl_notify(owner, new.user_id, 'story_like', public.nl_name(new.user_id) || ' liked your story', 'Open your profile to see your story.',
      jsonb_build_object('story_id', new.story_id::text), 'slike:' || new.story_id::text || ':' || new.user_id::text, '/profile');
  exception when others then null; end;
  return new;
end $$;
create or replace function public.trg_nl_story_share() returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  begin
    select user_id into owner from public.stories where id = new.story_id;
    perform public.nl_notify(owner, new.user_id, 'story_share', public.nl_name(new.user_id) || ' shared your story', 'Your story was re-shared to their profile.',
      jsonb_build_object('story_id', new.story_id::text), 'sshare:' || new.story_id::text || ':' || new.user_id::text, '/profile');
  exception when others then null; end;
  return new;
end $$;

-- 4g) Optional: new published review -> readers (OFF until the switch above is turned on)
create or replace function public.trg_nl_new_review() returns trigger language plpgsql security definer set search_path = public as $$
declare j jsonb := to_jsonb(new); o jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
begin
  begin
    if coalesce((select enabled from public.nl_notification_switches where key = 'broadcast_new_reviews'), false)
       and coalesce((j->>'is_published')::boolean, false) and not coalesce((o->>'is_published')::boolean, false) and j->>'deleted_at' is null then
      insert into public.notifications(user_id, kind, title, body, event, meta, dedupe_key)
      select p.id, 'system', left('New review: ' || coalesce(nullif(j->>'book_title', ''), nullif(j->>'title', ''), 'a new book'), 140),
             'A new review was just published on Novelty Library.', 'new_review',
             jsonb_build_object('review_id', j->>'id', 'review_no', j->>'review_no'), 'newrev:' || coalesce(j->>'review_no', j->>'id')
      from public.profiles p
      where coalesce(p.is_blacklisted, false) = false
      limit 20000
      on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
    end if;
  exception when others then null; end;
  return new;
end $$;

do $$
declare t record;
begin
  for t in select * from (values
    ('community_review_likes',            'trg_nl_review_like',     'trg_nl_review_like',     'insert'),
    ('community_review_feedback',         'trg_nl_review_feedback', 'trg_nl_review_feedback', 'insert'),
    ('community_review_comments',         'trg_nl_review_comment',  'trg_nl_review_comment',  'insert'),
    ('community_review_comment_likes',    'trg_nl_comment_like',    'trg_nl_comment_like',    'insert'),
    ('community_review_feedback_replies', 'trg_nl_feedback_reply',  'trg_nl_feedback_reply',  'insert'),
    ('story_likes',                       'trg_nl_story_like',      'trg_nl_story_like',      'insert'),
    ('story_reposts',                     'trg_nl_story_share',     'trg_nl_story_share',     'insert'),
    ('community_reviews',                 'trg_nl_new_review',      'trg_nl_new_review',      'insert or update of is_published')
  ) as v(tbl, trg, fn, ev)
  loop
    if to_regclass('public.' || t.tbl) is null then
      raise notice 'Table % not found - trigger % skipped.', t.tbl, t.trg;
    else
      begin
        execute format('drop trigger if exists %I on public.%I', t.trg, t.tbl);
        execute format('create trigger %I after %s on public.%I for each row execute function public.%I()', t.trg, t.ev, t.tbl, t.fn);
      exception when others then
        raise notice 'Trigger % skipped on % (%).', t.trg, t.tbl, sqlerrm;   -- e.g. a column is named differently: skip, never abort
      end;
    end if;
  end loop;
end $$;

-- 5) Sign-in devices: alert once for a NEW device, once for a NEW location/country (VPN or travel) --------------------
create table if not exists public.user_login_devices (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  device_hash text        not null check (char_length(device_hash) between 8 and 128),   -- hash of a random id kept in the browser
  ua_key      text,                                                                       -- hash of browser + OS + device type
  label       text, browser text, os text, device_type text, language text, timezone text, screen text,
  country     text,                                                                       -- 2-letter code from the network edge, when available
  ip_hash     text,                                                                       -- salted hash: the raw IP address is never stored
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  seen_count  integer     not null default 1,
  unique (user_id, device_hash)
);
create index if not exists user_login_devices_user_idx on public.user_login_devices (user_id, last_seen desc);
create table if not exists public.user_login_places (
  user_id    uuid not null references auth.users(id) on delete cascade,
  country    text not null,
  first_seen timestamptz not null default now(),
  primary key (user_id, country)
);
alter table public.user_login_devices enable row level security;
alter table public.user_login_places  enable row level security;
drop policy if exists login_devices_owner_select on public.user_login_devices;
create policy login_devices_owner_select on public.user_login_devices for select to authenticated using (user_id = auth.uid());
revoke all on public.user_login_devices from anon;
revoke all on public.user_login_places  from anon, authenticated;
grant select on public.user_login_devices to authenticated;      -- inserts/updates/deletes only through the functions below

create or replace function public.record_login_device(
  p_device_hash text, p_ua_key text, p_label text, p_browser text, p_os text, p_device_type text, p_language text, p_timezone text, p_screen text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); hdr json; ip text; ctry text; had_any boolean; known boolean; new_country boolean := false; lbl text; res text := 'seen';
begin
  if uid is null or p_device_hash is null or char_length(p_device_hash) < 8 then return jsonb_build_object('result', 'ignored'); end if;
  begin hdr := current_setting('request.headers', true)::json; exception when others then hdr := null; end;
  ip   := nullif(btrim(split_part(coalesce(hdr->>'cf-connecting-ip', hdr->>'x-forwarded-for', ''), ',', 1)), '');
  ctry := upper(left(nullif(btrim(coalesce(hdr->>'cf-ipcountry', '')), ''), 2));
  if ctry in ('XX', 'T1') or ctry !~ '^[A-Z]{2}$' then ctry := null; end if;
  lbl  := left(coalesce(nullif(btrim(p_label), ''), 'Unknown device'), 80);

  select exists (select 1 from public.user_login_devices where user_id = uid) into had_any;
  select exists (select 1 from public.user_login_devices where user_id = uid and (device_hash = p_device_hash or (p_ua_key is not null and ua_key = p_ua_key))) into known;
  if ctry is not null then
    select not exists (select 1 from public.user_login_places where user_id = uid and country = ctry) into new_country;
    insert into public.user_login_places(user_id, country) values (uid, ctry) on conflict do nothing;
  end if;

  insert into public.user_login_devices(user_id, device_hash, ua_key, label, browser, os, device_type, language, timezone, screen, country, ip_hash)
  values (uid, p_device_hash, left(p_ua_key, 128), lbl, left(p_browser, 40), left(p_os, 40), left(p_device_type, 20), left(p_language, 20), left(p_timezone, 60), left(p_screen, 20), ctry,
          case when ip is null then null else encode(sha256(convert_to(uid::text || ':' || ip, 'UTF8')), 'hex') end)
  on conflict (user_id, device_hash) do update
    set last_seen = now(), seen_count = public.user_login_devices.seen_count + 1, label = excluded.label, browser = excluded.browser, os = excluded.os,
        language = excluded.language, timezone = excluded.timezone, screen = excluded.screen,
        country = coalesce(excluded.country, public.user_login_devices.country), ip_hash = coalesce(excluded.ip_hash, public.user_login_devices.ip_hash);

  -- First device ever on this account: remember it silently (no alert for the reader's own first sign-in).
  if had_any then
    if not known then
      res := 'new_device';
      perform public.nl_notify(uid, null, 'new_device_login', 'New sign-in on a new device',
        lbl || coalesce(' · ' || ctry, '') || ' · ' || to_char(now() at time zone 'utc', 'DD Mon YYYY HH24:MI') || ' UTC. If this was not you, change your password now.',
        jsonb_build_object('device', lbl, 'country', ctry), 'dev:' || p_device_hash, '/account/password');
    elsif new_country then
      res := 'new_location';
      perform public.nl_notify(uid, null, 'new_location_login', 'Sign-in from a new location',
        'Your account was used from ' || ctry || ' on ' || lbl || '. This can happen when travelling or using a VPN. If this was not you, change your password now.',
        jsonb_build_object('device', lbl, 'country', ctry), 'loc:' || ctry, '/account/password');
    end if;
  end if;
  return jsonb_build_object('result', res);
exception when others then
  return jsonb_build_object('result', 'error');   -- never blocks sign-in
end $$;
grant execute on function public.record_login_device(text, text, text, text, text, text, text, text, text) to authenticated;

create or replace function public.remove_my_login_device(p_id uuid) returns void language sql security definer set search_path = public as $$
  delete from public.user_login_devices where id = p_id and user_id = auth.uid();
$$;
grant execute on function public.remove_my_login_device(uuid) to authenticated;

-- 6) Report: which optional tables this database has. Missing ones only mean that one feature is skipped; nothing fails.
do $$
declare t text; missing text[] := '{}';
begin
  foreach t in array array['profiles','community_reviews','community_review_likes','community_review_feedback','community_review_comments',
                           'community_review_comment_likes','community_review_feedback_replies','stories','story_likes','story_reposts'] loop
    if to_regclass('public.' || t) is null then missing := missing || t; end if;
  end loop;
  if array_length(missing, 1) is null then raise notice 'NL_SQL_230: all expected tables found.';
  else raise notice 'NL_SQL_230: installed. These tables were not found, so their notifications are skipped (no error): %', array_to_string(missing, ', '); end if;
end $$;

-- ROLLBACK (only if you ever need to undo):
--   drop trigger if exists trg_notifications_respect_settings on public.notifications;
--   drop trigger if exists trg_nl_review_like on public.community_review_likes;
--   drop trigger if exists trg_nl_review_feedback on public.community_review_feedback;
--   drop trigger if exists trg_nl_review_comment on public.community_review_comments;
--   drop trigger if exists trg_nl_comment_like on public.community_review_comment_likes;
--   drop trigger if exists trg_nl_feedback_reply on public.community_review_feedback_replies;
--   drop trigger if exists trg_nl_story_like on public.story_likes;
--   drop trigger if exists trg_nl_story_share on public.story_reposts;
--   drop trigger if exists trg_nl_new_review on public.community_reviews;
--   drop table if exists public.user_login_places, public.user_login_devices, public.user_settings, public.nl_notification_switches;
--   (the 5 nullable notifications columns can stay; they are harmless)
