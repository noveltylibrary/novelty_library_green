import { Bookmark, BookmarkCheck, Clock, Globe, Star } from 'lucide-react';
import type { Review } from '@/types/review';
import { VERDICTS, normalizeVerdict } from '@/lib/verdict';
import { readingMinutes, useSavedReviews } from '@/lib/readerTools';
import { sanitizeUserText } from '@/lib/sanitize';

/** Review page: the whole verdict at a glance, plus Save for later. */
export function QuickVerdict({ review, nl, navigate }: { review: Review; nl: number | null; navigate: (path: string) => void }) {
  const { isSaved, toggle, ids } = useSavedReviews();
  const v = normalizeVerdict(review.verdict);
  const meta = v ? VERDICTS.find((x) => x.value === v) : null;
  const saved = isSaved(review.id);
  const rw = Number.isFinite(review.rw_rating) ? review.rw_rating.toFixed(1) : '—';

  return (
    <aside className="nl-qv" aria-label="Quick verdict">
      <div className={`nl-qv-main${v ? ` is-${v}` : ''}`}>
        <span className="nl-qv-kicker">Quick verdict</span>
        <strong>{meta ? meta.label : 'Reviewed'}</strong>
        <small>{meta ? meta.blurb : 'A reader’s honest take'}</small>
      </div>
      <dl className="nl-qv-stats">
        <div><dt>R/W</dt><dd><Star aria-hidden="true" />{rw}<i>/10</i></dd></div>
        {nl !== null && <div><dt>NL</dt><dd><Star aria-hidden="true" />{nl.toFixed(1)}<i>/10</i></dd></div>}
        <div><dt>Genre</dt><dd className="is-text">{sanitizeUserText(review.genre, 40) || '—'}</dd></div>
        <div><dt>Language</dt><dd className="is-text"><Globe aria-hidden="true" />{sanitizeUserText(review.language, 30) || '—'}</dd></div>
        <div><dt>Read time</dt><dd className="is-text"><Clock aria-hidden="true" />{readingMinutes(review.review_text)} min</dd></div>
      </dl>
      <div className="nl-qv-actions">
        <button type="button" className={`nl-qv-save${saved ? ' is-on' : ''}`} onClick={() => toggle(review.id)} aria-pressed={saved}>
          {saved ? <BookmarkCheck aria-hidden="true" /> : <Bookmark aria-hidden="true" />}{saved ? 'Saved' : 'Save for later'}
        </button>
        {ids.length > 0 && <button type="button" className="nl-qv-link" onClick={() => navigate('/saved')}>My list ({ids.length})</button>}
      </div>
    </aside>
  );
}
