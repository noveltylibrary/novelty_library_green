import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

export interface NotificationItem {
  id: string;
  kind: 'review_submitted' | 'review_published' | 'account_created' | 'username_updated' | 'reservation_requested' | 'reservation_accepted' | 'reservation_rejected' | 'grievance_submitted' | 'user_blacklisted' | 'system';
  title: string;
  body: string;
  review_id: string | null;
  review_number: string | null;
  read_at: string | null;
  created_at: string;
}

export async function fetchNotifications(limit = 60): Promise<NotificationItem[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id,kind,title,body,review_id,review_number,read_at,created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as NotificationItem[];
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function markAllNotificationsRead() {
  const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
  if (error) throw error;
}

export function useUnreadNotifications() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) { setCount(0); return; }
    const { count: unread, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .is('read_at', null);
    if (!error) setCount(unread ?? 0);
  }, [user?.id]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => {
        setCount((n) => n + 1);
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id]);

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
