import { Star } from 'lucide-react';

interface RatingBadgeProps {
  rating: number;
  max?: number;
  variant?: 'rw' | 'goodreads' | 'amazon';
}

export function RatingBadge({ rating, max = 10, variant = 'rw' }: RatingBadgeProps) {
  const isRw = variant === 'rw';
  const isAmazon = variant === 'amazon';
  const display = isRw ? rating.toFixed(1) : rating.toFixed(2);
  const label = isRw ? 'R/W' : isAmazon ? 'AMZ' : 'GR';

  return (
    <div
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold"
      style={{
        background: isRw ? 'var(--color-cyan)' : isAmazon ? 'rgba(245, 158, 11, 0.15)' : 'rgba(53, 211, 217, 0.2)',
        color: isRw ? 'white' : isAmazon ? '#d97706' : 'var(--color-teal-dark)',
      }}
    >
      <Star className={`w-3 h-3 ${isRw ? 'fill-white' : 'fill-current'}`} />
      <span>
        {display}
        <span className="opacity-60">/{max}</span>
      </span>
      <span className="opacity-60 text-[10px] tracking-wider">{label}</span>
    </div>
  );
}
