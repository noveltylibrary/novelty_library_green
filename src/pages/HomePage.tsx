import { useEffect, useState } from 'react';
import { ArrowRight, BookOpen } from 'lucide-react';
import { useLiveHomeAnalytics } from '@/lib/homeAnalytics';
import { HeroSection } from '@/components/HeroSection';
import { fetchReviews } from '@/lib/reviews';
import { HomeReviewPoster } from '@/components/HomeReviewPoster';
import type { Review } from '@/types/review';

interface HomePageProps { navigate: (path: string) => void; }

function CommunityShelf({ navigate }: HomePageProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    fetchReviews()
      .then((items) => { if (active) setReviews(items.filter((item) => item.is_published && item.review_text.trim().length > 0).slice(0, 3)); })
      .catch(() => { if (active) setReviews([]); })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);

  return (
    <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20" aria-labelledby="home-community-shelf-title">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em]" style={{ color: 'var(--color-teal-dark)' }}><BookOpen size={15} aria-hidden="true" /> From the community shelf</p>
          <h2 id="home-community-shelf-title" className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl" style={{ color: 'var(--color-text)' }}>Real books. Reader-written takes.</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 sm:text-base" style={{ color: 'var(--color-text-muted)' }}>Explore published reviews from readers, see what stood out to them, and open the full review before choosing your next read.</p>
        </div>
        <button type="button" onClick={() => navigate('/reviews')} className="inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition hover:-translate-y-0.5" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>Browse all reviews <ArrowRight size={16} aria-hidden="true" /></button>
      </div>

      {reviews.length > 0 ? (
        <div className="nl-hp-grid">
          {reviews.map((review) => (
            <HomeReviewPoster key={review.id} review={review} onOpen={() => navigate(`/review/${encodeURIComponent(review.slug)}`)} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border p-6 sm:p-8" style={{ borderColor: 'var(--color-border)', background: 'var(--color-paper)' }}>
          <p className="text-sm leading-6" style={{ color: 'var(--color-text-muted)' }}>{loaded ? 'New community reviews will appear here once they are published.' : 'Loading the latest published reader reviews…'}</p>
          <button type="button" onClick={() => navigate('/reviews')} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--color-teal-dark)' }}>Visit Community Reviews <ArrowRight size={15} aria-hidden="true" /></button>
        </div>
      )}
    </section>
  );
}

export function HomePage({ navigate }: HomePageProps) {
  const { data: analytics } = useLiveHomeAnalytics();
  return (
    <div className="pb-12 animate-fade-in">
      <HeroSection navigate={navigate} live={analytics ? { accepted_total: analytics.accepted_total, authors: analytics.authors, avg_form_rating: analytics.avg_form_rating } : null} />
      <CommunityShelf navigate={navigate} />
    </div>
  );
}
