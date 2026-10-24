import { useEffect } from 'react';
import { go } from '@/lib/router';
import { ArrowLeft } from 'lucide-react';
import { usePublished } from '@/lib/readerTools';
import { ReviewerProfileView } from '@/components/ReviewerProfileView';
import { reviewerFollowKey, reviewerPath, useReviewerProfile } from '@/lib/reviewers';
import { usePageNoIndex } from '@/lib/seo';
import { EmptyStateFeed } from '@/components/EmptyStateFeed';

/**
 * Reviewer without a Novelty Library account (reviews grouped by their private e-mail -> public unique ID), shown with the
 * same teal reader profile card as everyone else. Account holders are sent to their @username profile.
 */
export function ReviewerPage({ uid, navigate }: { uid: string; navigate: (path: string) => void }) {
  const all = usePublished();
  const { profile, ready } = useReviewerProfile(all, uid);
  usePageNoIndex(!profile, uid);

  // A reviewer who later made an account has one real profile: send everyone there.
  useEffect(() => {
    if (profile?.hasAccount && profile.username) go(reviewerPath(profile), true);
  }, [profile]);

  const back = <button type="button" onClick={() => { if (window.history.length > 1) window.history.back(); else navigate('/reviewers'); }} className="nl-qv-link inline-flex items-center gap-1.5 mb-4"><ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back</button>;

  if (!profile) {
    const missing = ready || all.length > 0;
    if (missing) return <EmptyStateFeed title="Reviewer page not available" message="That reviewer page does not exist or has no published reviews. Browse every reviewer, or read the latest reviews below." navigate={navigate} />;
    return (
      <div className="pt-24 pb-20 container-prose animate-fade-in">
        {back}
        <p className="nl-find-hint">Loading reviewer…</p>
      </div>
    );
  }

  return (
    <div className="pt-24 pb-20 container-prose animate-fade-in">
      {back}
      <ReviewerProfileView
        name={profile.name}
        username={profile.username}
        uid={profile.uid}
        instagram={profile.instagram}
        reviews={profile.reviews}
        followKey={reviewerFollowKey({ uid: profile.uid })}
        shareUrl={`${window.location.origin}/reviewer/${encodeURIComponent(profile.uid)}`}
        navigate={navigate}
      />
    </div>
  );
}
