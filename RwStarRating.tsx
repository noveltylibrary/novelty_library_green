import { Star } from 'lucide-react';

/**
 * Novelty Library's visual star equivalent for the 0–10 R/W rating.
 * Keep this mapping in one place so the Home/Analytics/review-card displays
 * always use the same correspondence as the submission poster preview.
 */
export function rwRatingToStars(rating: number): number {
  const value = Math.max(0, Math.min(10, Math.round(Number(rating || 0) * 10) / 10));
  if (value <= 1.5) return 0.5;
  if (value <= 2.5) return 1;
  if (value <= 3.5) return 1.5;
  if (value <= 4.5) return 2;
  if (value <= 5.5) return 2.5;
  if (value <= 6.5) return 3;
  if (value <= 7.5) return 3.5;
  if (value <= 8.5) return 4;
  return 4.5;
}

interface RwStarRatingProps {
  value: number;
  size?: number;
  className?: string;
  title?: string;
}

export function RwStarRating({ value, size = 15, className = '', title }: RwStarRatingProps) {
  const normalized = rwRatingToStars(value);
  const fullStars = Math.floor(normalized);
  const hasHalf = normalized - fullStars >= 0.5;
  const totalIcons = fullStars + (hasHalf ? 1 : 0);

  return (
    <span
      className={`calculated-stars rw-star-rating ${className}`.trim()}
      aria-label={`${normalized.toFixed(1)} stars`}
      title={title ?? `${normalized.toFixed(1)} stars`}
    >
      {Array.from({ length: totalIcons }).map((_, index) => {
        const half = hasHalf && index === fullStars;
        return (
          <span key={index} className="calculated-star" style={{ width: size, height: size }}>
            <Star
              width={size}
              height={size}
              strokeWidth={1.8}
              fill="none"
              className="calculated-star-outline"
              aria-hidden="true"
            />
            {half ? (
              <span className="calculated-star-half">
                <Star
                  width={size}
                  height={size}
                  strokeWidth={1.8}
                  fill="currentColor"
                  className="calculated-star-fill"
                  aria-hidden="true"
                />
              </span>
            ) : (
              <Star
                width={size}
                height={size}
                strokeWidth={1.8}
                fill="currentColor"
                className="calculated-star-fill"
                aria-hidden="true"
              />
            )}
          </span>
        );
      })}
    </span>
  );
}
