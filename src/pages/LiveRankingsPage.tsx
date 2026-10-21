import { useEffect, useMemo, useState } from 'react';
import { CoverImg } from '@/components/CoverImg';
import { ArrowLeft, ArrowRight, Activity, BarChart3, BookOpen, ChevronLeft, ChevronRight, LoaderCircle, TrendingUp, Trophy } from 'lucide-react';
import { AdSenseAdSlot } from '@/components/AdSenseAdSlot';
import type { Review } from '@/types/review';
import { fetchReviews } from '@/lib/reviews';
import { supabase } from '@/lib/supabase';
import { computeNlRating, type EngagementStats } from '@/lib/engagement';
import { RwStarRating } from '@/components/RwStarRating';
import { RankingSearch } from '@/components/RankingFinder';
import { TasteMatchIcon } from '@/components/TasteMatchIcon';

type RankedBook = { review: Review; nlRating: number | null };
type ReaderRatingRow = { review_id: string; rating: number | null };

const emptyStats: EngagementStats = { likeCount: 0, ratingCount: 0, ratingSum: 0, reviewCount: 0 };
const sortTitle = (a: RankedBook, b: RankedBook) => a.review.title.localeCompare(b.review.title);

async function loadRankedBooks(): Promise<RankedBook[]> {
  // fetchReviews reads community_reviews with is_published=true: accepted or
  // queued records are deliberately not included in Live Rankings.
  const published = await fetchReviews();
  if (published.length === 0) return [];

  const totals: Record<string, { count: number; sum: number }> = {};
  const ids = published.map((review) => review.id);
  // Use source reader ratings, matching the NL calculation used on review cards.
  // If reader ratings are unavailable, continue with the reviewer R/W score only.
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
    // Public published reviews still rank by their reviewer's R/W score if the
    // optional community rating table is temporarily unavailable.
  }

  return published.map((review) => {
    const readerTotals = totals[review.id];
    const stats = readerTotals
      ? { ...emptyStats, ratingCount: readerTotals.count, ratingSum: readerTotals.sum }
      : emptyStats;
    return { review, nlRating: computeNlRating(review.rw_rating, stats) };
  });
}

function bookSlug(book: Review): string {
  return book.slug || `${book.title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')}-${book.master_review_no ?? book.review_number ?? ''}`;
}

function BookRankingRow({ item, rank, metric, navigate }: {
  item: RankedBook;
  rank: number;
  metric: 'nl' | 'rw' | 'genre';
  navigate: (path: string) => void;
}) {
  const { review, nlRating } = item;
  const cover = review.poster_url || review.cover_image_url;
  const reviewNumber = review.master_review_no ?? review.review_number;

  return (
    <li className="nl-live-row">
      <span className={`nl-live-rank${rank <= 3 ? ` is-top-${rank}` : ''}`} aria-label={`Rank ${rank}`}>{rank}</span>
      <button type="button" className="nl-live-book" onClick={() => navigate(`/review/${encodeURIComponent(bookSlug(review))}`)} aria-label={`Open review of ${review.title}`}>
        <span className="nl-live-cover">
          <CoverImg src={cover} />
        </span>
        <span className="nl-live-book-copy">
          <strong>{review.title}</strong>
          <small>{review.author || 'Author unavailable'}{reviewNumber != null ? ` · #${reviewNumber}` : ''}</small>
          {review.genre && <span className="nl-live-genre-chip">{genreLabel(genreKey(review.genre), [review.genre])}</span>}
        </span>
      </button>
      <span className="nl-live-rating" aria-label={metric === 'rw' ? `R/W ${review.rw_rating.toFixed(1)} out of 10` : `NL rating ${nlRating == null ? 'not available' : `${nlRating.toFixed(1)} out of 10`}`}>
        {metric === 'rw' ? (
          <>
            <RwStarRating value={review.rw_rating} size={16} />
            <b>{review.rw_rating.toFixed(1)}<small>/10</small></b>
          </>
        ) : (
          <>
            <span className="nl-live-nl-mark">NL</span>
            <b>{nlRating == null ? '—' : nlRating.toFixed(1)}<small>/10</small></b>
            {metric === 'genre' && <span className="nl-live-mini-rw"><RwStarRating value={review.rw_rating} size={12} /></span>}
          </>
        )}
      </span>
    </li>
  );
}

function genreKey(value: string | null | undefined): string {
  const normalized = String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

  // These labels describe the same shelf, so group them under one genre.
  if ([
    'psychological thriller',
    'psychological suspense thriller',
    'psychological suspense',
    'psych thriller',
  ].includes(normalized)) return 'psychological thriller';
  if ([
    'self',
    'self help',
    'self help non fiction',
    'self help nonfiction',
    'self improvement',
  ].includes(normalized)) return 'self help';

  // Keep other genres separate after case/punctuation normalization. In particular,
  // Historical Fiction and Historical Fantasy deliberately remain distinct.
  return normalized;
}

