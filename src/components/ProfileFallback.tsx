import { useEffect, useMemo, useState } from 'react';
import { loadPublished } from '@/lib/readerTools';
import { buildReviewerProfiles, instagramOf, reviewerFollowKey, useReviewerIndex } from '@/lib/reviewers';
import { ReviewerProfileView } from '@/components/ReviewerProfileView';
import { usePageNoIndex } from '@/lib/seo';
import { sanitizeUserText } from '@/lib/sanitize';
import { EmptyStateFeed } from '@/components/EmptyStateFeed';
import { BackButton } from '@/components/BackButton';
import type { Review } from '@/types/review';

/**
 * Shown when /profile/@name has no public reader profile. If that username wrote published reviews, the reviewer card is
 * shown instead (so a reviewer link from a review never lands on "Profile not found"). Otherwise the usual not-found page,
 * kept out of search / ad crawling.
 */
export function ProfileFallback({ username, navigate }: { username: string; navigate: (path: string) => void }) {
  const handle = username.replace(/^@/, '').trim();
  const [all, setAll] = useState<Review[] | null>(null);
  const rows = useReviewerIndex();
  useEffect(() => {
    let alive = true;
    loadPublished().then((r) => { if (alive) setAll(r); }).catch(() => { if (alive) setAll([]); });
    return () => { alive = false; };
  }, []);

  const found = useMemo(() => {
    if (!all) return null;
    const lower = handle.toLowerCase();
    const byIndex = buildReviewerProfiles(all, rows).find((p) => (p.username || '').replace(/^@/, '').toLowerCase() === lower);
    if (byIndex) return { name: byIndex.name, uid: byIndex.uid, instagram: byIndex.instagram, reviews: byIndex.reviews };
    const reviews = all.filter((r) => (r.novelty_username || '').replace(/^@/, '').trim().toLowerCase() === lower).sort((a, b) => (b.rw_rating || 0) - (a.rw_rating || 0));
    if (!reviews.length) return null;
    return { name: reviews.find((r) => r.reviewer_name)?.reviewer_name?.trim() || handle, uid: null, instagram: instagramOf(reviews), reviews };
  }, [all, rows, handle]);

  usePageNoIndex(!found, handle);

  if (found) {
    return (
      <div className="pt-24 pb-20 container-prose animate-fade-in">
        <div className="max-w-4xl mx-auto"><BackButton navigate={navigate} /></div>
        <ReviewerProfileView
          name={found.name}
          username={handle}
          uid={found.uid}
          instagram={found.instagram}
          reviews={found.reviews}
          followKey={reviewerFollowKey({ uid: found.uid, username: handle })}
          shareUrl={`${window.location.origin}/profile/@${encodeURIComponent(handle)}`}
          navigate={navigate}
        />
      </div>
    );
  }

  if (!all) return <div className="pt-32 pb-20 container-prose text-center">Loading profile…</div>;
  return <EmptyStateFeed title="Profile not found" message={`${sanitizeUserText(`@${handle}`, 90)} is not attached to a public account. Browse the review feed, or read the latest reviews below.`} navigate={navigate} />;
}
