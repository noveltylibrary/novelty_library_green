import { ArrowRight } from 'lucide-react';
import type { Review } from '@/types/review';
import { formatShortDate } from '@/lib/format';
import { RwStarRating } from '@/components/RwStarRating';

interface ReviewCardProps {
  review: Review;
  onClick: () => void;
  index?: number;
}

export function ReviewCard({ review, onClick, index = 0 }: ReviewCardProps) {
  return (
    <article
      onClick={onClick}
      className="card-review group flex flex-col"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="relative aspect-square overflow-hidden" style={{ backgroundColor: 'var(--color-paper)' }}>
        {review.cover_image_url ? (
          <img
            src={review.cover_image_url}
            alt={review.title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center gradient-teal">
            <span className="font-serif text-3xl text-white/40 px-4 text-center">{review.title}</span>
          </div>
        )}
        <div className="absolute top-3 left-3">
          <div className="inline-flex items-center px-2.5 py-1 rounded-lg gradient-teal text-white shadow-md" title={`R/W ${review.rw_rating.toFixed(1)}/10`}>
            <RwStarRating value={review.rw_rating} size={14} className="text-white" />
          </div>
        </div>
        <div className="absolute bottom-3 right-3">
          <span className="px-2.5 py-1 rounded-full text-[11px] font-medium backdrop-blur-sm" style={{ background: 'rgba(255,255,255,0.9)', color: 'var(--color-text)' }}>
            {review.genre}
          </span>
        </div>
      </div>

      <div className="p-5 flex flex-col flex-1">
        <p className="text-[11px] uppercase tracking-widest mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
          {formatShortDate(review.published_at)}
        </p>
        <h3 className="font-serif text-lg font-semibold leading-snug mb-1 line-clamp-2" style={{ color: 'var(--color-text)' }}>
          {review.title}
        </h3>
        <p className="text-sm mb-3" style={{ color: 'var(--color-text-muted)' }}>by {review.author}</p>
        <p className="text-sm leading-relaxed line-clamp-3 flex-1" style={{ color: 'var(--color-text)' }}>
          {review.review_text}
        </p>
        <div className="mt-4 flex items-center gap-1 text-sm font-medium" style={{ color: 'var(--color-cyan-dark)' }}>
          Read review <ArrowRight className="w-4 h-4 group-hover:gap-2 transition-all" />
        </div>
      </div>
    </article>
  );
}