function genreLabel(key: string, variants: string[]): string {
  if (key === 'psychological thriller') return 'Psychological Thriller';
  if (key === 'self help') return 'Self-Help';
  return variants[0]?.trim().replace(/\s+/g, ' ') || key;
}

function RankingSection({
  id, kicker, title, description, books, metric, navigate, icon,
}: {
  id: string;
  kicker: string;
  title: string;
  description: string;
  books: RankedBook[];
  metric: 'nl' | 'rw' | 'genre';
  navigate: (path: string) => void;
  icon: 'trending' | 'trophy' | 'sparkles';
}) {
  const [page, setPage] = useState(0);
  const Icon = icon === 'trending' ? TrendingUp : icon === 'trophy' ? Trophy : BookOpen;
  const filteredBooks = books;
  const pageCount = Math.max(1, Math.ceil(filteredBooks.length / 5));
  const currentPage = Math.min(page, pageCount - 1);
  const firstIndex = currentPage * 5;
  const visibleBooks = filteredBooks.slice(firstIndex, firstIndex + 5);

  return (
    <section className="nl-live-section" aria-labelledby={`${id}-title`}>
      <header className="nl-live-section-head">
        <span className="nl-live-section-icon"><Icon size={18} aria-hidden="true" /></span>
        <div>
          <span className="nl-live-kicker">{kicker}</span>
          <h2 id={`${id}-title`}>{title}</h2>
          <p>{description}</p>
        </div>
      </header>

      {filteredBooks.length === 0 ? (
        <p className="nl-live-empty">No published books are available for this ranking yet.</p>
      ) : (
        <>
          <ol className="nl-live-list">
            {visibleBooks.map((item, index) => (
              <BookRankingRow key={item.review.id} item={item} rank={firstIndex + index + 1} metric={metric} navigate={navigate} />
            ))}
          </ol>
          <nav className="nl-live-pagination" aria-label={`${title} pages`}>
            <button type="button" className="nl-live-page-button" onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={currentPage === 0}>
              <ChevronLeft size={16} aria-hidden="true" /> Previous
            </button>
            <span className="nl-live-page-count">{firstIndex + 1}–{Math.min(firstIndex + 5, filteredBooks.length)} of {filteredBooks.length}</span>
            <button type="button" className="nl-live-page-button" onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} disabled={currentPage >= pageCount - 1}>
              Next <ChevronRight size={16} aria-hidden="true" />
            </button>
          </nav>
        </>
      )}
    </section>
  );
}

