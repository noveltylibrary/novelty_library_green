import { useState, useEffect } from 'react';
import { ArrowLeft, ExternalLink, Instagram, Calendar, Globe, Tag, Star } from 'lucide-react';
import type { Review } from '@/types/review';
import { loadReviewCached, peekReview, storeReviewInCache } from '@/lib/reviews';
import { fetchBlogPosts, blogPostDate, htmlToText } from '@/lib/blog';
import { formatDate } from '@/lib/format';
import { RatingBadge } from '@/components/RatingBadge';
import { EthicalAdSlot } from '@/components/EthicalAdSlot';
import { PosterImage } from '@/components/PosterImage';
import { EngagementBar } from '@/components/EngagementBar';
import { FeedbackModal } from '@/components/FeedbackModal';
import { FeedbackList } from '@/components/FeedbackList';
import { ReviewComments } from '@/components/ReviewComments';
import { useAuth } from '@/lib/auth';
import { computeNlRating, deleteFeedback, fetchFeedback, saveFeedback, useEngagement, type FeedbackEntry, type FeedbackInput } from '@/lib/engagement';
import { sanitizeUserText, safeExternalUrl } from '@/lib/sanitize';

interface ReviewPageProps {
  slug: string;
  navigate: (path: string) => void;
}

export function ReviewPage({ slug, navigate }: ReviewPageProps) {
  const [review, setReview] = useState<Review | null>(() => peekReview(slug));
  const [loading, setLoading] = useState(() => !peekReview(slug));
  const [error, setError] = useState<string | null>(null);

  const { user, profile } = useAuth();
  const engagement = useEngagement();
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const myFeedback = feedback.find((f) => f.user_id === user?.id) ?? null;

  const loadFeedback = (reviewId: string) => { fetchFeedback(reviewId).then(setFeedback).catch(() => setFeedback([])); };
  useEffect(() => { if (review?.id) loadFeedback(review.id); }, [review?.id]);

  const requireAuth = (): boolean => {
    if (user) return true;
    navigate('/auth');
    return false;
  };
  const openModal = () => { if (requireAuth()) setModalOpen(true); };
  const submitFeedback = async (input: FeedbackInput) => {
    if (!user || !review) return;
    await saveFeedback(user, profile, review.id, input);
    loadFeedback(review.id);
    await engagement.refresh();
  };
  const removeFeedback = async () => {
    if (!user || !review) return;
    await deleteFeedback(user, review.id);
    loadFeedback(review.id);
    await engagement.refresh();
  };

  useEffect(() => {
    let alive = true;
    const cached = peekReview(slug);
    setError(null);
    if (cached) { setReview(cached); setLoading(false); } else { setLoading(true); }

    // Paint the review as soon as the database answers; the slower blog archive only refines it afterwards.
    loadReviewCached(slug)
      .then((data) => {
        if (!alive) return;
        if (!data) { setReview(null); setLoading(false); return; }
        setReview((prev) => prev && prev.id === data.id ? prev : data);
        setLoading(false);
        fetchBlogPosts().catch(() => [])
          .then((posts) => {
            if (!alive) return;
            const blogPost = posts.find((post) => post.title.trim().toLowerCase() === data.title.trim().toLowerCase());
            if (!blogPost) return;
            const blogTime = new Date(blogPostDate(blogPost)).getTime();
            const appTime = new Date(data.updated_at || data.published_at).getTime();
            if (Number.isFinite(blogTime) && Number.isFinite(appTime) && blogTime > appTime) {
              const merged = {
                ...data,
                review_text: htmlToText(blogPost.content || blogPost.summary) || data.review_text,
                cover_image_url: data.cover_image_url || blogPost.thumbnail,
                published_at: blogPostDate(blogPost),
              };
              storeReviewInCache(slug, merged);
              setReview(merged);
            }
          });
      })
      .catch((err) => { if (!alive) return; setError(err.message); setLoading(false); });
    return () => { alive = false; };
  }, [slug]);

  if (loading) {
    return (
      <div className="pt-24 container-prose">
        <div className="max-w-4xl mx-auto animate-pulse">
          <div className="h-6 w-24 rounded mb-8" style={{ background: 'var(--color-paper)' }} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="aspect-square rounded-2xl" style={{ background: 'var(--color-paper)' }} />
            <div className="md:col-span-2 space-y-4">
              <div className="h-8 w-3/4 rounded" style={{ background: 'var(--color-paper)' }} />
              <div className="h-4 w-1/2 rounded" style={{ background: 'var(--color-paper)' }} />
              <div className="h-32 w-full rounded" style={{ background: 'var(--color-paper)' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !review) {
    return (
      <div className="pt-32 container-prose text-center">
        <p className="text-lg mb-4" style={{ color: 'var(--color-text-muted)' }}>
          {error ? 'Something went wrong.' : 'Review not found.'}
        </p>
        <button onClick={() => navigate('/reviews')} className="btn-ghost">
          <ArrowLeft className="w-4 h-4" /> Back to Reviews
        </button>
      </div>
    );
  }

  return (
    <div className="pt-24 pb-12 nl-fast-in">
      <div className="container-prose">
        <button
          onClick={() => navigate('/reviews')}
          className="inline-flex items-center gap-1.5 text-sm mb-8 transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <ArrowLeft className="w-4 h-4" /> Back to Reviews
        </button>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 lg:gap-12 max-w-5xl mx-auto">
          {/* Cover */}
          <div className="md:col-span-2 nl-fast-up">
            {review.poster_url ? (
              // Community poster: always 1:1, never cropped.
              <div className="relative rounded-2xl overflow-hidden shadow-xl aspect-square" style={{ background: 'var(--color-paper)' }}>
                <PosterImage src={review.poster_url} alt={sanitizeUserText(review.title, 200)} />
              </div>
            ) : (
              <div className="relative rounded-2xl overflow-hidden shadow-xl aspect-[4/5]" style={{ background: 'var(--color-paper)' }}>
                {review.cover_image_url ? (
                  <img src={review.cover_image_url} alt={sanitizeUserText(review.title, 200)} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center gradient-teal">
                    <span className="font-serif text-3xl text-white/30 px-4 text-center">{sanitizeUserText(review.title, 200)}</span>
                  </div>
                )}
              </div>
            )}

            <EngagementBar
              variant="post"
              stats={engagement.statsFor(review.id)}
              liked={engagement.liked.has(review.id)}
              onLike={() => { if (requireAuth()) void engagement.toggleLike(review.id); }}
              onRate={openModal}
              onReview={openModal}
              reviewTitle={sanitizeUserText(review.title, 200)}
            />

            {(review.poster_link || review.buy_link) && (
              <a
                href={safeExternalUrl(review.poster_link || review.buy_link) || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="nl-buy-now w-full mt-4"
              >
                <ExternalLink className="w-4 h-4" /> Buy Now
              </a>
            )}
          </div>

          {/* Content */}
          <div className="md:col-span-3 nl-fast-up" style={{ animationDelay: '40ms' }}>
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="nl-chip px-4 py-1.5 text-[13px] font-semibold">{sanitizeUserText(review.genre, 80)}</span>
              {review.traits?.split(',').map((trait) => (
                <span key={sanitizeUserText(trait.trim(), 60)} className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: 'rgba(0, 151, 178, 0.06)', color: 'var(--color-text-muted)' }}>
                  {sanitizeUserText(trait.trim(), 60)}
                </span>
              ))}
            </div>

            <h1 className="font-serif text-4xl md:text-5xl font-semibold leading-tight tracking-tight mb-3 text-balance" style={{ color: 'var(--color-text)' }}>
              {sanitizeUserText(review.title, 200)}
            </h1>
            <p className="text-lg mb-6" style={{ color: 'var(--color-text-muted)' }}>by {sanitizeUserText(review.author, 120)}</p>

            {/* Ratings */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <RatingBadge rating={review.rw_rating} max={10} variant="rw" />
              {review.goodreads_rating && (
                <RatingBadge rating={review.goodreads_rating} max={5} variant="goodreads" />
              )}
              {review.amazon_rating && (
                <RatingBadge rating={review.amazon_rating} max={5} variant="amazon" />
              )}
              {(() => {
                const nl = computeNlRating(review.rw_rating, engagement.statsFor(review.id));
                return nl !== null ? (
                  <span className="nl-chip gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold" title="NL Rating: the R/W rating averaged with every reader rating">
                    <Star className="w-3 h-3 fill-current" />{nl.toFixed(1)}<span className="opacity-70">/10</span>
                    <span className="opacity-70 text-[10px] tracking-wider">NL</span>
                  </span>
                ) : null;
              })()}
            </div>

            {/* Meta */}
            <div className="nl-review-meta flex flex-wrap items-center gap-x-8 gap-y-3 mb-8 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {formatDate(review.published_at) && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" /> {formatDate(review.published_at)}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Globe className="w-4 h-4" /> {sanitizeUserText(review.language, 80)}
              </span>
              {review.translated_from && (
                <span className="flex items-center gap-1.5">
                  Translated from {sanitizeUserText(review.translated_from, 80)}
                </span>
              )}
              {review.series_name && (
                <span className="flex items-center gap-1.5">
                  {sanitizeUserText(review.series_name, 120)}{review.series_number ? ` #${review.series_number}` : ''}
                </span>
              )}
              {(review.reviewer_handle || review.novelty_username) && (
                <span className="flex items-center gap-2">
                  {review.reviewer_handle && <Instagram className="w-4 h-4 shrink-0" />}
                  {review.reviewer_handle && <span style={{ color: 'var(--color-cyan-dark)' }}>{sanitizeUserText(review.reviewer_handle, 80)}</span>}
                  {review.novelty_username && (
                    <button type="button" onClick={() => navigate(`/profile/@${encodeURIComponent(review.novelty_username!.replace(/^@/, ''))}`)} className="inline-flex items-center gap-1.5 font-semibold hover:underline" style={{ color: 'var(--color-teal-dark)' }}>
                      <span className="nl-handle-box" aria-hidden="true">NL</span>
                      @{sanitizeUserText(review.novelty_username.replace(/^@/, ''), 60)}
                    </button>
                  )}
                </span>
              )}
            </div>

            {/* Review text */}
            <div className="prose-content">
              {review.review_text.split('\n\n').map((para, i) => (
                <p key={i} className="leading-[1.8] mb-5 text-[15px] md:text-base" style={{ color: 'var(--color-text)' }}>
                  {sanitizeUserText(para, 12000)}
                </p>
              ))}
            </div>

            {/* Labels */}
            {review.labels.length > 0 && (
              <div className="mt-8 pt-6" style={{ borderTop: '1px solid var(--color-border)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <Tag className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
                  <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>Tags</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {review.labels.map((label) => (
                    <span key={label} className="tag">{sanitizeUserText(label, 80)}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Reader reviews (likes / ratings / reviews on this post) */}
            <section className="mt-10 pt-6" style={{ borderTop: '1px solid var(--color-border)' }}>
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="font-serif text-xl font-semibold" style={{ color: 'var(--color-text)' }}>Reader reviews ({feedback.length})</h2>
                <button type="button" onClick={openModal} className="btn-primary text-sm" style={{ padding: '8px 18px' }}>{myFeedback ? 'Edit yours' : 'Rate & Review'}</button>
              </div>
              <FeedbackList entries={feedback} currentUserId={user?.id} user={user} profile={profile} navigate={navigate} onEdit={openModal} onDelete={() => void removeFeedback()} />
            </section>

            <ReviewComments reviewId={review.id} navigate={navigate} />

            <EthicalAdSlot className="mt-8 mb-8" />

            {/* Disclaimer */}
            <div className="mt-8 p-4 rounded-xl" style={{ background: 'var(--color-paper)', border: '1px solid var(--color-border)' }}>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                The R/W Rating reflects the specific reviewer's opinion. The NL Rating averages it with the ratings left by Novelty Library readers. A book's impression varies from reader to reader. For a broader perspective, refer to the Goodreads rating.
              </p>
            </div>
          </div>
        </div>
      </div>
      <FeedbackModal open={modalOpen} reviewTitle={sanitizeUserText(review.title, 200)} existing={myFeedback} onClose={() => setModalOpen(false)} onSubmit={submitFeedback} />
    </div>
  );
}
