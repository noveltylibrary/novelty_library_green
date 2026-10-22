import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { fetchEditablePage, saveEditablePage } from '@/lib/adminConfig';
import type { NotificationItem } from '@/lib/notifications';

/**
 * Reader preferences live in the reader's own sign-in record (auth user_metadata.nl_prefs): private to them,
 * available on every device, and no database change is needed.
 */
export type NotifCategory = 'stories' | 'new_reviews' | 'review_interactions' | 'announcements';
export const NOTIF_CATEGORIES: { key: NotifCategory; label: string; hint: string }[] = [
  { key: 'stories', label: 'Stories', hint: 'New stories and story reactions' },
  { key: 'new_reviews', label: 'New reviews on Novelty Library', hint: 'When a new review is published' },
  { key: 'review_interactions', label: 'Your review interactions', hint: 'Likes, comments, ratings, submissions and reservations on your reviews' },
  { key: 'announcements', label: 'New feature announcements', hint: 'Updates from the Novelty Library team' },
];

export interface UserPrefs { notif: Partial<Record<NotifCategory, boolean>>; content: string[] }
const EMPTY: UserPrefs = { notif: {}, content: [] };

function readPrefs(meta: unknown): UserPrefs {
  const p = (meta as { nl_prefs?: Partial<UserPrefs> } | null | undefined)?.nl_prefs;
  return { notif: p?.notif && typeof p.notif === 'object' ? p.notif : {}, content: Array.isArray(p?.content) ? p!.content!.filter((x): x is string => typeof x === 'string') : [] };
}

export function useUserPrefs() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<UserPrefs>(() => readPrefs(user?.user_metadata));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setPrefs(readPrefs(user?.user_metadata)); }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useCallback(async (next: UserPrefs) => {
    const before = prefs;
    setPrefs(next); setSaving(true); setError(null);
    try {
      const { error: err } = await supabase.auth.updateUser({ data: { nl_prefs: next } });
      if (err) throw err;
    } catch (e) { setPrefs(before); setError(e instanceof Error ? e.message : 'Could not save your preferences.'); }
    finally { setSaving(false); }
  }, [prefs]);

  const notifOn = (k: NotifCategory) => prefs.notif[k] !== false;
  return {
    prefs, saving, error, notifOn,
    setNotif: (k: NotifCategory, on: boolean) => save({ ...prefs, notif: { ...prefs.notif, [k]: on } }),
    setContent: (ids: string[]) => save({ ...prefs, content: ids }),
  };
}

/** Which preference switch governs a notification. Account / moderation messages are always shown. */
export function notifCategoryOf(kind: NotificationItem['kind']): NotifCategory | null {
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
