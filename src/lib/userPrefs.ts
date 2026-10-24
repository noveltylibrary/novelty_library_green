import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { fetchEditablePage, saveEditablePage } from '@/lib/adminConfig';
import type { NotificationItem } from '@/lib/notifications';

/**
 * Reader settings. Stored in the database (user_settings, NL_SQL_230) so they follow the reader to every device AND are enforced
 * on the server: a notification category that is switched off is never created. Until that SQL is run, or if the database call
 * fails, settings fall back to the reader's own sign-in record (auth user_metadata.nl_prefs), exactly as before.
 */
/** One switch per kind of notification. The four legacy keys (stories, review_interactions, new_reviews, announcements) are
 *  still written, derived from the finer switches, because the database filters on them. */
export type NotifCategory =
  | 'review_likes' | 'review_comments' | 'review_ratings' | 'review_replies' | 'review_activity'
  | 'story_likes' | 'story_shares' | 'story_new'
  | 'new_reviews' | 'announcements'
  | 'stories' | 'review_interactions';
type NotifItem = { key: NotifCategory; label: string; hint: string };
/** Settings → Notifications: sections of switches. Section and switch names are kept to one or two words. */
export const NOTIF_GROUPS: { title: string; items: NotifItem[] }[] = [
  { title: 'Reviews', items: [
    { key: 'review_likes', label: 'Likes', hint: 'When someone likes your review' },
    { key: 'review_comments', label: 'Comments', hint: 'When someone comments on your review' },
    { key: 'review_ratings', label: 'Ratings', hint: 'When someone rates your review' },
    { key: 'review_replies', label: 'Replies', hint: 'Replies and likes on your comments, and answers to your feedback' },
    { key: 'review_activity', label: 'Submissions', hint: 'Your reviews being submitted or published, and reservation updates' },
  ] },
  { title: 'Stories', items: [
    { key: 'story_likes', label: 'Likes', hint: 'When someone likes your story' },
    { key: 'story_shares', label: 'Shares', hint: 'When someone shares your story' },
    { key: 'story_new', label: 'New stories', hint: 'When someone you follow posts a story' },
  ] },
  { title: 'Library', items: [
    { key: 'new_reviews', label: 'New reviews', hint: 'When a new review is published on Novelty Library' },
  ] },
  { title: 'Updates', items: [
    { key: 'announcements', label: 'Announcements', hint: 'New features and news from the Novelty Library team' },
  ] },
];
export const NOTIF_CATEGORIES: NotifItem[] = NOTIF_GROUPS.flatMap((g) => g.items);
const REVIEW_KEYS: NotifCategory[] = ['review_likes', 'review_comments', 'review_ratings', 'review_replies', 'review_activity'];
const STORY_KEYS: NotifCategory[] = ['story_likes', 'story_shares', 'story_new'];
/** The old single switch a finer switch falls back to when the reader has not touched the finer one yet. */
const LEGACY_PARENT: Partial<Record<NotifCategory, NotifCategory>> = {
  review_likes: 'review_interactions', review_comments: 'review_interactions', review_ratings: 'review_interactions', review_replies: 'review_interactions', review_activity: 'review_interactions',
  story_likes: 'stories', story_shares: 'stories', story_new: 'stories',
};
const NOTIF_KEYS: NotifCategory[] = [...NOTIF_CATEGORIES.map((c) => c.key), 'stories', 'review_interactions'];

/* ---------- Taste Match SE controls ---------- */
/** What Taste Match SE may learn from. Every switch starts ON; each reader's choices apply to that reader only. */
export interface TasteMatchControls { profilePersonal: boolean; profileReading: boolean; reviews: boolean; interests: boolean; device: boolean; browser: boolean }
export type TasteMatchKey = keyof TasteMatchControls;
export const TASTE_MATCH_DEFAULTS: TasteMatchControls = { profilePersonal: true, profileReading: true, reviews: true, interests: true, device: true, browser: true };
export const TASTE_MATCH_NOTE = 'This information is taken only to give you better, more personal matches. It is not shared with anyone and is kept solely with Novelty Library. You can switch any of it off, and it applies to your account only.';

export const MAX_MUTED = 100;
export interface UserPrefs { notif: Partial<Record<NotifCategory, boolean>>; content: string[]; muted: string[]; tm: TasteMatchControls }
const EMPTY: UserPrefs = { notif: {}, content: [], muted: [], tm: TASTE_MATCH_DEFAULTS };

