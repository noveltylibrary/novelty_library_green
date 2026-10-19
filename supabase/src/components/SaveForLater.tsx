import { Bookmark, BookmarkCheck } from 'lucide-react';
import { useSavedReviews } from '@/lib/readerTools';

/** Review page, under "Share as card": keep a review in "My list" (stored in this browser only). */
export function SaveForLater({ reviewId, navigate }: { reviewId: string; navigate: (path: string) => void }) {
  const { isSaved, toggle, ids } = useSavedReviews();
  const saved = isSaved(reviewId);
  return (
    <div className="mt-3">
      <button type="button" className={`nl-share-btn nl-save-btn w-full${saved ? ' is-on' : ''}`} onClick={() => toggle(reviewId)} aria-pressed={saved}>
        {saved ? <BookmarkCheck className="w-4 h-4" aria-hidden="true" /> : <Bookmark className="w-4 h-4" aria-hidden="true" />} {saved ? 'Saved to my list' : 'Save for later'}
      </button>
      {ids.length > 0 && <button type="button" className="nl-qv-link block mx-auto mt-2" onClick={() => navigate('/saved')}>My list ({ids.length})</button>}
    </div>
  );
}
