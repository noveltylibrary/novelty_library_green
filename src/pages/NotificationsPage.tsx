import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Bell, CheckCheck, FileText, Globe2, Inbox, Loader2, UserPlus, AtSign } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { fetchNotifications, markAllNotificationsRead, markNotificationRead, type NotificationItem } from '@/lib/notifications';

interface NotificationsPageProps { navigate: (path: string) => void; }

export function NotificationsPage({ navigate }: NotificationsPageProps) {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [busy, setBusy] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    try { setItems(await fetchNotifications()); } finally { setBusy(false); }
  }, [user?.id]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <div className="pt-32 container-prose text-center"><Loader2 className="w-6 h-6 mx-auto animate-spin" style={{ color: 'var(--color-cyan-dark)' }} /></div>;
  if (!user) return <div className="pt-32 container-prose text-center max-w-md mx-auto"><Bell className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--color-text-muted)' }} /><h1 className="font-serif text-2xl font-semibold mb-2">Sign In Required</h1><p className="text-sm mb-5" style={{ color: 'var(--color-text-muted)' }}>Notifications are available for logged-in readers.</p><button onClick={() => navigate('/auth')} className="btn-primary">Sign In</button></div>;

  const unread = items.filter((item) => !item.read_at).length;
  const markAll = async () => { setMarkingAll(true); try { await markAllNotificationsRead(); setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() }))); } finally { setMarkingAll(false); } };
  const open = async (item: NotificationItem) => {
    if (!item.read_at) { await markNotificationRead(item.id); setItems((prev) => prev.map((n) => n.id === item.id ? { ...n, read_at: new Date().toISOString() } : n)); }
    if (item.kind === 'review_published' && item.review_number) navigate('/reviews');
    else if (item.kind === 'review_submitted') navigate('/admin/book-reviews/submitted');
    else if (item.kind === 'account_created' || item.kind === 'username_updated') navigate('/profile');
  };

  return <div className="pt-24 pb-20 container-prose animate-fade-in">
    <button onClick={() => navigate('/')} className="inline-flex items-center gap-1.5 text-sm mb-7" style={{ color: 'var(--color-text-muted)' }}><ArrowLeft className="w-4 h-4" /> Home</button>
    <div className="max-w-3xl mx-auto">
      <div className="flex items-end justify-between gap-4 mb-7"><div><div className="inline-flex items-center gap-2 text-xs uppercase tracking-[.18em] font-semibold" style={{ color: 'var(--color-teal-dark)' }}><Bell className="w-3.5 h-3.5" /> Notifications</div><h1 className="font-serif text-4xl font-semibold mt-2" style={{ color: 'var(--color-text)' }}>Your notifications</h1><p className="text-sm mt-2" style={{ color: 'var(--color-text-muted)' }}>{unread ? `${unread} unread` : 'You are all caught up.'}</p></div>{unread > 0 && <button onClick={() => void markAll()} disabled={markingAll} className="btn-ghost text-sm"><CheckCheck className="w-4 h-4" /> Mark all read</button>}</div>
      {busy ? <div className="surface-card p-12 text-center"><Loader2 className="w-6 h-6 mx-auto animate-spin" style={{ color: 'var(--color-cyan-dark)' }} /></div> : items.length === 0 ? <div className="surface-card p-12 text-center"><Inbox className="w-9 h-9 mx-auto mb-3" style={{ color: 'var(--color-text-muted)' }} /><p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No notifications yet.</p></div> : <div className="space-y-3">{items.map((item) => <button key={item.id} onClick={() => void open(item)} className="surface-card w-full p-4 text-left flex gap-3 transition-all hover:-translate-y-0.5" style={{ borderColor: !item.read_at ? 'rgba(0,151,178,.28)' : 'var(--color-border)', background: !item.read_at ? 'rgba(53,211,217,.055)' : 'var(--color-surface)' }}><span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(0,151,178,.1)', color: 'var(--color-cyan-dark)' }}>{item.kind === 'review_published' ? <Globe2 className="w-5 h-5" /> : item.kind === 'account_created' ? <UserPlus className="w-5 h-5" /> : item.kind === 'username_updated' ? <AtSign className="w-5 h-5" /> : <FileText className="w-5 h-5" />}</span><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><strong className="text-sm" style={{ color: 'var(--color-text)' }}>{item.title}</strong>{!item.read_at && <span className="w-2 h-2 rounded-full" style={{ background: 'var(--color-cyan-dark)' }} />}</span><span className="block text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>{item.body}</span><span className="block text-[11px] mt-2" style={{ color: 'var(--color-text-muted)' }}>{new Date(item.created_at).toLocaleString()}</span></span></button>)}</div>}
    </div>
  </div>;
}
