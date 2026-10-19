import { useEffect, useState } from 'react';
import { ArrowLeft, Home, LoaderCircle } from 'lucide-react';
import { TasteMatchPanel, type FinderBook } from '@/components/RankingFinder';
import { fetchReviews } from '@/lib/reviews';
import { supabase } from '@/lib/supabase';
import { computeNlRating, type EngagementStats } from '@/lib/engagement';
import type { Review } from '@/types/review';

type ReaderRatingRow = { review_id: string; rating: number | null };

/** The colourful, playful mascot is deliberately exclusive to the Taste Match SE destination. */
function TasteMatchPageMascot() {
  return (
    <svg className="nl-taste-page-mascot" viewBox="0 0 112 112" role="img" aria-label="A playful brain mascot discovering a book">
      <defs>
        <linearGradient id="tmPageBrain" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#a8fbf4"/><stop offset="1" stopColor="#38c7d7"/></linearGradient>
        <linearGradient id="tmPageBook" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff3b5"/><stop offset="1" stopColor="#f4be54"/></linearGradient>
        <linearGradient id="tmPageLens" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#a9b8ff"/><stop offset="1" stopColor="#626ee7"/></linearGradient>
      </defs>
      <circle className="tm-mascot-disc" cx="56" cy="56" r="51" fill="#f0fdff" stroke="#07566a" strokeWidth="2.7"/>
      <circle className="tm-mascot-disc-inner" cx="56" cy="56" r="44" fill="#d8f7fb"/>
      <path className="tm-mascot-brain" d="M48 25c-5-6-15-3-16 5-8 1-11 10-6 16-4 7 0 15 7 17 0 8 9 12 16 7 2 3 8 3 11 0 7 5 16 1 16-7 7-3 10-11 5-18 4-8-2-16-9-16-2-8-11-10-17-4-2-3-5-3-7 0Z" fill="url(#tmPageBrain)" stroke="#07566a" strokeWidth="3" strokeLinejoin="round"/>
      <path className="tm-mascot-brain-fold" d="M55 28c-4 6-2 11 2 14-4 4-5 9-1 14-3 4-3 8 0 12" fill="none" stroke="#08798b" strokeWidth="2.6" strokeLinecap="round"/>
      <path className="tm-mascot-brain-folds" d="M39 38c4 0 7 3 6 7m-15 5c5-1 9 2 9 7m28-20c-4 0-6 3-5 7m16 5c-5-1-9 2-9 7" fill="none" stroke="#08798b" strokeWidth="2.3" strokeLinecap="round"/>
      <g className="tm-mascot-eyes"><ellipse cx="46" cy="49" rx="2.2" ry="3" fill="#073a4b"/><ellipse cx="64" cy="49" rx="2.2" ry="3" fill="#073a4b"/></g>
      <path className="tm-mascot-smile" d="M49 57q6 6 12 0" fill="none" stroke="#073a4b" strokeWidth="2.5" strokeLinecap="round"/>
      <path className="tm-mascot-book" d="M25 76q14-6 31 6 17-12 31-6v16q-15-6-31 5-16-11-31-5Z" fill="url(#tmPageBook)" stroke="#07566a" strokeWidth="2.8" strokeLinejoin="round"/>
      <path className="tm-mascot-book-lines" d="M56 82v15M32 81q9-2 17 3m14-1q8-5 17-3" fill="none" stroke="#b68120" strokeWidth="2.2" strokeLinecap="round"/>
      <g className="tm-mascot-lens" transform="rotate(-12 78 65)"><circle cx="78" cy="64" r="11.5" fill="url(#tmPageLens)" stroke="#fff" strokeWidth="3"/><circle cx="78" cy="64" r="8" fill="none" stroke="#eaf5ff" strokeWidth="1.6"/><path d="m86 72 8 8" stroke="#07566a" strokeWidth="5" strokeLinecap="round"/><path d="m86 72 8 8" stroke="#f1fbff" strokeWidth="2" strokeLinecap="round"/></g>
      <path className="tm-mascot-sparkle tm-mascot-sparkle-one" d="m20 29 2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5Z" fill="#f3bd4d" stroke="#07566a" strokeWidth="1.5" strokeLinejoin="round"/>
      <path className="tm-mascot-sparkle tm-mascot-sparkle-two" d="m89 20 1.8 4.2 4.2 1.8-4.2 1.8-1.8 4.2-1.8-4.2-4.2-1.8 4.2-1.8Z" fill="#f3bd4d" stroke="#07566a" strokeWidth="1.3" strokeLinejoin="round"/>
    </svg>
  );
}

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
          <span className="nl-taste-page-logo"><TasteMatchPageMascot /></span>
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
