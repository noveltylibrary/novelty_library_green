import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Bell, CheckCircle2, Loader2, Megaphone, RefreshCw, Search, Send, UserRound, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { adminSendNotification } from '@/lib/notifications';
import { getErrorMessage } from '@/lib/format';

interface Contact {
  id: string;
  email: string | null;
  profile_name: string | null;
  profile_email: string | null;
  novelty_username: string | null;
  avatar_url: string | null;
}

interface SentEntry { id: number; to: string; title: string; at: string; count: number; }

const MAX_TITLE = 120;
const MAX_BODY = 1000;

const contactName = (c: Contact) => c.profile_name || c.novelty_username || c.email || c.profile_email || 'Reader';
const contactEmail = (c: Contact) => c.email || c.profile_email || '';

/** Admin → user notifications. Rendered inside the Control Panel (the caller guarantees the viewer is an admin). */
export function AdminNotifyPanel() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<'one' | 'all'>('one');
  const [selected, setSelected] = useState<Contact | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<SentEntry[]>([]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('admin_list_users');
      if (rpcError) throw rpcError;
      setContacts(((data ?? []) as Contact[]).filter((c) => c.id));
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load users.'));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? contacts.filter((c) => [c.profile_name, c.novelty_username, c.email, c.profile_email].some((v) => (v || '').toLowerCase().includes(q)))
      : contacts;
    return list.slice(0, 80);
  }, [contacts, search]);

  const canSend = !!title.trim() && !!body.trim() && (mode === 'all' || !!selected) && !sending;

  const send = async () => {
    if (!canSend) return;
    const target = mode === 'all' ? null : selected!.id;
    const label = mode === 'all' ? `all ${contacts.length} users` : contactName(selected!);
    if (mode === 'all' && !window.confirm(`Send this notification to ${label}? This cannot be undone.`)) return;
    setSending(true); setError(null); setNotice(null);
    try {
      const count = await adminSendNotification({ userId: target, title, body });
      setNotice(`Sent to ${label}${count > 1 ? ` (${count} notifications)` : ''}.`);
      setSent((prev) => [{ id: Date.now(), to: label, title: title.trim(), at: new Date().toLocaleTimeString(), count }, ...prev].slice(0, 15));
      setTitle(''); setBody('');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not send. Has sql/admin_notifications_1_89.sql been run in Supabase?'));
    } finally { setSending(false); }
  };

  return (
    <section className="mt-10" aria-labelledby="admin-notify-heading">
      <div className="flex items-center gap-2"><Bell className="w-5 h-5" style={{ color: 'var(--color-teal-dark)' }} /><h2 id="admin-notify-heading" className="font-serif text-2xl font-semibold tracking-tight" style={{ color: 'var(--color-text)' }}>Notify Users</h2></div>
      <p className="text-sm mt-1 mb-6" style={{ color: 'var(--color-text-muted)' }}>Browse your contacts and send a message straight to a reader's notification bell — or to everyone. You can also notify a reader from the Submitted and Reserved lists.</p>

      {error && <div className="flex items-start gap-2 p-4 rounded-xl mb-5" style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)' }}><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#ef4444' }} /><p className="text-sm" style={{ color: '#ef4444' }}>{error}</p><button onClick={() => setError(null)} className="ml-auto" style={{ color: '#ef4444' }} aria-label="Dismiss"><X className="w-4 h-4" /></button></div>}
      {notice && <div className="flex items-start gap-2 p-4 rounded-xl mb-5" style={{ background: 'rgba(53,211,217,.08)', border: '1px solid rgba(53,211,217,.2)' }}><CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-teal-dark)' }} /><p className="text-sm font-medium" style={{ color: 'var(--color-teal-dark)' }}>{notice}</p><button onClick={() => setNotice(null)} className="ml-auto" style={{ color: 'var(--color-teal-dark)' }} aria-label="Dismiss"><X className="w-4 h-4" /></button></div>}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Contacts */}
        <section className="lg:col-span-2 surface-card p-4">
          <div className="flex flex-wrap gap-2 mb-3">
            {([['one', 'One reader', UserRound], ['all', 'Everyone', Megaphone]] as const).map(([key, label, Icon]) => (
              <button key={key} type="button" onClick={() => setMode(key)} className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium" style={{ background: mode === key ? 'var(--color-teal-dark)' : 'var(--color-surface)', color: mode === key ? 'white' : 'var(--color-text-muted)', border: mode === key ? 'none' : '1px solid var(--color-border)' }}><Icon className="w-4 h-4" /> {label}</button>
            ))}
            <button type="button" onClick={() => void load()} className="ml-auto p-2 rounded-full" title="Refresh contacts" aria-label="Refresh contacts" style={{ color: 'var(--color-text-muted)' }}><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
          </div>
          {mode === 'one' ? <>
            <div className="relative mb-3"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-text-muted)' }} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, username or email" className="input-field pl-10" /></div>
            <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
              {loading ? <p className="text-sm py-6 text-center" style={{ color: 'var(--color-text-muted)' }}>Loading contacts…</p>
                : !filtered.length ? <p className="text-sm py-6 text-center" style={{ color: 'var(--color-text-muted)' }}>No matching users.</p>
                : filtered.map((c) => {
                  const active = selected?.id === c.id;
                  return <button key={c.id} type="button" onClick={() => setSelected(c)} className="w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-colors" style={{ background: active ? 'rgba(0,151,178,.1)' : 'transparent', border: active ? '1px solid rgba(0,151,178,.35)' : '1px solid transparent' }}>
                    {c.avatar_url ? <img src={c.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" /> : <span className="w-9 h-9 rounded-full grid place-items-center flex-shrink-0" style={{ background: 'rgba(0,151,178,.1)', color: 'var(--color-cyan-dark)' }}><UserRound className="w-4 h-4" /></span>}
                    <span className="min-w-0"><span className="block text-sm font-semibold truncate" style={{ color: 'var(--color-text)' }}>{contactName(c)}</span><span className="block text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{contactEmail(c)}{c.novelty_username ? ` · @${c.novelty_username}` : ''}</span></span>
                  </button>;
                })}
            </div>
          </> : <div className="rounded-xl p-4 text-sm" style={{ background: 'rgba(245,158,11,.08)', color: 'var(--color-text-muted)' }}><strong style={{ color: '#d97706' }}>Broadcast.</strong> The message goes to all {loading ? '' : contacts.length} registered users. Use sparingly.</div>}
        </section>

        {/* Composer */}
        <section className="lg:col-span-3 surface-card p-5">
          <p className="text-xs uppercase tracking-widest font-semibold mb-3" style={{ color: 'var(--color-teal-dark)' }}>{mode === 'all' ? 'To: everyone' : selected ? `To: ${contactName(selected)}` : 'Pick a reader on the left'}</p>
          <div className="space-y-3">
            <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE))} placeholder="Title" className="input-field w-full" />
            <div><textarea value={body} onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY))} rows={7} placeholder="Type your message…" className="input-field w-full resize-y" /><p className="text-[11px] text-right mt-1" style={{ color: 'var(--color-text-muted)' }}>{body.length}/{MAX_BODY}</p></div>
            <button type="button" onClick={() => void send()} disabled={!canSend} className="btn-primary">{sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send notification</button>
          </div>
          {sent.length > 0 && <div className="mt-6"><p className="text-xs uppercase tracking-widest font-semibold mb-2" style={{ color: 'var(--color-text-muted)' }}>Sent this session</p><ul className="space-y-1.5">{sent.map((s) => <li key={s.id} className="text-sm flex flex-wrap gap-x-2" style={{ color: 'var(--color-text-muted)' }}><CheckCircle2 className="w-4 h-4 mt-0.5" style={{ color: 'var(--color-teal-dark)' }} /><span className="font-medium" style={{ color: 'var(--color-text)' }}>{s.title}</span><span>→ {s.to}</span><span className="ml-auto text-xs">{s.at}</span></li>)}</ul></div>}
        </section>
      </div>
    </section>
  );
}
