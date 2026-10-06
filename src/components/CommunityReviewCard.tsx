import { PosterImage } from '@/components/PosterImage';
import { EngagementBar } from '@/components/EngagementBar';
import { computeNlRating, type EngagementStats } from '@/lib/engagement';
import { sanitizeUserText } from '@/lib/sanitize';

export interface CommunityReviewCardData {
  id: string;
  title: string;
  author: string;
  genre: string;
  reviewText: string;
  rwRating: number | null;
  reviewer: string;
  coverImage: string | null;
  publishedAt: string;
  source: 'community' | 'blog';
  slug?: string;
  blogId?: string;
}

interface CommunityReviewCardProps {
  item: CommunityReviewCardData;
  onClick: () => void;
  /** Fired on hover / touch-start so the review page can load before the click lands. */
  onPrefetch?: () => void;
  index?: number;
  stats: EngagementStats;
  liked: boolean;
  onLike: () => void;
  onRate: () => void;
  onReview: () => void;
}

/** Community review card. The poster stays square; NL is the cumulative average of the reviewer's R/W score plus all reader ratings in the engagement row. */
export function CommunityReviewCard({ item, onClick, onPrefetch, index = 0, stats, liked, onLike, onRate, onReview }: CommunityReviewCardProps) {
  const nl = computeNlRating(item.rwRating, stats);
  const safeTitle = sanitizeUserText(item.title, 200);

  return (
    <article className="community-review-card group" style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }} onPointerEnter={onPrefetch} onTouchStart={onPrefetch} onFocus={onPrefetch}>
      <div className="community-review-poster" onClick={onClick} role="link" aria-label={`Open review of ${safeTitle}`}>
        <PosterImage src={item.coverImage} alt={safeTitle} />

      </div>

      <EngagementBar
        stats={stats}
        liked={liked}
        onLike={onLike}
        onRate={onRate}
        onReview={onReview}
        nlRating={nl}
      />
    </article>
  );
}