type RawPrefs = { notif?: unknown; content?: unknown; muted?: unknown; tm?: unknown };
const cleanMuted = (list: unknown): string[] => {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>(); const out: string[] = [];
  for (const x of list) { if (typeof x !== 'string') continue; const t = x.trim().replace(/\s+/g, ' ').slice(0, 60); const k = t.toLowerCase(); if (t && !seen.has(k)) { seen.add(k); out.push(t); } }
  return out.slice(0, MAX_MUTED);
};
const cleanTm = (v: unknown): TasteMatchControls => {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const pick = (k: TasteMatchKey) => (typeof o[k] === 'boolean' ? (o[k] as boolean) : true);
  return { profilePersonal: pick('profilePersonal'), profileReading: pick('profileReading'), reviews: pick('reviews'), interests: pick('interests'), device: pick('device'), browser: pick('browser') };
};
function normalise(p: RawPrefs | null | undefined): UserPrefs {
  const notif: Partial<Record<NotifCategory, boolean>> = {};
  if (p?.notif && typeof p.notif === 'object') for (const k of NOTIF_KEYS) { const v = (p.notif as Record<string, unknown>)[k]; if (typeof v === 'boolean') notif[k] = v; }
  return { notif, content: Array.isArray(p?.content) ? (p!.content as unknown[]).filter((x): x is string => typeof x === 'string') : [], muted: cleanMuted(p?.muted), tm: cleanTm(p?.tm) };
}
const readMeta = (meta: unknown): UserPrefs => normalise((meta as { nl_prefs?: RawPrefs } | null | undefined)?.nl_prefs);
/** Keeps the four legacy switches in step with the finer ones so the database still honours "off". */
function withLegacy(notif: UserPrefs['notif']): UserPrefs['notif'] {
  const on = (k: NotifCategory) => notif[k] !== false;
  const touched = (keys: NotifCategory[]) => keys.some((k) => typeof notif[k] === 'boolean');
  const out = { ...notif };
  if (touched(REVIEW_KEYS)) out.review_interactions = REVIEW_KEYS.some(on);
  if (touched(STORY_KEYS)) out.stories = STORY_KEYS.some(on);
  return out;
}

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
    const meta = readMeta(user?.user_metadata);
    setPrefs(meta);
    void Promise.resolve(supabase.rpc('get_my_settings')).then(({ data, error: err }) => {
      if (!alive) return;
      // The database holds notifications + content; muted words and Taste Match controls travel with the sign-in record.
      const next = !err && data ? { ...normalise(data as RawPrefs), muted: meta.muted, tm: meta.tm } : meta;
      publish(uid, next); setLoaded(true);
    }).catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useCallback(async (raw: UserPrefs) => {
    if (!uid) return;
    const next: UserPrefs = { ...raw, notif: withLegacy(raw.notif) };
    const before = prefs;
    publish(uid, next); setSaving(true); setError(null);
    try {
      const { error: err } = await supabase.rpc('save_my_settings', { p_notif: next.notif, p_content: next.content });
      // Always keep a full copy on the sign-in record: it carries muted words and Taste Match controls, and is the fallback if the SQL is missing.
      const { error: meta } = await supabase.auth.updateUser({ data: { nl_prefs: next } });
      if (err && meta) throw meta;
    } catch (e) { publish(uid, before); setError(e instanceof Error ? e.message : 'Could not save your preferences.'); }
    finally { setSaving(false); }
  }, [prefs, uid]);

  const notifOn = useCallback((k: NotifCategory) => {
    const own = prefs.notif[k];
    if (typeof own === 'boolean') return own;
    const parent = LEGACY_PARENT[k];
    return parent ? prefs.notif[parent] !== false : true;
  }, [prefs.notif]);
  return {
    prefs, saving, error, loaded, notifOn,
    setNotif: (k: NotifCategory, on: boolean) => save({ ...prefs, notif: { ...prefs.notif, [k]: on } }),
    setAllNotif: (on: boolean) => save({ ...prefs, notif: Object.fromEntries(NOTIF_CATEGORIES.map((c) => [c.key, on])) as UserPrefs['notif'] }),
    setContent: (ids: string[]) => save({ ...prefs, content: ids }),
    setMuted: (words: string[]) => save({ ...prefs, muted: cleanMuted(words) }),
    setTasteMatch: (k: TasteMatchKey, on: boolean) => save({ ...prefs, tm: { ...prefs.tm, [k]: on } }),
  };
}

/** Which preference switch governs a notification. Account / security / moderation messages are always shown. Mirrors nl_notif_category() in SQL. */
export function notifCategoryOf(kind: NotificationItem['kind'], event?: string | null): NotifCategory | null {
  switch (event) {
    case 'new_device_login': case 'new_location_login': return null;
    case 'review_like': return 'review_likes';
    case 'review_rating': return 'review_ratings';
    case 'review_comment': return 'review_comments';
    case 'comment_reply': case 'comment_like': case 'feedback_reply': return 'review_replies';
    case 'story_like': return 'story_likes';
    case 'story_share': return 'story_shares';
    case 'new_story': return 'story_new';
    case 'new_review': return 'new_reviews';
    case 'announcement': return 'announcements';
    default: break;
  }
  switch (kind) {
    case 'review_submitted': case 'review_published': case 'reservation_requested': case 'reservation_accepted': case 'reservation_rejected': return 'review_activity';
    case 'system': return 'announcements';
    default: return null;
  }
}

/* ---------- Muted words & phrases ---------- */
const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const fold = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
/** A test for "does this text contain a muted word or phrase": whole words only, ignoring case and accents. */
export function buildMuteMatcher(words: string[]): (text: string | null | undefined) => boolean {
  const parts = words.map((w) => fold(w).trim().replace(/\s+/g, ' ')).filter(Boolean).map((w) => esc(w).replace(/ /g, '\\s+'));
  if (!parts.length) return () => false;
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(?:${parts.join('|')})(?![\\p{L}\\p{N}])`, 'iu');
  return (text) => !!text && re.test(fold(text));
}
/** Hook form: `isMuted(review.title, review.review_text)` is true when any muted word shows up. */
export function useMuteFilter(): (...texts: (string | null | undefined)[]) => boolean {
  const { prefs } = useUserPrefs();
  const key = prefs.muted.join('\u0001');
  return useMemo(() => { const test = buildMuteMatcher(prefs.muted); return (...texts) => texts.some(test); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
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
