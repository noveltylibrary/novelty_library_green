import { Fragment, useState, useEffect, useMemo, useRef } from 'react';
import { LatestReviewsRail } from '@/components/EmptyStateFeed';
import { useMuteFilter } from '@/lib/userPrefs';
import { Search, ArrowUp, Users, Trophy, PenTool, BarChart3, SlidersHorizontal, X, ArrowRight, ChevronDown } from 'lucide-react';
import type { Review } from '@/types/review';
import { TasteMatchIcon } from '@/components/TasteMatchIcon';
import { loadReviewCached, fetchReviews } from '@/lib/reviews';
import { CommunityReviewCard, type CommunityReviewCardData } from '@/components/CommunityReviewCard';
import { FeedbackModal } from '@/components/FeedbackModal';
import { useAuth } from '@/lib/auth';
import { VERDICTS, normalizeVerdict } from '@/lib/verdict';
import { fetchFeedback, saveFeedback, useEngagement, type FeedbackEntry, type FeedbackInput } from '@/lib/engagement';

type SortKey = 'newest' | 'oldest' | 'rating_desc' | 'rating_asc' | 'liked' | 'title';
const SORTS: { value: SortKey; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'rating_desc', label: 'Highest rated' },
  { value: 'rating_asc', label: 'Lowest rated' },
  { value: 'liked', label: 'Most liked' },
  { value: 'title', label: 'Title A–Z' },
];
/** First batch and the size of every "Load more" batch. */
const FIRST_BATCH = 16;
const BATCH = 8;
/** Below this many matches, a Taste Match SE card is offered under the list. */
const FALLBACK_BELOW = 16;

interface ReviewsPageProps {
  navigate: (path: string) => void;
}

/** Extract a numeric Review No. from modern and legacy formats such as 48, "#48", or "Review No. 48". */
function getNumericReviewNo(review: Review): number | null {
  for (const value of [review.review_number, review.master_review_no]) {
    if (value === null || value === undefined || value === '') continue;
    const match = String(value).match(/\d+/);
    if (!match) continue;
    const number = Number(match[0]);
    if (Number.isFinite(number) && number > 0) return number;
  }
  return null;
}

/** Order the reader-facing Community Reviews by Review No., not publish date or text ordering. */
function sortCommunityReviewsByNumber(reviews: Review[]): Review[] {
  return [...reviews].sort((a, b) => {
    const aNo = getNumericReviewNo(a);
    const bNo = getNumericReviewNo(b);
    if (aNo === null && bNo === null) return 0;
    if (aNo === null) return 1;
    if (bNo === null) return -1;
    return bNo - aNo;
  });
}

function mapCommunityReviews(reviews: Review[]): CommunityReviewCardData[] {
  return reviews.map((review) => ({
    id: review.id,
    title: review.title,
    author: review.author,
    genre: review.genre || '',
    reviewText: review.review_text,
    rwRating: review.rw_rating > 0 ? review.rw_rating : null,
    verdict: review.verdict ?? null,
    reviewer: review.reviewer_handle || '',
    coverImage: review.poster_url || null,
    publishedAt: review.published_at,
    source: 'community' as const,
    slug: review.slug,
  }));
}

