import type { Review } from '@/types/review';
import { NlLogo } from '@/components/NlLogo';
import { CoverImg } from '@/components/CoverImg';
import { RwStarRating } from '@/components/RwStarRating';
import { normalizePosterUrl } from '@/lib/posterUrl';
import { safeExternalUrl, sanitizeUserText } from '@/lib/sanitize';
import { normalizeVerdict, verdictLabel } from '@/lib/verdict';

function firstLines(text: string, max = 150): string {
  const clean = sanitizeUserText(text, 600).replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  return `${cut.slice(0, Math.max(0, cut.lastIndexOf(' '))).replace(/[,.;:\s]+$/, '')}…`;
}

/**
 * One review as a 1:1 poster, drawn in the same deep-teal / cyan language as the shareable review card:
 * brand strip, cover with a glow, verdict and stars, a short pull-quote, and the reviewer line.
 * The whole poster is a single button that opens the review.
 */
export function HomeReviewPoster({ review, onOpen }: { review: Review; onOpen: () => void }) {
  const v = normalizeVerdict(review.verdict);
  const art = safeExternalUrl(normalizePosterUrl(review.cover_image_url || review.poster_url));
  const title = sanitizeUserText(review.title, 140);
  const reviewer = sanitizeUserText(review.reviewer_name || review.novelty_username || 'Community reader', 60);
  return (
    <button type="button" className="nl-hp" onClick={onOpen} aria-label={`Read the review of ${title}`}>
      {art ? <span className="nl-hp-bg" style={{ backgroundImage: `url("${art}")` }} aria-hidden="true" /> : null}
      <span className="nl-hp-scrim" aria-hidden="true" />
      <span className="nl-hp-top">
        <span className="nl-hp-brand"><NlLogo className="nl-hp-logo" /> Novelty Library</span>
        {v ? <span className={`nl-hp-verdict is-${v}`}>{verdictLabel(v)}</span> : null}
      </span>
      <span className="nl-hp-main">
        <span className="nl-hp-cover"><CoverImg src={review.cover_image_url || review.poster_url} alt={`Cover for ${title}`} /></span>
        <span className="nl-hp-info">
          <span className="nl-hp-genre">{sanitizeUserText(review.genre || 'Community review', 40)}</span>
          <strong className="nl-hp-title">{title}</strong>
          <span className="nl-hp-author">by {sanitizeUserText(review.author || 'Unknown author', 70)}</span>
          {Number.isFinite(Number(review.rw_rating)) && review.rw_rating != null ? <span className="nl-hp-rate"><RwStarRating value={Number(review.rw_rating)} size={13} /><b>{Number(review.rw_rating).toFixed(1)}</b><i>/10</i></span> : null}
        </span>
      </span>
      <span className="nl-hp-quote"><q>{firstLines(review.review_text)}</q></span>
      <span className="nl-hp-foot"><span>Reviewed by {reviewer}</span><em>Read review →</em></span>
    </button>
  );
}
