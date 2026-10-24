import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { soundFx } from '@/lib/soundFx';
import { notifCategoryOf, useUserPrefs } from '@/lib/userPrefs';

export interface NotificationItem {
  id: string;
  kind: 'review_submitted' | 'review_published' | 'account_created' | 'username_updated' | 'reservation_requested' | 'reservation_accepted' | 'reservation_rejected' | 'grievance_submitted' | 'user_blacklisted' | 'system';
  title: string;
  body: string;
  review_id: string | null;
  review_number: string | null;
  read_at: string | null;
  created_at: string;
  /** Specific type of a v2.26 notification (review_like, story_share, new_device_login …). Absent on older rows / before NL_SQL_230. */
  event?: string | null;
  link?: string | null;
  meta?: { review_id?: string; review_no?: string; story_id?: string; comment_id?: string; device?: string; country?: string } | null;
}

export async function fetchNotifications(limit = 60): Promise<NotificationItem[]> {
  // Newer columns exist after NL_SQL_230; fall back to the original column list so the page never breaks before it is run.
  const full = await supabase.from('notifications').select('id,kind,title,body,review_id,review_number,read_at,created_at,event,link,meta').order('created_at', { ascending: false }).limit(limit);
  if (!full.error) return (full.data ?? []) as NotificationItem[];
  const { data, error } = await supabase.from('notifications').select('id,kind,title,body,review_id,review_number,read_at,created_at').order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []) as NotificationItem[];
}

/** Marks one notification read. Returns false when the database changed nothing (e.g. no permission), so the UI never pretends. */
export async function markNotificationRead(id: string): Promise<boolean> {
  const { data, error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).is('read_at', null).select('id');
  if (error) throw error;
  if ((data ?? []).length > 0) adjustUnread(-1);
  return true;
}

/** Marks every unread notification read and clears the bell badge. */
export async function markAllNotificationsRead(): Promise<number> {
  const { data, error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null).select('id');
  if (error) throw error;
  const n = (data ?? []).length;
  setUnread(0);
  return n;
}

/* ---- Shared unread count: the bell, the menu and the notifications page all read the same number. ---- */
let unread = 0;
const unreadListeners = new Set<(n: number) => void>();
let primed = false;
function setUnread(n: number) { if (primed && n > unread) soundFx.play('ping'); primed = true; unread = Math.max(0, n); unreadListeners.forEach((fn) => fn(unread)); }
function adjustUnread(d: number) { setUnread(unread + d); }
/** Call when the reader has seen their notifications: the badge disappears everywhere at once. */
export const clearUnreadBadge = () => setUnread(0);

export function useUnreadNotifications() {
  const { user } = useAuth();
  const { notifOn } = useUserPrefs();
  const [count, setCount] = useState(unread);
  useEffect(() => { unreadListeners.add(setCount); return () => { unreadListeners.delete(setCount); }; }, []);

  const refresh = useCallback(async () => {
    if (!user) { setUnread(0); return; }
    // Count only what the reader would actually see (categories they switched off are not counted).
    let rows: { kind: NotificationItem['kind']; event?: string | null }[] | null = null;
    const full = await supabase.from('notifications').select('kind,event').is('read_at', null).limit(200);
    if (!full.error) rows = (full.data ?? []) as typeof rows;
    else {
      const basic = await supabase.from('notifications').select('kind').is('read_at', null).limit(200);
      if (!basic.error) rows = (basic.data ?? []) as typeof rows;
    }
    if (rows) setUnread(rows.filter((r) => { const c = notifCategoryOf(r.kind, r.event); return !c || notifOn(c); }).length);
  }, [user?.id, notifOn]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void refresh(); }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => { void refresh(); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => { void refresh(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return { unreadCount: count, refresh };
}

export type AdminNotificationKind = 'system' | 'reservation_accepted' | 'reservation_rejected' | 'review_published';

/**
 * Admin → user notification (needs sql/admin_notifications_1_89.sql). userId = null sends to every registered user.
 * Returns how many notifications were created. `dedupe` skips users who already got the identical message in the
 * last 10 minutes — used by the automatic "accepted" messages so a database trigger can never cause doubles.
 */
export async function adminSendNotification(input: {
  userId: string | null;
  title: string;
  body: string;
  kind?: AdminNotificationKind;
  dedupe?: boolean;
}): Promise<number> {
  const { data, error } = await supabase.rpc('admin_send_notification', {
    p_user_id: input.userId,
    p_title: input.title,
    p_body: input.body,
    p_kind: input.kind ?? 'system',
    p_dedupe: input.dedupe ?? false,
  });
  if (error) throw error;
  return Number(data ?? 0);
}
