import { useEffect, useState } from 'react';
import { ArrowLeft, Home, LoaderCircle } from 'lucide-react';
import { TasteMatchPanel, type FinderBook } from '@/components/RankingFinder';
import { TasteMatchEmblem } from '@/components/TasteMatchIcon';
import { fetchReviews } from '@/lib/reviews';
import { supabase } from '@/lib/supabase';
import { computeNlRating, type EngagementStats } from '@/lib/engagement';
import type { Review } from '@/types/review';

type ReaderRatingRow = { review_id: string; rating: number | null };

const emptyStats: EngagementStats = { likeCount: 0, ratingCount: 0, ratingSum: 0, reviewCount: 0 };

/** Fetches only published reviews and calculates NL scores exactly as the Live Rankings page does. */
async function loadTasteMatchBooks(): Promise<FinderBook[]> {
  const published = await fetchReviews();
  if (published.length === 0) return [];
  const totals: Record<string, { count: number; sum: number }> = {};
  const ids = published.map((review) => review.id);
  try {
    const { data, error } = await supabase
      .from('community_review_feedback')
      .select('review_id,rating')
      .in('review_id', ids);
    if (error) throw error;
    for (const row of (data ?? []) as ReaderRatingRow[]) {
      const rating = row.rating == null ? null : Number(row.rating);
      if (rating == null || !Number.isFinite(rating)) continue;
      const current = totals[row.review_id] ?? { count: 0, sum: 0 };
      current.count += 1;
      current.sum += rating;
      totals[row.review_id] = current;
    }
  } catch {
    // If optional community ratings are unavailable, recommendations continue using published-review data.
  }
  return published.map((review: Review) => {
    const total = totals[review.id];
    const stats = total ? { ...emptyStats, ratingCount: total.count, ratingSum: total.sum } : emptyStats;
    return { review, nlRating: computeNlRating(review.rw_rating, stats) };
  });
}

function bookSlug(review: Review): string {
  return review.slug || `${review.title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')}-${review.master_review_no ?? review.review_number ?? ''}`;
}

export function TasteMatchPage({ navigate }: { navigate: (path: string) => void }) {
  const [books, setBooks] = useState<FinderBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    loadTasteMatchBooks()
      .then((rows) => { if (alive) setBooks(rows); })
      .catch(() => { if (alive) setFailed(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  return (
    <div className="nl-taste-page container-wide pt-24 pb-20 animate-fade-in">
      <div className="nl-taste-page-inner">
        <div className="nl-taste-page-nav">
          <button type="button" onClick={() => navigate('/live-rankings')} className="nl-live-back"><ArrowLeft size={16} aria-hidden="true" /> Back to Live Rankings</button>
          <button type="button" onClick={() => navigate('/')} className="nl-live-back nl-taste-home"><Home size={16} aria-hidden="true" /> Home</button>
        </div>
        <header className="nl-taste-page-hero">
          <span className="nl-taste-page-logo"><TasteMatchEmblem /></span>
          <div>
            <span className="nl-live-kicker">NOVELTY LIBRARY · PERSONAL DISCOVERY</span>
            <h1>Taste Match SE</h1>
            <p>Not just what is highly rated — find what fits <em>your</em> taste. Describe the read you crave, choose a mood, or start from a book you loved.</p>
          </div>
        </header>
        {loading && <div className="nl-live-loading"><LoaderCircle size={20} className="nl-live-spin" /> Finding the published library…</div>}
        {!loading && failed && <div className="nl-live-state"><strong>Taste Match couldn't load the library.</strong><span>Please try again in a moment.</span><button type="button" onClick={() => window.location.reload()}>Retry</button></div>}
        {!loading && !failed && books.length === 0 && <div className="nl-live-state"><strong>No published reviews are available yet.</strong><span>Taste Match will recommend books as reviews enter the public library.</span></div>}
        {!loading && !failed && books.length > 0 && <TasteMatchPanel books={books} openBook={(review) => navigate(`/review/${encodeURIComponent(bookSlug(review))}`)} />}
      </div>
    </div>
  );
}
