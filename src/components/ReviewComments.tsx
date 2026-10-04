import { useEffect, useMemo, useState } from 'react';
import { Loader2, MessageCircle, Send, Trash2, Heart, CornerDownRight } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { addReviewComment, deleteReviewComment, fetchReviewComments, toggleCommentLike, type ReviewComment } from '@/lib/communityComments';
import { sanitizeUserText } from '@/lib/sanitize';

interface Props { reviewId: string; navigate: (path: string) => void; }

export function ReviewComments({ reviewId, navigate }: Props) {
  const { user, profile } = useAuth();
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetchReviewComments(reviewId, user?.id).then(setComments).catch(() => setComments([])).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [reviewId, user?.id]);

  const children = useMemo(() => {
    const map = new Map<string, ReviewComment[]>();
    for (const comment of comments) {
      if (!comment.parent_id) continue;
      const list = map.get(comment.parent_id) ?? [];
      list.push(comment); map.set(comment.parent_id, list);
    }
    return map;
  }, [comments]);

  const roots = comments.filter((c) => !c.parent_id);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) { navigate('/auth'); return; }
    setSaving(true); setError(null);
    try {
      await addReviewComment(user, profile, reviewId, text, replyTo);
      setText(''); setReplyTo(null); load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not post comment.'); }
    finally { setSaving(false); }
  };

  const like = async (comment: ReviewComment) => {
    if (!user) { navigate('/auth'); return; }
    try {
      await toggleCommentLike(user, comment.id, comment.liked_by_me);
      setComments((prev) => prev.map((c) => c.id === comment.id ? { ...c, liked_by_me: !c.liked_by_me, like_count: c.like_count + (c.liked_by_me ? -1 : 1) } : c));
    } catch { /* keep optimistic state unchanged */ }
  };

  const remove = async (comment: ReviewComment) => {
    if (!user) return;
    try { await deleteReviewComment(user, comment.id); setComments((prev) => prev.filter((c) => c.id !== comment.id && c.parent_id !== comment.id)); } catch { /* keep visible */ }
  };

  const renderComment = (comment: ReviewComment, depth = 0) => (
    <article key={comment.id} className={`rounded-2xl p-4 ${depth ? 'ml-5 md:ml-10' : ''}`} style={{ background: 'var(--color-paper)', border: '1px solid var(--color-border)' }}>
      <div className="flex items-center gap-3">
        <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: 'rgba(0,151,178,.12)', color: 'var(--color-cyan-dark)' }}>{comment.user_name.charAt(0).toUpperCase()}</span>
        <div className="flex-1 min-w-0"><p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{sanitizeUserText(comment.user_name, 60)}</p><p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{new Date(comment.created_at).toLocaleString()}</p></div>
      </div>
      <p className="text-sm leading-6 mt-3 whitespace-pre-wrap" style={{ color: 'var(--color-text)' }}>{sanitizeUserText(comment.comment_text, 800)}</p>
      <div className="flex items-center gap-1.5 mt-3">
        <button type="button" onClick={() => void like(comment)} className={`comment-action ${comment.liked_by_me ? 'is-on' : ''}`}><Heart className="w-3.5 h-3.5" fill={comment.liked_by_me ? 'currentColor' : 'none'} /> {comment.like_count}</button>
        {depth < 2 && <button type="button" onClick={() => { setReplyTo(comment.id); setText(`@${sanitizeUserText(comment.user_name, 60)} `); window.setTimeout(() => document.getElementById('review-comment-box')?.focus(), 0); }} className="comment-action"><CornerDownRight className="w-3.5 h-3.5" /> Reply</button>}
        {user?.id === comment.user_id && <button type="button" onClick={() => void remove(comment)} className="comment-action"><Trash2 className="w-3.5 h-3.5" /> Delete</button>}
      </div>
      {(children.get(comment.id) ?? []).map((child) => renderComment(child, depth + 1))}
    </article>
  );

  return <section className="mt-8 pt-6" style={{ borderTop: '1px solid var(--color-border)' }}>
    <div className="flex items-center gap-2 mb-4"><MessageCircle className="w-4 h-4" style={{ color: 'var(--color-cyan-dark)' }} /><h2 className="font-serif text-xl font-semibold" style={{ color: 'var(--color-text)' }}>Community comments ({comments.length})</h2></div>
    <form onSubmit={submit} className="mb-5">
      {replyTo && <div className="flex items-center justify-between gap-3 mb-2 text-xs" style={{ color: 'var(--color-cyan-dark)' }}><span>Replying to a comment</span><button type="button" onClick={() => { setReplyTo(null); setText(''); }} className="underline">Cancel</button></div>}
      <textarea id="review-comment-box" value={text} onChange={(e) => setText(e.target.value)} maxLength={800} rows={3} placeholder={user ? (replyTo ? 'Write your reply…' : 'Add a thoughtful comment…') : 'Sign in to comment on this review.'} disabled={!user || saving} className="input-field resize-y" />
      <div className="flex items-center justify-between gap-3 mt-2"><span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{text.length}/800</span><button disabled={!user || !text.trim() || saving} className="btn-primary text-sm disabled:opacity-40">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} {user ? (replyTo ? 'Post reply' : 'Post comment') : 'Sign in to comment'}</button></div>
      {error && <p className="text-xs mt-2" style={{ color: '#ef4444' }}>{error}</p>}
    </form>
    {loading ? <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--color-cyan-dark)' }} /> : roots.length === 0 ? <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No comments yet. Start the conversation.</p> : <div className="space-y-3">{roots.map((comment) => renderComment(comment))}</div>}
  </section>;
}
