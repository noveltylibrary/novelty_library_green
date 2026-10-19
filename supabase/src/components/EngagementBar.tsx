import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Check, Copy, Heart, MessageCircle, Share2, Star } from 'lucide-react';
import type { EngagementStats } from '@/lib/engagement';
import { NlLogo } from '@/components/NlLogo';

interface EngagementBarProps {
  stats: EngagementStats;
  liked: boolean;
  onLike: () => void;
  onRate: () => void;
  onReview: () => void;
  /** `card` = compact icon row; `post` = larger row with labels (single-post page). */
  variant?: 'card' | 'post';
  nlRating?: number | null;
  reviewTitle?: string;
}

/** Like / Rate / Review icons shown under every Community Review post. */
export function EngagementBar({ stats, liked, onLike, onRate, onReview, variant = 'card', nlRating = null, reviewTitle = 'Novelty Library review' }: EngagementBarProps) {
  const big = variant === 'post';
  const icon = big ? 'w-5 h-5' : 'w-[18px] h-[18px]';
  const base = `engagement-btn ${big ? 'engagement-btn-lg' : ''}`;
  const stop = (fn: () => void) => (e: MouseEvent) => { e.stopPropagation(); fn(); };

  // Play the "pop + burst" animation only when a like is newly added (not on first render / unlike).
  const [burst, setBurst] = useState(0);
  const prevLiked = useRef(liked);
  useEffect(() => {
    if (liked && !prevLiked.current) setBurst((n) => n + 1);
    prevLiked.current = liked;
  }, [liked]);

  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('Copy this review link:', shareUrl);
    }
  };

  const shareTo = (target: 'facebook' | 'whatsapp' | 'instagram') => {
    if (target === 'instagram') {
      void copyLink();
      window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
      return;
    }
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedTitle = encodeURIComponent(reviewTitle);
    const url = target === 'facebook'
      ? `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`
      : `https://wa.me/?text=${encodeURIComponent(`${reviewTitle} — ${shareUrl}`)}`;
    void encodedTitle;
    window.open(url, '_blank', 'noopener,noreferrer');
    setShareOpen(false);
  };

  return (
    <div className={`engagement-bar ${big ? 'engagement-bar-lg' : ''}`} onClick={(e) => e.stopPropagation()}>
      <button type="button" className={`${base} ${liked ? 'is-on' : ''}`} onClick={stop(onLike)} aria-pressed={liked} aria-label={liked ? 'Unlike' : 'Like'} title="Like">
        <span className="like-heart-wrap">
          <Heart key={burst} className={`${icon} ${liked ? 'fill-current like-heart-on' : ''}`} />
          {burst > 0 && liked && (
            <span key={`b${burst}`} className="like-burst" aria-hidden>
              {Array.from({ length: 8 }).map((_, i) => <i key={i} style={{ ['--a' as string]: `${i * 45}deg` }} />)}
              <b className="like-ring" />
            </span>
          )}
        </span>
        <span>{stats.likeCount}{big && <span className="engagement-label"> {stats.likeCount === 1 ? 'like' : 'likes'}</span>}</span>
      </button>
      <button type="button" className={base} onClick={stop(onRate)} aria-label="Rate this review" title="Rate">
        <Star className={icon} />
        <span>{stats.ratingCount}{big && <span className="engagement-label"> {stats.ratingCount === 1 ? 'rating' : 'ratings'}</span>}</span>
      </button>
      <button type="button" className={base} onClick={stop(onReview)} aria-label="Write a review" title="Review">
        <MessageCircle className={icon} />
        <span>{stats.reviewCount}{big && <span className="engagement-label"> {stats.reviewCount === 1 ? 'review' : 'reviews'}</span>}</span>
      </button>
      {big && (
        <>
          <button type="button" className={base} onClick={(e) => { e.stopPropagation(); void copyLink(); }} aria-label="Copy review link" title="Copy link">
            {copied ? <Check className={icon} /> : <Copy className={icon} />}
            <span>{copied ? 'Copied' : 'Copy link'}</span>
          </button>
          <div className="relative">
            <button type="button" className={base} onClick={(e) => { e.stopPropagation(); setShareOpen((v) => !v); }} aria-expanded={shareOpen} aria-label="Share review" title="Share">
              <Share2 className={icon} />
              <span>Share</span>
            </button>
            {shareOpen && (
              <div className="absolute z-20 bottom-full left-0 mb-2 min-w-[170px] rounded-xl p-2 shadow-lg" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                <button type="button" className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium hover:bg-black/5" onClick={() => shareTo('instagram')}>Instagram</button>
                <button type="button" className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium hover:bg-black/5" onClick={() => shareTo('facebook')}>Facebook</button>
                <button type="button" className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium hover:bg-black/5" onClick={() => shareTo('whatsapp')}>WhatsApp</button>
              </div>
            )}
          </div>
        </>
      )}
      {nlRating !== null && (
        <span className="engagement-nl-rating" title="Novelty Library rating">
          {big ? <NlLogo className="engagement-nl-logo" /> : <Star className="engagement-nl-logo engagement-nl-star" fill="currentColor" strokeWidth={1.5} aria-hidden />}
          <b>NL</b> {nlRating.toFixed(1)}
        </span>
      )}
    </div>
  );
}
