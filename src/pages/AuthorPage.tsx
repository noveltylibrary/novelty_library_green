import { useMemo } from 'react';
import { ArrowLeft, BookOpen, UserRound } from 'lucide-react';
import { authorKey, reviewPath, usePublished } from '@/lib/readerTools';
import { VerdictBanner } from '@/components/VerdictBanner';
import { sanitizeUserText } from '@/lib/sanitize';
import { FollowButton } from '@/components/FollowButton';
import { useFollowedAuthors } from '@/lib/followAuthors';

export function AuthorPage({ name, navigate }: { name: string; navigate: (path: string) => void }) {
  const all = usePublished();
  const followed = useFollowedAuthors();
  const key = authorKey(name);
  const books = useMemo(() => all.filter((r) => authorKey(r.author || '') === key).sort((a, b) => (b.rw_rating || 0) - (a.rw_rating || 0)), [all, key]);
  const display = books[0]?.author || name;
  const avg = books.length ? books.reduce((n, r) => n + (Number.isFinite(r.rw_rating) ? r.rw_rating : 0), 0) / books.length : 0;
  const genres = useMemo(() => [...new Set(books.map((b) => (b.genre || '').trim()).filter(Boolean))].slice(0, 4), [books]);

  return (
    <div className="pt-24 pb-20 container-prose animate-fade-in">
      <button type="button" onClick={() => { if (window.history.length > 1) window.history.back(); else navigate('/reviews'); }} className="nl-qv-link inline-flex items-center gap-1.5 mb-6"><ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back</button>
      <header className="nl-author-head">
        <span className="nl-author-icon"><UserRound aria-hidden="true" /></span>
        <div>
          <span className="nl-live-kicker">AUTHOR</span>
          <h1 className="font-serif text-3xl md:text-4xl font-semibold" style={{ color: 'var(--color-text)' }}>{sanitizeUserText(display, 120)}</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {books.length ? `${books.length} review${books.length === 1 ? '' : 's'} on Novelty Library · average R/W ${avg.toFixed(1)}/10${genres.length ? ` · ${genres.join(', ')}` : ''}` : 'Loading reviews…'}
          </p>
        </div>
        <div className="nl-author-follow"><FollowButton following={followed.isFollowing(key)} onClick={() => followed.toggle(key)} label={sanitizeUserText(display, 60)} /></div>
      </header>
      {all.length > 0 && books.length === 0 && <p className="nl-find-hint">No published reviews of this author yet.</p>}
      <ul className="nl-find-list">
        {books.map((r) => {
          const cover = r.poster_url || r.cover_image_url;
          return (
            <li key={r.id} className="nl-find-result">
              <button type="button" className="nl-find-result-main" onClick={() => navigate(reviewPath(r))} aria-label={`Open review of ${r.title}`}>
                <span className="nl-find-cover">{cover ? <img src={cover} alt="" loading="lazy" /> : <BookOpen aria-hidden="true" />}</span>
                <span className="nl-find-copy">
                  <strong>{sanitizeUserText(r.title, 120)}</strong>
                  <small>{sanitizeUserText(r.genre, 40)}{r.language ? ` · ${sanitizeUserText(r.language, 30)}` : ''}</small>
                  {r.verdict && <span className="nl-find-why"><VerdictBanner verdict={r.verdict} size="compact" /></span>}
                </span>
              </button>
              <span className="nl-find-score"><b>{Number.isFinite(r.rw_rating) ? r.rw_rating.toFixed(1) : '—'}</b><small>R/W</small></span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
