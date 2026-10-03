import { Pencil, Star, Trash2 } from 'lucide-react';
import { formatShortDate } from '@/lib/format';
import type { FeedbackEntry } from '@/lib/engagement';

interface FeedbackListProps {
  entries: FeedbackEntry[];
  currentUserId?: string;
  onEdit: () => void;
  onDelete: () => void;
}

/** Reader reviews shown under a post on the single-post page. */
export function FeedbackList({ entries, currentUserId, onEdit, onDelete }: FeedbackListProps) {
  if (entries.length === 0) {
    return <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No reader reviews yet. Be the first to add one.</p>;
  }
  return (
    <ul className="space-y-3">
      {entries.map((e) => {
        const mine = e.user_id === currentUserId;
        return (
          <li key={e.id} className="surface-card p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 nl-chip">{(e.user_name || 'R').charAt(0).toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text)' }}>{e.user_name}{mine && <span className="ml-1.5 text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-teal-dark)' }}>You</span>}</p>
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
            {e.review_text && <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'var(--color-text)' }}>{e.review_text}</p>}
            {e.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {e.tags.map((t) => <span key={t} className="tag">{t}</span>)}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
