import { Fragment, useState, useEffect, useMemo } from 'react';
import { Search, ArrowUp, Sparkles } from 'lucide-react';
import type { Review } from '@/types/review';
import { fetchReviews } from '@/lib/reviews';
import { CommunityReviewCard, type CommunityReviewCardData } from '@/components/CommunityReviewCard';
import { EthicalAdSlot } from '@/components/EthicalAdSlot';
import { FeedbackModal } from '@/components/FeedbackModal';
import { useAuth } from '@/lib/auth';
import { fetchFeedback, saveFeedback, useEngagement, type FeedbackEntry, type FeedbackInput } from '@/lib/engagement';

interface ReviewsPageProps {
  navigate: (path: string) => void;
}

function mapCommunityReviews(reviews: Review[]): CommunityReviewCardData[] {
  return reviews.map((review) => ({
    id: review.id,
    title: review.title,
    author: review.author,
    genre: review.genre || '',
    reviewText: review.review_text,
    rwRating: review.rw_rating > 0 ? review.rw_rating : null,
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

  const communityItems = useMemo(() => mapCommunityReviews(reviews), [reviews]);

  const filteredCommunity = useMemo(() => {
    let result = communityItems;
    if (selectedGenre) result = result.filter((item) => item.genre === selectedGenre);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((item) =>
        item.title.toLowerCase().includes(q) ||
        item.author.toLowerCase().includes(q) ||
        item.genre.toLowerCase().includes(q) ||
        item.reviewer.toLowerCase().includes(q) ||
        item.reviewText.toLowerCase().includes(q)
      );
    }
    return result;
  }, [communityItems, selectedGenre, search]);

  const genres = useMemo(() => {
    const set = new Set(communityItems.map((item) => item.genre).filter(Boolean));
    return Array.from(set).sort();
  }, [communityItems]);

  const openCommunityReview = (item: CommunityReviewCardData) => {
    if (item.slug) navigate(`/review/${encodeURIComponent(item.slug)}`);
  };

  return (
    <div className="pt-24 pb-20 container-prose animate-fade-in">
      <header className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--color-teal-dark)' }}>
              <Sparkles className="w-3.5 h-3.5" />
              Community Reviews
            </div>
            <h1 className="font-serif text-4xl md:text-5xl font-semibold" style={{ color: 'var(--color-text)' }}>
              The Novelty Library review shelf
            </h1>
            <p className="max-w-3xl mt-3 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
              Reader reviews published by the Novelty Library editorial team, kept readable and easy to explore in one community shelf.
            </p>
          </div>
        </div>
      </header>

      <div className="relative max-w-2xl mb-8">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search the full reviews…"
          className="input-field pl-10"
          aria-label="Search community reviews"
        />
      </div>

      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
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
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6 items-start">
            {filteredCommunity.map((item, i) => (
              <Fragment key={item.id}>
                <CommunityReviewCard
                  item={item}
                  index={i}
                  onClick={() => openCommunityReview(item)}
                  stats={engagement.statsFor(item.id)}
                  liked={engagement.liked.has(item.id)}
                  onLike={() => { if (requireAuth()) void engagement.toggleLike(item.id); }}
                  onRate={() => void openFeedback(item)}
                  onReview={() => void openFeedback(item)}
                />
                {i === 2 && <div className="col-span-2 sm:col-span-2 lg:col-span-3"><EthicalAdSlot /></div>}
              </Fragment>
            ))}
          </div>

          <EthicalAdSlot className="mt-8" />
        </>
      )}

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
