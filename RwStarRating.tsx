import { Star } from 'lucide-react';

/**
 * Novelty Library's visual star equivalent for the 0–10 R/W rating.
 * Keep this mapping in one place so the Home/Analytics/review-card displays
 * always use the same correspondence as the submission poster preview.
 */
/** Original R/W -> star bands (from Star_Rating.xlsx). `to` is inclusive, one decimal place. */
export const RW_STAR_BANDS: ReadonlyArray<{ from: number; to: number; stars: number }> = [
  { from: 0, to: 1.5, stars: 0.5 },
  { from: 1.6, to: 2.5, stars: 1 },
  { from: 2.6, to: 3.5, stars: 1.5 },
  { from: 3.6, to: 4.5, stars: 2 },
  { from: 4.6, to: 5.5, stars: 2.5 },
  { from: 5.6, to: 6.5, stars: 3 },
  { from: 6.6, to: 7.5, stars: 3.5 },
  { from: 7.6, to: 8.5, stars: 4 },
  { from: 8.6, to: 10, stars: 4.5 },
];

export function rwRatingToStars(rating: number): number {
  const value = Math.max(0, Math.min(10, Math.round(Number(rating || 0) * 10) / 10));
  const band = RW_STAR_BANDS.find((b) => value <= b.to);
  return band ? band.stars : 4.5;
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
