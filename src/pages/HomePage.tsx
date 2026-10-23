import { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, Star } from 'lucide-react';
import { useLiveHomeAnalytics } from '@/lib/homeAnalytics';
import { HeroSection } from '@/components/HeroSection';
import { fetchReviews } from '@/lib/reviews';
import { sanitizeUserText } from '@/lib/sanitize';
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
        <div className="grid gap-5 md:grid-cols-3">
          {reviews.map((review) => {
            const excerpt = sanitizeUserText(review.review_text, 520).replace(/\s+/g, ' ').trim();
            return (
              <article key={review.id} className="flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-white/70 shadow-sm backdrop-blur-sm transition hover:-translate-y-1 dark:bg-slate-900/60" style={{ borderColor: 'var(--color-border)' }}>
                <button type="button" onClick={() => navigate(`/review/${encodeURIComponent(review.slug)}`)} className="flex h-full flex-col text-left">
                  <div className="flex gap-4 p-5">
                    <div className="h-28 w-20 shrink-0 overflow-hidden rounded-lg bg-cyan-50 dark:bg-slate-800">
                      {(review.cover_image_url || review.poster_url) ? <img src={(review.cover_image_url || review.poster_url)!} alt={`Cover for ${sanitizeUserText(review.title, 100)}`} loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><BookOpen size={26} style={{ color: 'var(--color-teal-dark)' }} aria-hidden="true" /></div>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-[.16em]" style={{ color: 'var(--color-teal-dark)' }}>{sanitizeUserText(review.genre || 'Community review', 60)}</p>
                      <h3 className="line-clamp-3 font-serif text-lg font-semibold leading-snug" style={{ color: 'var(--color-text)' }}>{sanitizeUserText(review.title, 140)}</h3>
                      <p className="mt-1 line-clamp-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>by {sanitizeUserText(review.author || 'Unknown author', 100)}</p>
                      <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold" style={{ color: 'var(--color-teal-dark)' }}><Star size={13} fill="currentColor" aria-hidden="true" /> R/W {Number(review.rw_rating).toFixed(1)}/10</span>
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col px-5 pb-5">
                    <p className="line-clamp-5 text-sm leading-6" style={{ color: 'var(--color-text)' }}>{excerpt}{excerpt.length >= 520 ? '…' : ''}</p>
                    <div className="mt-5 flex items-center justify-between gap-3 border-t pt-4 text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                      <span className="truncate">Reviewed by {sanitizeUserText(review.reviewer_name || review.novelty_username || 'Community reader', 70)}</span>
                      <span className="shrink-0 font-semibold" style={{ color: 'var(--color-teal-dark)' }}>Read review <ArrowRight size={13} className="inline" aria-hidden="true" /></span>
                    </div>
                  </div>
                </button>
              </article>
            );
          })}
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
