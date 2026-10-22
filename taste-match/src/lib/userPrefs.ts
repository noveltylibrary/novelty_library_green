import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { fetchEditablePage, saveEditablePage } from '@/lib/adminConfig';
import type { NotificationItem } from '@/lib/notifications';

/**
 * Reader settings. Stored in the database (user_settings, NL_SQL_230) so they follow the reader to every device AND are enforced
 * on the server: a notification category that is switched off is never created. Until that SQL is run, or if the database call
 * fails, settings fall back to the reader's own sign-in record (auth user_metadata.nl_prefs), exactly as before.
 */
export type NotifCategory = 'stories' | 'new_reviews' | 'review_interactions' | 'announcements';
export const NOTIF_CATEGORIES: { key: NotifCategory; label: string; hint: string }[] = [
  { key: 'stories', label: 'Stories', hint: 'Likes and shares on your stories' },
  { key: 'new_reviews', label: 'New reviews on Novelty Library', hint: 'When a new review is published' },
  { key: 'review_interactions', label: 'Your review interactions', hint: 'Likes, comments, ratings, replies, submissions and reservations on your reviews' },
  { key: 'announcements', label: 'New feature announcements', hint: 'Updates from the Novelty Library team' },
];

export interface UserPrefs { notif: Partial<Record<NotifCategory, boolean>>; content: string[] }
const EMPTY: UserPrefs = { notif: {}, content: [] };

function normalise(p: { notif?: unknown; content?: unknown } | null | undefined): UserPrefs {
  const notif: Partial<Record<NotifCategory, boolean>> = {};
  if (p?.notif && typeof p.notif === 'object') for (const c of NOTIF_CATEGORIES) { const v = (p.notif as Record<string, unknown>)[c.key]; if (typeof v === 'boolean') notif[c.key] = v; }
  return { notif, content: Array.isArray(p?.content) ? (p!.content as unknown[]).filter((x): x is string => typeof x === 'string') : [] };
}
const readMeta = (meta: unknown): UserPrefs => normalise((meta as { nl_prefs?: UserPrefs } | null | undefined)?.nl_prefs);

// One shared copy per signed-in reader so every screen (settings, notification list, bell) agrees.
let cache: { uid: string; prefs: UserPrefs } | null = null;
const listeners = new Set<(p: UserPrefs) => void>();
const publish = (uid: string, prefs: UserPrefs) => { cache = { uid, prefs }; listeners.forEach((fn) => fn(prefs)); };

export function useUserPrefs() {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const [prefs, setPrefs] = useState<UserPrefs>(() => (cache && cache.uid === uid ? cache.prefs : readMeta(user?.user_metadata)));
  const [loaded, setLoaded] = useState(() => !!(cache && cache.uid === uid));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { listeners.add(setPrefs); return () => { listeners.delete(setPrefs); }; }, []);
  useEffect(() => {
    if (!uid) { setPrefs(EMPTY); setLoaded(false); return; }
    if (cache && cache.uid === uid) { setPrefs(cache.prefs); setLoaded(true); return; }
    let alive = true;
    setPrefs(readMeta(user?.user_metadata));
    void Promise.resolve(supabase.rpc('get_my_settings')).then(({ data, error: err }) => {
      if (!alive) return;
      const next = !err && data ? normalise(data as { notif?: unknown; content?: unknown }) : readMeta(user?.user_metadata);
      publish(uid, next); setLoaded(true);
    }).catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useCallback(async (next: UserPrefs) => {
    if (!uid) return;
    const before = prefs;
    publish(uid, next); setSaving(true); setError(null);
    try {
      const { error: err } = await supabase.rpc('save_my_settings', { p_notif: next.notif, p_content: next.content });
      if (err) {
        // SQL not run yet (or blocked): keep the original behaviour so settings still save.
        const { error: legacy } = await supabase.auth.updateUser({ data: { nl_prefs: next } });
        if (legacy) throw legacy;
      }
    } catch (e) { publish(uid, before); setError(e instanceof Error ? e.message : 'Could not save your preferences.'); }
    finally { setSaving(false); }
  }, [prefs, uid]);

  const notifOn = (k: NotifCategory) => prefs.notif[k] !== false;
  return {
    prefs, saving, error, loaded, notifOn,
    setNotif: (k: NotifCategory, on: boolean) => save({ ...prefs, notif: { ...prefs.notif, [k]: on } }),
    setAllNotif: (on: boolean) => save({ ...prefs, notif: Object.fromEntries(NOTIF_CATEGORIES.map((c) => [c.key, on])) as UserPrefs['notif'] }),
    setContent: (ids: string[]) => save({ ...prefs, content: ids }),
  };
}

/** Which preference switch governs a notification. Account / security / moderation messages are always shown. Mirrors nl_notif_category() in SQL. */
export function notifCategoryOf(kind: NotificationItem['kind'], event?: string | null): NotifCategory | null {
  switch (event) {
    case 'new_device_login': case 'new_location_login': return null;
    case 'review_like': case 'review_rating': case 'review_comment': case 'comment_reply': case 'comment_like': case 'feedback_reply': return 'review_interactions';
    case 'story_like': case 'story_share': case 'new_story': return 'stories';
    case 'new_review': return 'new_reviews';
    case 'announcement': return 'announcements';
    default: break;
  }
  switch (kind) {
    case 'review_submitted': case 'review_published': case 'reservation_requested': case 'reservation_accepted': case 'reservation_rejected': return 'review_interactions';
    case 'system': return 'announcements';
    default: return null;
  }
}

/* ---------- Content preference traits (admin-defined, shown to readers) ---------- */
export interface ContentTrait { id: string; label: string; hint?: string }
const TRAITS_SLUG = 'content-preferences';

export async function fetchContentTraits(): Promise<ContentTrait[]> {
  try {
    const page = await fetchEditablePage(TRAITS_SLUG);
    const parsed = JSON.parse(page.content || '[]');
    return Array.isArray(parsed) ? parsed.filter((t): t is ContentTrait => !!t && typeof t.id === 'string' && typeof t.label === 'string') : [];
  } catch { return []; }
}
export async function saveContentTraits(traits: ContentTrait[]): Promise<void> {
  await saveEditablePage(TRAITS_SLUG, 'Content preference traits', JSON.stringify(traits));
}
