import { useMemo } from 'react';
import { ArrowLeft, ArrowRight, UserRound } from 'lucide-react';
import type { Review } from '@/types/review';
import { authorKey, authorPath, reviewPath, usePublished } from '@/lib/readerTools';
import { sanitizeUserText } from '@/lib/sanitize';

const byNewest = (a: Review, b: Review) => (b.published_at || '').localeCompare(a.published_at || '');

/** Review page: previous / next review in the same genre, and a way into the author's page. */
export function ReadNext({ current, navigate }: { current: Review; navigate: (path: string) => void }) {
  const all = usePublished();
  const { prev, next, authorCount } = useMemo(() => {
    const genre = (current.genre || '').trim().toLowerCase();
    const sameGenre = genre ? all.filter((r) => (r.genre || '').trim().toLowerCase() === genre).sort(byNewest) : [];
    const i = sameGenre.findIndex((r) => r.id === current.id);
    const hasRing = i >= 0 && sameGenre.length > 1;
    const ak = authorKey(current.author || '');
    return {
      prev: hasRing ? sameGenre[(i + 1) % sameGenre.length] : null,
      next: hasRing ? sameGenre[(i - 1 + sameGenre.length) % sameGenre.length] : null,
      authorCount: ak ? all.filter((r) => authorKey(r.author || '') === ak).length : 0,
    };
  }, [all, current]);

  if (!prev && !next && authorCount < 2) return null;
  return (
    <nav className="nl-readnext" aria-label="Read next">
      <h2 className="font-serif text-xl font-semibold" style={{ color: 'var(--color-text)' }}>Read next{current.genre ? ` in ${sanitizeUserText(current.genre, 40)}` : ''}</h2>
      <div className="nl-readnext-row">
        {prev && prev.id !== next?.id && <button type="button" onClick={() => navigate(reviewPath(prev))}><ArrowLeft aria-hidden="true" /><span><small>Older</small><b>{sanitizeUserText(prev.title, 70)}</b></span></button>}
        {next && <button type="button" className="is-next" onClick={() => navigate(reviewPath(next))}><span><small>Newer</small><b>{sanitizeUserText(next.title, 70)}</b></span><ArrowRight aria-hidden="true" /></button>}
      </div>
      {authorCount >= 2 && (
        <button type="button" className="nl-readnext-author" onClick={() => navigate(authorPath(current.author))}>
          <UserRound aria-hidden="true" /> All {authorCount} reviews of {sanitizeUserText(current.author, 60)} <ArrowRight aria-hidden="true" />
        </button>
      )}
    </nav>
  );
}
