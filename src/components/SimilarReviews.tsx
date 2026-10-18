import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Sparkles } from 'lucide-react';
import type { Review } from '@/types/review';
import { fetchReviews } from '@/lib/reviews';
import { cleanTraits, similarBooks, type SearchBook } from '@/lib/rankingSearch';

let listPromise: Promise<Review[]> | null = null;
let listAt = 0;
/** One shared fetch of the published reviews (re-used across review pages for a few minutes). */
function loadPublished(): Promise<Review[]> {
  if (!listPromise || Date.now() - listAt > 5 * 60_000) { listAt = Date.now(); listPromise = fetchReviews().catch((e) => { listPromise = null; throw e; }); }
  return listPromise;
}

const slugOf = (r: Review): string => r.slug || `${r.title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')}-${r.master_review_no ?? r.review_number ?? ''}`;

const toBook = (r: Review): SearchBook => ({
  id: r.id, title: r.title || '', author: r.author || '', genre: r.genre || '', language: r.language || '', traits: cleanTraits(r.traits),
  verdict: r.verdict || '', text: (r.review_text || '').slice(0, 4000), nl: null, rw: Number.isFinite(r.rw_rating) ? r.rw_rating : 0,
});

/** "More like this": the 3 published reviews most similar to the one being read (TF-IDF + cosine similarity). */
export function SimilarReviews({ current, navigate }: { current: Review; navigate: (path: string) => void }) {
  const [all, setAll] = useState<Review[]>([]);
  useEffect(() => {
    let alive = true;
    loadPublished().then((r) => { if (alive) setAll(r); }).catch(() => undefined);
    return () => { alive = false; };
  }, []);

  const picks = useMemo(() => {
    if (all.length < 2) return [];
    const list = all.some((r) => r.id === current.id) ? all : [...all, current];
    const byId = new Map(list.map((r) => [r.id, r]));
    return similarBooks(list.map(toBook), current.id, 3).map((m) => ({ match: m, review: byId.get(m.book.id)! })).filter((x) => x.review);
  }, [all, current]);

  if (!picks.length) return null;
  return (
    <section className="nl-similar" aria-labelledby="nl-similar-title">
      <h2 id="nl-similar-title" className="font-serif text-xl font-semibold" style={{ color: 'var(--color-text)' }}><Sparkles className="inline w-5 h-5 mr-1.5 -mt-1" style={{ color: 'var(--color-teal-dark)' }} aria-hidden="true" />More like this</h2>
      <ul className="nl-find-list">
        {picks.map(({ match, review }) => {
          const cover = review.poster_url || review.cover_image_url;
          return (
            <li key={review.id} className="nl-find-result">
              <button type="button" className="nl-find-result-main" onClick={() => navigate(`/review/${encodeURIComponent(slugOf(review))}`)} aria-label={`Open review of ${review.title}`}>
                <span className="nl-find-cover">{cover ? <img src={cover} alt="" loading="lazy" /> : <BookOpen aria-hidden="true" />}</span>
                <span className="nl-find-copy">
                  <strong>{review.title}</strong>
                  <small>{review.author || 'Author unavailable'}</small>
                  <span className="nl-find-why"><i className="nl-find-pct">{Math.round(match.score)}% similar</i>{match.reasons.map((r) => <i key={r}>{r}</i>)}</span>
                </span>
              </button>
              <span className="nl-find-score"><b>{Number.isFinite(review.rw_rating) ? review.rw_rating.toFixed(1) : '—'}</b><small>R/W</small></span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
