import { useEffect, useState } from 'react';
import { Bell, Loader2, Send, X } from 'lucide-react';
import { adminSendNotification } from '@/lib/notifications';
import { getErrorMessage } from '@/lib/format';

interface AdminNotifyModalProps {
  open: boolean;
  onClose: () => void;
  /** Recipient auth/profile id. */
  userId: string;
  /** Shown under the heading, e.g. "Asha (asha@mail.com)". */
  recipientLabel: string;
  /** Optional context line, e.g. the book the message is about. */
  context?: string;
  defaultTitle?: string;
  onSent?: (message: string) => void;
}

const MAX_TITLE = 120;
const MAX_BODY = 1000;

/** Small dialog admins use to type a message that lands in one user's notification bell. */
export function AdminNotifyModal({ open, onClose, userId, recipientLabel, context, defaultTitle = '', onSent }: AdminNotifyModalProps) {
  const [title, setTitle] = useState(defaultTitle);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) { setTitle(defaultTitle); setBody(''); setError(null); setBusy(false); }
  }, [open, defaultTitle, userId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  const send = async () => {
    if (!title.trim() || !body.trim()) { setError('Add a title and a message first.'); return; }
    setBusy(true); setError(null);
    try {
      await adminSendNotification({ userId, title, body });
      onSent?.(`Notification sent to ${recipientLabel}.`);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not send the notification. Has sql/admin_notifications_1_89.sql been run?'));
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[120] grid place-items-center p-4 bg-black/45 backdrop-blur-sm" onClick={() => !busy && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Send notification" className="w-full max-w-md rounded-3xl p-6" style={{ background: 'var(--color-paper)', border: '1px solid var(--color-border)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2"><Bell className="w-4 h-4" style={{ color: 'var(--color-teal-dark)' }} /><h2 className="font-serif text-xl font-semibold" style={{ color: 'var(--color-text)' }}>Send notification</h2></div>
            <p className="text-sm mt-1 truncate" style={{ color: 'var(--color-text-muted)' }}>To {recipientLabel}</p>
            {context && <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-muted)' }}>About: {context}</p>}
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" style={{ color: 'var(--color-text-muted)' }}><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE))} placeholder="Title" className="input-field w-full" autoFocus />
          <div>
            <textarea value={body} onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY))} rows={5} placeholder="Type your message to the user…" className="input-field w-full resize-y" />
            <p className="text-[11px] text-right mt-1" style={{ color: 'var(--color-text-muted)' }}>{body.length}/{MAX_BODY}</p>
          </div>
          {error && <p className="text-sm rounded-xl p-3" style={{ background: 'rgba(239,68,68,.08)', color: '#dc2626' }}>{error}</p>}
        </div>
        <div className="flex gap-2 mt-4">
          <button type="button" onClick={onClose} disabled={busy} className="btn-ghost flex-1">Cancel</button>
          <button type="button" onClick={() => void send()} disabled={busy || !title.trim() || !body.trim()} className="btn-primary flex-1">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send
          </button>
        </div>
      </div>
    </div>
  );
}
