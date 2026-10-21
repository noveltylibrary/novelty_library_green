import { useMemo } from 'react';
import { CoverImg } from '@/components/CoverImg';
import { ArrowLeft, BookOpen, Bookmark, Trash2 } from 'lucide-react';
import { reviewPath, usePublished, useSavedReviews } from '@/lib/readerTools';
import { sanitizeUserText } from '@/lib/sanitize';

/** "My list": reviews saved with Save for later. Stored only in this browser. */
export function SavedPage({ navigate }: { navigate: (path: string) => void }) {
  const all = usePublished();
  const { ids, toggle } = useSavedReviews();
  const items = useMemo(() => ids.map((id) => all.find((r) => r.id === id)).filter((r): r is NonNullable<typeof r> => !!r), [ids, all]);
  return (
    <div className="pt-24 pb-20 container-prose animate-fade-in">
      <button type="button" onClick={() => navigate('/reviews')} className="nl-qv-link inline-flex items-center gap-1.5 mb-6"><ArrowLeft className="w-4 h-4" aria-hidden="true" /> Reviews</button>
      <header className="nl-author-head">
        <span className="nl-author-icon"><Bookmark aria-hidden="true" /></span>
        <div>
          <span className="nl-live-kicker">SAVED FOR LATER</span>
          <h1 className="font-serif text-3xl md:text-4xl font-semibold" style={{ color: 'var(--color-text)' }}>My list</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>Kept on this device only. Tap the bookmark on any review to add it here.</p>
        </div>
      </header>
      {ids.length === 0 && <p className="nl-find-hint">Nothing saved yet.</p>}
      <ul className="nl-find-list">
        {items.map((r) => {
          const cover = r.poster_url || r.cover_image_url;
          return (
            <li key={r.id} className="nl-find-result">
              <button type="button" className="nl-find-result-main" onClick={() => navigate(reviewPath(r))} aria-label={`Open review of ${r.title}`}>
                <span className="nl-find-cover"><CoverImg src={cover} /></span>
                <span className="nl-find-copy"><strong>{sanitizeUserText(r.title, 120)}</strong><small>{sanitizeUserText(r.author, 80)}</small></span>
              </button>
              <button type="button" className="nl-shelf-x" onClick={() => toggle(r.id)} aria-label={`Remove ${r.title} from my list`}><Trash2 className="w-4 h-4" /></button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