export function LiveRankingsPage({ navigate }: { navigate: (path: string) => void }) {
  const [books, setBooks] = useState<RankedBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showSideAds, setShowSideAds] = useState(false);

  useEffect(() => {
    let alive = true;
    loadRankedBooks()
      .then((loaded) => { if (alive) setBooks(loaded); })
      .catch(() => { if (alive) setError(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  // Ad rails are desktop-only. The main content is rendered first, and no ad slot
  // is mounted or requested on phone-sized viewports.
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1440px)');
    const update = () => setShowSideAds(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const byNl = useMemo(() => books.filter((book) => book.nlRating != null).sort((a, b) => (b.nlRating ?? -1) - (a.nlRating ?? -1) || b.review.rw_rating - a.review.rw_rating || sortTitle(a, b)), [books]);
  const byRw = useMemo(() => books.filter((book) => Number.isFinite(book.review.rw_rating) && book.review.rw_rating > 0).sort((a, b) => b.review.rw_rating - a.review.rw_rating || (b.nlRating ?? -1) - (a.nlRating ?? -1) || sortTitle(a, b)), [books]);

  return (
    <div className="nl-live-page container-wide pt-24 pb-20 animate-fade-in">
      <div className="nl-live-viewport">
      <div className="nl-live-page-inner">
        <button type="button" onClick={() => navigate('/analytics')} className="nl-live-back"><ArrowLeft size={16} aria-hidden="true" /> Back to Analytics</button>

        <header className="nl-live-hero">
          <div className="nl-live-hero-art" aria-hidden="true">
            <svg viewBox="0 0 180 156" role="img" focusable="false">
              <defs>
                <linearGradient id="nlLiveBook" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#5CE1E6" /><stop offset="1" stopColor="#0097B2" /></linearGradient>
                <linearGradient id="nlLiveGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff0a8" /><stop offset="1" stopColor="#e8a72c" /></linearGradient>
              </defs>
              <ellipse cx="90" cy="136" rx="60" ry="8" fill="currentColor" opacity=".08" />
              <g className="nl-live-svg-book nl-live-svg-book-left">
                <path d="M26 51 Q51 42 81 58 L81 119 Q53 103 26 113 Z" fill="url(#nlLiveBook)" stroke="#04798a" strokeWidth="2" />
                <path d="M34 60 Q55 55 73 65 M34 70 Q54 66 73 75 M34 80 Q53 76 73 85" fill="none" stroke="#eafdff" strokeWidth="2" strokeLinecap="round" opacity=".8" />
                <path d="M26 51 Q24 47 26 42 Q52 33 81 48 L81 58 Q52 43 26 51 Z" fill="#a3f4f4" />
              </g>
              <g className="nl-live-svg-book nl-live-svg-book-right">
                <path d="M99 57 Q127 40 154 49 L154 111 Q125 103 99 120 Z" fill="#174f62" stroke="#0b3447" strokeWidth="2" />
                <path d="M108 64 Q127 55 145 60 M108 74 Q126 66 145 70 M108 84 Q126 76 145 80" fill="none" stroke="#8debed" strokeWidth="2" strokeLinecap="round" opacity=".9" />
                <path d="M99 57 Q126 40 154 49 L154 42 Q125 34 99 49 Z" fill="#56d4dc" />
              </g>
              <g className="nl-live-svg-star">
                <circle cx="90" cy="64" r="27" fill="url(#nlLiveGold)" stroke="#fff8d9" strokeWidth="2.5" />
                <path d="M90 44 L95.5 56 L109 57.2 L99 66.2 L102 79 L90 72.4 L78 79 L81 66.2 L71 57.2 L84.5 56 Z" fill="#fffdf4" stroke="#b9811a" strokeWidth="1.2" strokeLinejoin="round" />
              </g>
              <g className="nl-live-svg-sparkle" stroke="#0097b2" strokeWidth="2.5" strokeLinecap="round"><path d="M45 22 V34 M39 28 H51" /><path d="M135 19 V31 M129 25 H141" /><path d="M91 16 V24 M87 20 H95" /></g>
              <circle cx="28" cy="91" r="3" fill="#ec477b" className="nl-live-svg-dot" /><circle cx="153" cy="91" r="3" fill="#ec477b" className="nl-live-svg-dot nl-live-svg-dot-delay" />
            </svg>
          </div>
          <div className="nl-live-hero-copy">
            <span className="nl-live-eyebrow"><Activity size={13} aria-hidden="true" /> NOVELTY LIBRARY · LIVE RANKINGS</span>
            <h1>Live Rankings</h1>
            <p className="nl-live-one-liner">Explore the books readers rate highest, then open Taste Match for a personal recommendation based on your mood and reading preferences.</p>
            <p className="nl-live-hero-note">A reader-powered snapshot of the books the Novelty Library community rates highest.</p>
            <div className="nl-live-hero-actions">
              <button type="button" className="nl-taste-launch" onClick={() => navigate('/taste-match')}><TasteMatchIcon size={25} /><span><strong>Open Taste Match SE</strong><small>Find a book that fits your mind</small></span><ArrowRight size={17} aria-hidden="true" /></button>
              <button type="button" className="nl-taste-launch" onClick={() => navigate('/analytics')}><BarChart3 size={25} aria-hidden="true" /><span><strong>Open Analytics</strong><small>See the numbers behind the shelves</small></span><ArrowRight size={17} aria-hidden="true" /></button>
            </div>
          </div>
        </header>

        {loading && <div className="nl-live-loading"><LoaderCircle size={20} className="nl-live-spin" /> Gathering the library rankings…</div>}
        {!loading && error && <div className="nl-live-state"><strong>Rankings couldn't load right now.</strong><span>Please try again in a moment.</span><button type="button" onClick={() => window.location.reload()}>Retry</button></div>}
        {!loading && !error && books.length === 0 && <div className="nl-live-state"><strong>No published reviews yet.</strong><span>Rankings will appear as books are published.</span></div>}

        {!loading && !error && books.length > 0 && (
          <div className="nl-live-content">
            <div className="nl-live-ranking-grid">
              <RankingSection id="nl-rankings" kicker="COMMUNITY + REVIEWER SCORE" title="Top 5 · NL Rating" description="Highest NL scores first, with each book’s R/W stars included." books={byNl} metric="nl" navigate={navigate} icon="trending" />
              <RankingSection id="rw-rankings" kicker="REVIEWER SCORE · STAR VIEW" title="Top 5 · R/W Rating" description="Highest R/W ratings first, shown with the familiar star score." books={byRw} metric="rw" navigate={navigate} icon="trophy" />
            </div>
            <RankingSearch books={books} openBook={(review) => navigate(`/review/${encodeURIComponent(bookSlug(review))}`)} />
          </div>
        )}
        <p className="nl-live-footnote">Explore published reviews ranked by NL Rating or R/W stars. Use the search above to find books by genre, language, traits or author. For personalized recommendations, open Taste Match.</p>
      </div>
      {showSideAds && <aside className="nl-live-ad-rail nl-live-ad-rail-left" aria-label="Advertisement"><AdSenseAdSlot className="nl-live-rail-ad-slot" active={showSideAds} /></aside>}
      {showSideAds && <aside className="nl-live-ad-rail nl-live-ad-rail-right" aria-label="Advertisement"><AdSenseAdSlot className="nl-live-rail-ad-slot" active={showSideAds} /></aside>}
      </div>
    </div>
  );
}
