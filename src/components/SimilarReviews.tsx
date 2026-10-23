import { useEffect, useMemo, useState } from 'react';
import { CoverImg } from '@/components/CoverImg';
import { BookOpen } from 'lucide-react';
import type { Review } from '@/types/review';
import { usePublished, reviewSlug as slugOf } from '@/lib/readerTools';
import { cleanTraits, type SearchBook } from '@/lib/rankingSearch';
import { rankTmai40 } from '@/lib/tmai40Engine';
import { supabase } from '@/lib/supabase';
import { computeNlRating, EMPTY_STATS } from '@/lib/engagement';

type ReaderRatingRow = { review_id: string; rating: number | null };
type RatingTotal = { count: number; sum: number };

const toBook = (r: Review): SearchBook => ({
  id: r.id, title: r.title || '', author: r.author || '', genre: r.genre || '', language: r.language || '', traits: cleanTraits(r.traits),
  verdict: r.verdict || '', text: (r.review_text || '').slice(0, 4000), nl: null, rw: Number.isFinite(r.rw_rating) ? r.rw_rating : 0,
});

/** "More like this": same preference-aware TMAI-40 engine as Taste Match, with NL community scores. */
export function SimilarReviews({ current, navigate }: { current: Review; navigate: (path: string) => void }) {
  const all = usePublished();
  const [ratingTotals, setRatingTotals] = useState<Record<string, RatingTotal>>({});
  const [ratingsReady, setRatingsReady] = useState(false);

  const picks = useMemo(() => {
    if (all.length < 2) return [];
    const list = all.some((r) => r.id === current.id) ? all : [...all, current];
    const byId = new Map(list.map((r) => [r.id, r]));
    return rankTmai40(list.map(toBook), { lovedId: current.id }, 3)
      .map((m) => ({ match: m, review: byId.get(m.book.id)! }))
      .filter((x) => x.review);
  }, [all, current]);

  useEffect(() => {
    let alive = true;
    const ids = [...new Set(picks.map(({ review }) => review.id))];
    setRatingsReady(false);
    if (!ids.length) { setRatingTotals({}); setRatingsReady(true); return () => { alive = false; }; }
    void (async () => {
      const { data, error } = await supabase
        .from('community_review_feedback')
        .select('review_id,rating')
        .in('review_id', ids);
      if (error) throw error;
      const totals: Record<string, RatingTotal> = {};
      for (const row of (data ?? []) as ReaderRatingRow[]) {
        const rating = row.rating == null ? null : Number(row.rating);
        if (rating == null || !Number.isFinite(rating)) continue;
        const total = totals[row.review_id] ?? { count: 0, sum: 0 };
        total.count += 1;
        total.sum += rating;
        totals[row.review_id] = total;
      }
      if (alive) { setRatingTotals(totals); setRatingsReady(true); }
    })().catch(() => { if (alive) { setRatingTotals({}); setRatingsReady(false); } });
    return () => { alive = false; };
  }, [picks]);

  if (!picks.length) return null;
  return (
    <section className="nl-similar" aria-labelledby="nl-similar-title">
      <h2 id="nl-similar-title" className="font-serif text-xl font-semibold" style={{ color: 'var(--color-text)' }}><BookOpen className="inline w-5 h-5 mr-1.5 -mt-1" style={{ color: 'var(--color-teal-dark)' }} aria-hidden="true" />More like this</h2>
      <ul className="nl-find-list">
        {picks.map(({ match, review }) => {
          const cover = review.poster_url || review.cover_image_url;
          const total = ratingTotals[review.id];
          const nlRating = ratingsReady ? computeNlRating(review.rw_rating, total ? { ...EMPTY_STATS, ratingCount: total.count, ratingSum: total.sum } : EMPTY_STATS) : null;
          return (
            <li key={review.id} className="nl-find-result">
              <button type="button" className="nl-find-result-main" onClick={() => navigate(`/review/${encodeURIComponent(slugOf(review))}`)} aria-label={`Open review of ${review.title}`}>
                <span className="nl-find-cover"><CoverImg src={cover} /></span>
                <span className="nl-find-copy">
                  <strong>{review.title}</strong>
                  <small>{review.author || 'Author unavailable'}</small>
                  <span className="nl-find-why"><i className="nl-find-pct">{Math.round(match.score)}% similar</i>{match.reasons.map((r) => <i key={r}>{r}</i>)}</span>
                </span>
              </button>
              <span className="nl-find-score" aria-label={`NL rating ${nlRating == null ? 'not available' : nlRating.toFixed(1)}`}><b>{nlRating == null ? '—' : nlRating.toFixed(1)}</b><small>NL</small></span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
