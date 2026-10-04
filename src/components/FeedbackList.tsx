import { useCallback, useEffect, useMemo, useState } from 'react';
import { CornerDownRight, Loader2, MessageCircle, Pencil, Send, Star, Trash2 } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { formatShortDate } from '@/lib/format';
import type { FeedbackEntry } from '@/lib/engagement';
import type { Profile } from '@/types/review';
import { addFeedbackReply, deleteFeedbackReply, fetchFeedbackReplies, type FeedbackReply } from '@/lib/feedbackReplies';
import { sanitizeUserText } from '@/lib/sanitize';

interface FeedbackListProps {
  entries: FeedbackEntry[];
  currentUserId?: string;
  user?: User | null;
  profile?: Profile | null;
  navigate?: (path: string) => void;
  onEdit: () => void;
  onDelete: () => void;
}

/** Reader reviews shown under a post, each with a reply thread (replies can be replied to). */
export function FeedbackList({ entries, currentUserId, user = null, profile = null, navigate, onEdit, onDelete }: FeedbackListProps) {
  const [replies, setReplies] = useState<FeedbackReply[]>([]);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [composer, setComposer] = useState<{ feedbackId: string; parentId: string | null; prefill: string } | null>(null);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const idsKey = entries.map((e) => e.id).join(',');
  const load = useCallback(() => {
    const ids = idsKey ? idsKey.split(',') : [];
    fetchFeedbackReplies(ids).then(setReplies).catch(() => setReplies([]));
  }, [idsKey]);
  useEffect(() => { load(); }, [load]);

  const byFeedback = useMemo(() => {
    const map = new Map<string, FeedbackReply[]>();
    for (const r of replies) map.set(r.feedback_id, [...(map.get(r.feedback_id) ?? []), r]);
    return map;
  }, [replies]);
  const childrenOf = useMemo(() => {
    const map = new Map<string, FeedbackReply[]>();
    for (const r of replies) if (r.parent_id) map.set(r.parent_id, [...(map.get(r.parent_id) ?? []), r]);
    return map;
  }, [replies]);

  if (entries.length === 0) {
    return <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No reader reviews yet. Be the first to add one.</p>;
  }

  const toggle = (id: string) => setOpen((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const startReply = (feedbackId: string, parentId: string | null, prefill = '') => {
    if (!user) { navigate?.('/auth'); return; }
    setOpen((prev) => new Set(prev).add(feedbackId));
    setComposer({ feedbackId, parentId, prefill });
    setText(prefill); setError(null);
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !composer) return;
    setSaving(true); setError(null);
    try {
      await addFeedbackReply(user, profile, composer.feedbackId, text, composer.parentId);
      setComposer(null); setText(''); load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not post reply.'); }
    finally { setSaving(false); }
  };
  const remove = async (reply: FeedbackReply) => {
    if (!user) return;
    try { await deleteFeedbackReply(user, reply.id); setReplies((prev) => prev.filter((r) => r.id !== reply.id && r.parent_id !== reply.id)); } catch { /* keep visible */ }
  };

  const renderReply = (reply: FeedbackReply, depth: number) => (
    <div key={reply.id} className="nl-reply" style={{ marginLeft: depth ? 'clamp(10px, 3vw, 22px)' : 0 }}>
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 nl-chip">{(reply.user_name || 'R').charAt(0).toUpperCase()}</span>
        <span className="text-xs font-semibold truncate" style={{ color: 'var(--color-text)' }}>{sanitizeUserText(reply.user_name, 120)}</span>
        <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{formatShortDate(reply.created_at)}</span>
      </div>
      <p className="text-[13px] leading-relaxed mt-1.5 whitespace-pre-wrap break-words" style={{ color: 'var(--color-text)' }}>{sanitizeUserText(reply.reply_text, 600)}</p>
      <div className="flex items-center gap-1 mt-1">
        <button type="button" className="comment-action" onClick={() => startReply(reply.feedback_id, reply.id, `@${sanitizeUserText(reply.user_name, 120)} `)}><CornerDownRight className="w-3 h-3" /> Reply</button>
        {user?.id === reply.user_id && <button type="button" className="comment-action" onClick={() => void remove(reply)}><Trash2 className="w-3 h-3" /> Delete</button>}
      </div>
      {(childrenOf.get(reply.id) ?? []).map((child) => renderReply(child, Math.min(depth + 1, 3)))}
    </div>
  );

  return (
    <ul className="space-y-3">
      {entries.map((e) => {
        const mine = e.user_id === currentUserId;
        const thread = byFeedback.get(e.id) ?? [];
        const roots = thread.filter((r) => !r.parent_id);
        const expanded = open.has(e.id);
        const composing = composer?.feedbackId === e.id;
        return (
          <li key={e.id} className="surface-card p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 nl-chip">{(e.user_name || 'R').charAt(0).toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text)' }}>{sanitizeUserText(e.user_name, 120)}{mine && <span className="ml-1.5 text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-teal-dark)' }}>You</span>}</p>
                <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{formatShortDate(e.updated_at || e.created_at)}</p>
              </div>
              {e.rating !== null && (
                <span className="nl-chip text-xs font-bold px-2.5 py-1 gap-1"><Star className="w-3 h-3 fill-current" />{e.rating}/10</span>
              )}
              {mine && (
                <span className="flex items-center gap-1">
                  <button type="button" onClick={onEdit} className="p-1.5 rounded-full" style={{ color: 'var(--color-text-muted)' }} aria-label="Edit your review"><Pencil className="w-4 h-4" /></button>
                  <button type="button" onClick={onDelete} className="p-1.5 rounded-full" style={{ color: 'var(--color-text-muted)' }} aria-label="Delete your review"><Trash2 className="w-4 h-4" /></button>
                </span>
              )}
            </div>
            {e.review_text && <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'var(--color-text)' }}>{sanitizeUserText(e.review_text, 1200)}</p>}
            {e.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {e.tags.map((t) => <span key={t} className="tag">{sanitizeUserText(t, 80)}</span>)}
              </div>
            )}

            <div className="flex items-center gap-1 mt-3">
              <button type="button" className="comment-action" onClick={() => startReply(e.id, null)}><CornerDownRight className="w-3.5 h-3.5" /> Reply</button>
              {thread.length > 0 && (
                <button type="button" className="comment-action" onClick={() => toggle(e.id)} aria-expanded={expanded}>
                  <MessageCircle className="w-3.5 h-3.5" /> {expanded ? 'Hide' : 'View'} {thread.length} {thread.length === 1 ? 'reply' : 'replies'}
                </button>
              )}
            </div>

            {(expanded || composing) && (
              <div className="nl-reply-thread animate-fade-in">
                {expanded && roots.map((r) => renderReply(r, 0))}
                {composing && (
                  <form onSubmit={submit} className="nl-reply-form">
                    <textarea autoFocus value={text} onChange={(ev) => setText(ev.target.value)} maxLength={600} rows={2} placeholder="Write a reply…" className="input-field text-sm" style={{ resize: 'vertical' }} />
                    <div className="flex items-center justify-between gap-2 mt-2">
                      <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{text.length}/600</span>
                      <div className="flex items-center gap-2">
                        <button type="button" className="comment-action" onClick={() => { setComposer(null); setText(''); }}>Cancel</button>
                        <button disabled={!text.trim() || saving} className="btn-primary text-xs" style={{ padding: '7px 16px' }}>
                          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Reply
                        </button>
                      </div>
                    </div>
                    {error && <p className="text-xs mt-2" style={{ color: '#ef4444' }}>{error}</p>}
                  </form>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