export function ReviewsPage({ navigate }: ReviewsPageProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('newest');
  const [verdictFilter, setVerdictFilter] = useState<string>('');
  const [authorQ, setAuthorQ] = useState('');
  const [reviewerQ, setReviewerQ] = useState('');
  const [suggestFor, setSuggestFor] = useState<'author' | null>(null);
  const [visible, setVisible] = useState(FIRST_BATCH);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterRef = useRef<HTMLElement | null>(null);
  const authorInputRef = useRef<HTMLInputElement | null>(null);
  const suggestRef = useRef<HTMLDivElement | null>(null);

  const { user, profile } = useAuth();
  const engagement = useEngagement();
  const [feedbackFor, setFeedbackFor] = useState<CommunityReviewCardData | null>(null);
  const [myFeedback, setMyFeedback] = useState<FeedbackEntry | null>(null);

  const requireAuth = (): boolean => {
    if (user) return true;
    navigate('/auth');
    return false;
  };

  const openFeedback = async (item: CommunityReviewCardData) => {
    if (!requireAuth() || !user) return;
    setMyFeedback(null);
    setFeedbackFor(item);
    try {
      const all = await fetchFeedback(item.id);
      setMyFeedback(all.find((f) => f.user_id === user.id) ?? null);
    } catch {
      // Modal still works for a new entry.
    }
  };

  const submitFeedback = async (input: FeedbackInput) => {
    if (!user || !feedbackFor) return;
    await saveFeedback(user, profile, feedbackFor.id, input);
    await engagement.refresh();
  };

  useEffect(() => {
    fetchReviews()
      .catch(() => [] as Review[])
      .then((reviewData) => {
        setReviews(reviewData);
        setLoading(false);
      });
  }, []);

  // This affects only the public Community Reviews feed; keep the admin Publishing Queue untouched.
  // Review No. may be stored as text, so sort on normalized numeric values after fetching.
  const communityItems = useMemo(
    () => mapCommunityReviews(sortCommunityReviewsByNumber(reviews)),
    [reviews],
  );

  // Reviewer identity can be filtered only by manually entered text; never expose reviewer suggestions or identity chips.
  const reviewerNameById = useMemo(() => new Map(reviews.map((r) => [r.id, (r.reviewer_name || '').trim()])), [reviews]);

  const filtersActive = !!(selectedGenre || search.trim() || verdictFilter || authorQ.trim() || reviewerQ.trim());

  const isMuted = useMuteFilter();
  const filteredCommunity = useMemo(() => {
    let result = communityItems.filter((item) => !isMuted(item.title, item.author, item.genre, item.reviewText));
    if (selectedGenre) result = result.filter((item) => item.genre === selectedGenre);
    if (verdictFilter) result = result.filter((item) => normalizeVerdict(item.verdict) === verdictFilter);
    if (authorQ.trim()) { const q = authorQ.trim().toLowerCase(); result = result.filter((item) => item.author.toLowerCase().includes(q)); }
    if (reviewerQ.trim()) { const q = reviewerQ.trim().toLowerCase().replace(/^@/, ''); result = result.filter((item) => `${item.reviewer} ${reviewerNameById.get(item.id) || ''}`.toLowerCase().replace(/@/g, '').includes(q)); }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((item) =>
        item.title.toLowerCase().includes(q) ||
        item.author.toLowerCase().includes(q) ||
        item.genre.toLowerCase().includes(q) ||
        item.reviewer.toLowerCase().includes(q) ||
        (reviewerNameById.get(item.id) || '').toLowerCase().includes(q) ||
        item.reviewText.toLowerCase().includes(q)
      );
    }
    if (sort === 'newest') return result; // already ordered by Review No., newest first
    const sorted = [...result];
    if (sort === 'oldest') sorted.reverse();
    else if (sort === 'rating_desc') sorted.sort((x, y) => (y.rwRating ?? -1) - (x.rwRating ?? -1));
    else if (sort === 'rating_asc') sorted.sort((x, y) => (x.rwRating ?? 99) - (y.rwRating ?? 99));
    else if (sort === 'liked') sorted.sort((x, y) => engagement.statsFor(y.id).likeCount - engagement.statsFor(x.id).likeCount);
    else if (sort === 'title') sorted.sort((x, y) => x.title.localeCompare(y.title));
    return sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityItems, isMuted, reviewerNameById, selectedGenre, search, verdictFilter, authorQ, reviewerQ, sort, sort === 'liked' ? engagement.stats : null]);

  // A new filter or sort always starts again from the first batch.
  useEffect(() => { setVisible(FIRST_BATCH); }, [selectedGenre, search, verdictFilter, authorQ, reviewerQ, sort]);

  const authors = useMemo(() => Array.from(new Set(communityItems.map((i) => i.author).filter(Boolean))).sort(), [communityItems]);
  const suggestions = useMemo(() => {
    const list = suggestFor === 'author' ? authors : [];
    const q = authorQ.trim().toLowerCase().replace(/^@/, '');
    const starts = list.filter((x) => x.toLowerCase().replace(/^@/, '').startsWith(q));
    const rest = q ? list.filter((x) => !starts.includes(x) && x.toLowerCase().includes(q)) : [];
    return [...starts, ...rest].filter((x) => x.toLowerCase().replace(/^@/, '') !== q).slice(0, 12);
  }, [suggestFor, authors, authorQ]);
  // Sort counts as active only when it is not the default; the search box is always visible, so it is not counted here.
  const activeFilterCount = [sort !== 'newest', !!verdictFilter, !!selectedGenre, !!authorQ.trim(), !!reviewerQ.trim()].filter(Boolean).length;
  // The dropdown closes on an outside click or Escape.
  useEffect(() => {
    if (!filtersOpen) return;
    const onDown = (e: MouseEvent | TouchEvent) => { if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFiltersOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFiltersOpen(false); };
    document.addEventListener('mousedown', onDown); document.addEventListener('touchstart', onDown); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('touchstart', onDown); document.removeEventListener('keydown', onKey); };
  }, [filtersOpen]);
  // The author suggestions close when you click or tap anywhere else (even inside the filter panel), press Escape, or tab away.
  useEffect(() => {
    if (!suggestFor) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (authorInputRef.current?.contains(t) || suggestRef.current?.contains(t)) return;
      setSuggestFor(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSuggestFor(null); };
    document.addEventListener('mousedown', onDown); document.addEventListener('touchstart', onDown); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('touchstart', onDown); document.removeEventListener('keydown', onKey); };
  }, [suggestFor]);
  const clearFilters = () => { setSelectedGenre(null); setSearch(''); setVerdictFilter(''); setAuthorQ(''); setReviewerQ(''); setSort('newest'); };

  const genres = useMemo(() => {
    const set = new Set(communityItems.map((item) => item.genre).filter(Boolean));
    return Array.from(set).sort();
  }, [communityItems]);

  const openCommunityReview = (item: CommunityReviewCardData) => {
    if (item.slug) void loadReviewCached(item.slug).catch(() => undefined);
    if (item.slug) navigate(`/review/${encodeURIComponent(item.slug)}`);
  };

  return (
    <div className="pt-24 pb-20 container-prose container-wide animate-fade-in">
      <header className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--color-teal-dark)' }}>
              <Users className="w-3.5 h-3.5" />
              Community Reviews
            </div>
            <h1 className="font-serif text-4xl md:text-5xl font-semibold" style={{ color: 'var(--color-text)' }}>
              Book Reviews Shelf
            </h1>
            <p className="max-w-3xl mt-3 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
              Didn't find your book here? Submit your review via our Submit page, or reserve it to submit later!
            </p>
          </div>
        </div>
      </header>

      <section className="nl-rv-filter" aria-label="Search, sort and filter reviews" ref={filterRef}>
        <div className="nl-rv-bar">
          <div className="nl-rv-search">
            <Search aria-hidden="true" className="w-4 h-4" />
            <input type="text" value={search} maxLength={120} onChange={(e) => setSearch(e.target.value)} placeholder="Search the full reviews…" aria-label="Search community reviews" />
          </div>
          <button type="button" className="nl-rv-toggle" aria-expanded={filtersOpen} aria-controls="nl-rv-panel" onClick={() => setFiltersOpen((o) => !o)}>
            <SlidersHorizontal aria-hidden="true" />
            <span className="nl-rv-toggle-label">Sort &amp; filter</span>
            {activeFilterCount > 0 && <span className="nl-rv-count" aria-label={`${activeFilterCount} active`}>{activeFilterCount}</span>}
            <ChevronDown aria-hidden="true" className="nl-rv-chev" />
          </button>
        </div>
        {filtersOpen && (
          <div className="nl-rv-panel" id="nl-rv-panel">
            <div className="nl-rv-grid">
              <label><span><SlidersHorizontal aria-hidden="true" className="w-3 h-3" /> Sort</span>
                <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>{SORTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
              </label>
              <label><span>Verdict</span>
                <select value={verdictFilter} onChange={(e) => setVerdictFilter(e.target.value)}>
                  <option value="">Any verdict</option>
                  {VERDICTS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
                </select>
              </label>
              <label><span>Genre</span>
                <select value={selectedGenre ?? ''} onChange={(e) => setSelectedGenre(e.target.value || null)}>
                  <option value="">Any genre</option>
                  {genres.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </label>
              <label><span>Author</span>
                <input ref={authorInputRef} type="text" value={authorQ} maxLength={80} onFocus={() => setSuggestFor('author')} onBlur={(e) => { if (!suggestRef.current?.contains(e.relatedTarget as Node | null)) setSuggestFor(null); }} onChange={(e) => { setAuthorQ(e.target.value); setSuggestFor('author'); }} placeholder="Type an author" autoComplete="off" />
              </label>
              <label><span>Reviewer</span>
                <input type="text" value={reviewerQ} maxLength={80} onChange={(e) => setReviewerQ(e.target.value)} placeholder="Search reviewer text" aria-label="Filter reviews by reviewer text" autoComplete="off" />
              </label>
            </div>
            {suggestFor && suggestions.length > 0 && (
              <div ref={suggestRef} className="nl-rv-suggest" role="listbox" aria-label="Author suggestions">
                {suggestions.map((name) => (
                  <button key={name} type="button" role="option" aria-selected="false" onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setAuthorQ(name); setSuggestFor(null); }}>{name}</button>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="nl-rv-line">
          <span aria-live="polite">{loading ? 'Loading…' : `${filteredCommunity.length} ${filteredCommunity.length === 1 ? 'review' : 'reviews'}`}</span>
          {filtersActive && <button type="button" onClick={clearFilters}><X aria-hidden="true" className="w-3 h-3" /> Clear all</button>}
        </div>
      </section>

      {loading && (
        <div className="nl-review-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-2xl overflow-hidden surface-card animate-pulse">
              <div className="aspect-square" style={{ background: 'var(--color-paper)' }} />
              <div className="p-3"><div className="h-5 w-32 rounded" style={{ background: 'var(--color-paper)' }} /></div>
            </div>
          ))}
        </div>
      )}

      {!loading && filteredCommunity.length === 0 && (
        <div className="text-center py-20">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No community reviews found.</p>
        </div>
      )}

      {!loading && filteredCommunity.length > 0 && (
        <>
          <div className="nl-review-grid items-start">
            {filteredCommunity.slice(0, visible).map((item, i) => (
              <Fragment key={item.id}>
                <CommunityReviewCard
                  item={item}
                  index={i}
                  onClick={() => openCommunityReview(item)}
                  onPrefetch={() => { if (item.slug) void loadReviewCached(item.slug).catch(() => undefined); }}
                  stats={engagement.statsFor(item.id)}
                  liked={engagement.liked.has(item.id)}
                  onLike={() => { if (requireAuth()) void engagement.toggleLike(item.id); }}
                  onRate={() => void openFeedback(item)}
                  onReview={() => void openFeedback(item)}
                />
              </Fragment>
            ))}
          </div>

          {filteredCommunity.length > visible && (
            <div className="nl-rv-more">
              <button type="button" className="nl-action-btn nl-rv-load-more" onClick={() => setVisible((v) => v + BATCH)}>
                Load more <span>({filteredCommunity.length - visible} left)</span>
              </button>
            </div>
          )}
        </>
      )}

      {!loading && filtersActive && filteredCommunity.length === 0 && <LatestReviewsRail heading="Latest reviews instead" />}

      {!loading && filtersActive && filteredCommunity.length < FALLBACK_BELOW && (
        <aside className="nl-rv-tm" aria-label="Taste Match SE suggestion">
          <TasteMatchIcon className="w-9 h-9" aria-hidden="true" />
          <div>
            <b>{filteredCommunity.length === 0 ? 'Nothing matched those filters' : 'Want more than these matches?'}</b>
            <p>Describe the mood you are in and Taste Match SE will pick from the whole shelf, with a short reason for each pick.</p>
          </div>
          <button type="button" className="nl-action-btn" onClick={() => navigate('/taste-match')}>Try Taste Match SE <ArrowRight aria-hidden="true" /></button>
        </aside>
      )}

      {!loading && filtersActive && (
        <p className="nl-rv-bridge">
          Looking for intricate thematic maneuvering or mood-based curation? Find the Taste Match SE page{' '}
          <a href="/taste-match" onClick={(e) => { e.preventDefault(); navigate('/taste-match'); }}>here</a>.
        </p>
      )}

      <div className="mt-10">
        <div className="nl-reviews-actions" style={{ maxWidth: "46rem", marginInline: "auto" }} role="group" aria-label="Review shortcuts">
          <button type="button" className="nl-action-btn" onClick={() => navigate('/submit')}><PenTool aria-hidden="true" /><span>Submit</span></button>
          <button type="button" className="nl-action-btn" onClick={() => navigate('/live-rankings')}><Trophy aria-hidden="true" /><span>Rankings</span></button>
          <button type="button" className="nl-action-btn" onClick={() => navigate('/analytics')}><BarChart3 aria-hidden="true" /><span>Analytics</span></button>
          <button type="button" className="nl-action-btn" onClick={() => navigate('/taste-match')}><TasteMatchIcon className="w-5 h-5" aria-hidden="true" /><span>Taste Match SE</span></button>
        </div>
      </div>

      {!loading && genres.length > 0 && (
        <div className="mt-12 pt-8" style={{ borderTop: '1px solid var(--color-border)' }}>
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] font-semibold" style={{ color: 'var(--color-teal-dark)' }}>Browse by genre</p>
              <h2 className="font-serif text-2xl font-semibold" style={{ color: 'var(--color-text)' }}>Find your next shelf</h2>
            </div>
            <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="hidden sm:flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--color-cyan-dark)' }}>
              Back to reviews <ArrowUp className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setSelectedGenre(null)} className={`review-filter-tag ${!selectedGenre ? 'is-active' : ''}`}>All</button>
            {genres.map((genre) => (
              <button key={genre} onClick={() => setSelectedGenre(genre === selectedGenre ? null : genre)} className={`review-filter-tag ${selectedGenre === genre ? 'is-active' : ''}`}>
                {genre}
              </button>
            ))}
          </div>
        </div>
      )}

      <FeedbackModal
        open={feedbackFor !== null}
        reviewTitle={feedbackFor?.title ?? ''}
        existing={myFeedback}
        onClose={() => setFeedbackFor(null)}
        onSubmit={submitFeedback}
      />
    </div>
  );
}
