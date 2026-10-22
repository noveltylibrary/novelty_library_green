import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, BarChart3, BookOpen, ChevronRight, HelpCircle, Home, LoaderCircle, Trophy, X } from 'lucide-react';
import { useOverlayHistory } from '@/lib/overlayHistory';
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
  const [aboutOpen, setAboutOpen] = useState(false);
  useOverlayHistory(aboutOpen, () => setAboutOpen(false));
  useEffect(() => {
    if (!aboutOpen) return;
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAboutOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [aboutOpen]);

  const facts = useMemo(() => {
    const uniq = (values: string[]) => new Set(values.map((v) => v.trim().toLowerCase()).filter(Boolean)).size;
    return {
      books: books.length,
      authors: uniq(books.map((b) => b.review.author || '')),
      languages: uniq(books.map((b) => b.review.language || '')),
      genres: uniq(books.map((b) => (b.review.genre || '').split(/[,/&]/)[0] || '')),
    };
  }, [books]);

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
            <div className="nl-reviews-actions nl-taste-hero-actions" role="group" aria-label="Library shortcuts">
              <button type="button" className="nl-action-btn" onClick={() => navigate('/reviews')}><BookOpen aria-hidden="true" /><span>Reviews</span></button>
              <button type="button" className="nl-action-btn" onClick={() => navigate('/analytics')}><BarChart3 aria-hidden="true" /><span>Analytics</span></button>
              <button type="button" className="nl-action-btn" onClick={() => navigate('/live-rankings')}><Trophy aria-hidden="true" /><span>Rankings</span></button>
            </div>
          </div>
        </header>
        <button type="button" className="nl-taste-field" onClick={() => setAboutOpen(true)} aria-haspopup="dialog">
          <span className="nl-taste-field-ico"><HelpCircle size={20} aria-hidden="true" /></span>
          <span className="nl-taste-field-txt"><strong>What is Taste Match SE?</strong><small>Meet your literary matchmaker</small></span>
          <ChevronRight className="nl-taste-field-arrow" aria-hidden="true" />
        </button>
        {aboutOpen && createPortal(
          <div className="nl-taste-pop" onClick={() => setAboutOpen(false)}>
            <div className="nl-taste-pop-card" role="dialog" aria-modal="true" aria-labelledby="nl-taste-what" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="nl-taste-pop-x" onClick={() => setAboutOpen(false)} aria-label="Close"><X size={18} aria-hidden="true" /></button>
              <section className="nl-taste-about" aria-labelledby="nl-taste-what">
          <h2 id="nl-taste-what">What is Taste Match SE?</h2>
          <p className="nl-taste-about-lede">Meet your literary matchmaker.</p>
          <p>Finding your next great read shouldn&rsquo;t feel like searching for a needle in a digital haystack.</p>
          <p>Most recommendation engines lean on generic charts, sponsored lists and whatever the crowd happens to be buying. Taste Match SE is built differently. It looks past the hype and listens for the rhythm, tone and depth of the books you actually love &mdash; drawing only on reviews written by real readers of Novelty Library.</p>
          <p>Whether you&rsquo;re hunting for a mind-bending indie sci-fi novel, a gripping contemporary critique or a quiet literary gem, tell it the mood you&rsquo;re in or a book you loved, and it cuts through the noise to stories that fit your wavelength.</p>
          <p className="nl-taste-about-close">No sponsored lists. No ad-driven picks. Just pure discovery.</p>
          {facts.books > 0 && <ul className="nl-taste-about-facts" aria-label="What Taste Match SE searches">
            <li><b>{facts.books}</b> reviewed books</li>
            {facts.authors > 0 && <li><b>{facts.authors}</b> authors</li>}
            {facts.genres > 0 && <li><b>{facts.genres}</b> genres</li>}
            {facts.languages > 0 && <li><b>{facts.languages}</b> {facts.languages === 1 ? 'language' : 'languages'}</li>}
          </ul>}
        </section>
            </div>
          </div>, document.body)}
        {loading && <div className="nl-live-loading"><LoaderCircle size={20} className="nl-live-spin" /> Finding the published library…</div>}
        {!loading && failed && <div className="nl-live-state"><strong>Taste Match SE couldn't load the library.</strong><span>Please try again in a moment.</span><button type="button" onClick={() => window.location.reload()}>Retry</button></div>}
        {!loading && !failed && books.length === 0 && <div className="nl-live-state"><strong>No published reviews are available yet.</strong><span>Taste Match SE will recommend books as reviews enter the public library.</span></div>}
        {!loading && !failed && books.length > 0 && <TasteMatchPanel books={books} openBook={(review) => navigate(`/review/${encodeURIComponent(bookSlug(review))}`)} />}
      </div>
    </div>
  );
}
