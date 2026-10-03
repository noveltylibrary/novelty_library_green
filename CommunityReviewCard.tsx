import { RwStarRating } from '@/components/RwStarRating';
import { PosterImage } from '@/components/PosterImage';
import { EngagementBar } from '@/components/EngagementBar';
import { computeNlRating, type EngagementStats } from '@/lib/engagement';

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
  index?: number;
  stats: EngagementStats;
  liked: boolean;
  onLike: () => void;
  onRate: () => void;
  onReview: () => void;
}

/** Community review card. The poster stays square; R/W is the primary card rating and NL rating lives in the engagement row. */
export function CommunityReviewCard({ item, onClick, index = 0, stats, liked, onLike, onRate, onReview }: CommunityReviewCardProps) {
  const nl = computeNlRating(item.rwRating, stats);

  return (
    <article className="community-review-card group" style={{ animationDelay: `${index * 45}ms` }}>
      <div className="community-review-poster" onClick={onClick} role="link" aria-label={`Open review of ${item.title}`}>
        <PosterImage src={item.coverImage} alt={item.title} />

        {item.rwRating !== null && (
          <div className="absolute top-3 right-3" title="R/W Rating">
            <span className="nl-chip community-rw-badge px-3.5 py-1.5" title={`R/W ${item.rwRating.toFixed(1)}/10`}>
              <RwStarRating value={item.rwRating} size={16} className="text-current" />
            </span>
          </div>
        )}

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
