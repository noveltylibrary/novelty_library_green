import { useEffect, useState } from 'react';
import { Loader2, Star, X } from 'lucide-react';
import type { FeedbackEntry, FeedbackInput } from '@/lib/engagement';

interface FeedbackModalProps {
  open: boolean;
  reviewTitle: string;
  existing: FeedbackEntry | null;
  onClose: () => void;
  onSubmit: (input: FeedbackInput) => Promise<void>;
}

const MAX_TAGS = 5;
const MAX_TAG_LEN = 24;
const MAX_TEXT = 1500;

/** Simple popup with exactly three things: rating (1-10 stars), review, tags. */
export function FeedbackModal({ open, reviewTitle, existing, onClose, onSubmit }: FeedbackModalProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setRating(existing?.rating ?? null);
    setText(existing?.review_text ?? '');
    setTags(existing?.tags ?? []);
    setTagDraft('');
    setError(null);
    setHover(null);
  }, [open, existing]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const addTag = (raw: string) => {
    const t = raw.trim().replace(/^#/, '').slice(0, MAX_TAG_LEN);
    if (!t || tags.some((x) => x.toLowerCase() === t.toLowerCase()) || tags.length >= MAX_TAGS) return;
    setTags([...tags, t]);
  };

  const submit = async () => {
    const pending = tagDraft.trim();
    const finalTags = pending && tags.length < MAX_TAGS && !tags.some((x) => x.toLowerCase() === pending.toLowerCase()) ? [...tags, pending.replace(/^#/, '').slice(0, MAX_TAG_LEN)] : tags;
    if (rating === null && !text.trim()) { setError('Add a rating or write a short review.'); return; }
    setBusy(true); setError(null);
    try {
      await onSubmit({ rating, reviewText: text, tags: finalTags });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
    } finally { setBusy(false); }
  };

  const shown = hover ?? rating ?? 0;

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Rate and review" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" />
      <div className="relative w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto animate-fade-up" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] font-semibold mb-1" style={{ color: 'var(--color-teal-dark)' }}>{existing ? 'Edit your review' : 'Your review'}</p>
            <h3 className="font-serif text-xl font-semibold leading-snug truncate" style={{ color: 'var(--color-text)' }} title={reviewTitle}>{reviewTitle}</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-full" style={{ color: 'var(--color-text-muted)' }} aria-label="Close"><X className="w-5 h-5" /></button>
        </div>

        {/* 1. Rating */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>Rating</label>
            <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--color-teal-dark)' }}>{shown ? `${shown}/10` : '—'}</span>
          </div>
          <div className="flex flex-wrap gap-0.5" onMouseLeave={() => setHover(null)}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" onMouseEnter={() => setHover(n)} onClick={() => setRating(rating === n ? null : n)} className="p-0.5 transition-transform hover:scale-110" aria-label={`${n} out of 10`}>
                <Star className="w-[26px] h-[26px]" style={{ color: 'var(--tag-bg)' }} fill={n <= shown ? 'currentColor' : 'none'} />
              </button>
            ))}
          </div>
        </div>

        {/* 2. Review */}
        <div className="mb-5">
          <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-muted)' }} htmlFor="nl-feedback-text">Review</label>
          <textarea id="nl-feedback-text" value={text} onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT))} rows={4} placeholder="What did you think of this review or the book?" className="input-field resize-none" />
          <p className="text-[11px] text-right mt-1" style={{ color: 'var(--color-text-muted)' }}>{text.length}/{MAX_TEXT}</p>
        </div>

        {/* 3. Tags */}
        <div className="mb-5">
          <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-muted)' }} htmlFor="nl-feedback-tags">Tags</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {tags.map((t) => (
              <span key={t} className="nl-chip text-xs px-3 py-1 gap-1.5">{t}<button type="button" onClick={() => setTags(tags.filter((x) => x !== t))} aria-label={`Remove ${t}`}><X className="w-3 h-3" /></button></span>
            ))}
          </div>
          <input id="nl-feedback-tags" value={tagDraft} onChange={(e) => setTagDraft(e.target.value)} disabled={tags.length >= MAX_TAGS}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagDraft); setTagDraft(''); } }}
            onBlur={() => { if (tagDraft.trim()) { addTag(tagDraft); setTagDraft(''); } }}
            placeholder={tags.length >= MAX_TAGS ? `Max ${MAX_TAGS} tags` : 'Type a tag and press Enter'} className="input-field" />
        </div>

        {error && <p className="text-sm mb-3" style={{ color: '#ef4444' }}>{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost text-sm">Cancel</button>
          <button type="button" onClick={() => void submit()} disabled={busy} className="btn-primary text-sm">{busy && <Loader2 className="w-4 h-4 animate-spin" />}{existing ? 'Update' : 'Post'}</button>
        </div>
      </div>
    </div>
  );
}
