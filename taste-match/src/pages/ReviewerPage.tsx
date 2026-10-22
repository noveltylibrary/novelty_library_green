import { useEffect } from 'react';
import { CoverImg } from '@/components/CoverImg';
import { go } from '@/lib/router';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { reviewPath, usePublished } from '@/lib/readerTools';
import { VerdictBanner } from '@/components/VerdictBanner';
import { sanitizeUserText } from '@/lib/sanitize';
import { RoleRibbon } from '@/components/RoleTag';
import { NameBlock } from '@/components/NameBlock';
import { PeopleCard } from '@/components/PeopleCard';
import { reviewerPath, shortReviewerId, useReviewerProfile } from '@/lib/reviewers';

/** Reviewer without a Novelty Library account (reviews grouped by their private e-mail -> public unique ID). Account holders are sent to their @username profile. */
export function ReviewerPage({ uid, navigate }: { uid: string; navigate: (path: string) => void }) {
  const all = usePublished();
  const { profile, ready } = useReviewerProfile(all, uid);

  // A reviewer who later made an account has one real profile: send everyone there.
  useEffect(() => {
    if (profile?.hasAccount && profile.username) go(reviewerPath(profile), true);
  }, [profile]);

  const back = <button type="button" onClick={() => { if (window.history.length > 1) window.history.back(); else navigate('/reviewers'); }} className="nl-qv-link inline-flex items-center gap-1.5 mb-4"><ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back</button>;

  if (!profile) {
    return (
      <div className="pt-24 pb-20 container-prose animate-fade-in">
        {back}
        <p className="nl-find-hint">{ready || all.length > 0 ? 'This reviewer page is not available.' : 'Loading reviewer…'}</p>
      </div>
    );
  }

  const shareUrl = `${window.location.origin}/reviewer/${encodeURIComponent(profile.uid)}`;
  return (
    <div className="pt-24 pb-20 container-prose animate-fade-in">
      {back}
      <RoleRibbon role="reviewer" note="Reviewer profile on Novelty Library" />
      <header className="nl-author-head nl-author-head-v2 is-reviewer">
        <span className="nl-author-avatar" aria-hidden="true">{sanitizeUserText(profile.name, 120).charAt(0).toUpperCase() || 'R'}</span>
        <div className="nl-author-id">
          <NameBlock name={profile.name} size={44} color="var(--color-text)" restColor="var(--color-text-muted)" />
          <div className="nl-author-pills">
            <span className="nl-author-pill"><b>{profile.count}</b> {profile.count === 1 ? 'review' : 'reviews'}</span>
            {profile.avgRw != null && <span className="nl-author-pill">avg R/W given <b>{profile.avgRw.toFixed(1)}</b>/10</span>}
            <span className="nl-author-pill">ID <b>{shortReviewerId(profile.uid)}</b></span>
          </div>
          {profile.genres.length > 0 && <p className="nl-author-meta">{profile.genres.slice(0, 5).join(' · ')}</p>}
        </div>
      </header>

      <section className="nl-people-section" aria-label={`${profile.name} profile card`}>
        <PeopleCard variant="reviewer" name={profile.name} handle={profile.username} stats={profile} fileSlug={shortReviewerId(profile.uid).toLowerCase()} shareUrl={shareUrl} />
      </section>

      <h2 className="nl-people-h2">Reviews by {sanitizeUserText(profile.name, 80)}</h2>
      <ul className="nl-find-list">
        {profile.reviews.map((r) => {
          const cover = r.poster_url || r.cover_image_url;
          return (
            <li key={r.id} className="nl-find-result">
              <button type="button" className="nl-find-result-main" onClick={() => navigate(reviewPath(r))} aria-label={`Open review of ${r.title}`}>
                <span className="nl-find-cover"><CoverImg src={cover} /></span>
                <span className="nl-find-copy">
                  <strong>{sanitizeUserText(r.title, 120)}</strong>
                  <small>{sanitizeUserText(r.author, 80)}{r.genre ? ` · ${sanitizeUserText(r.genre, 40)}` : ''}</small>
                  {r.verdict && <span className="nl-find-why"><VerdictBanner verdict={r.verdict} size="compact" /></span>}
                </span>
              </button>
              <span className="nl-find-score"><b>{Number.isFinite(r.rw_rating) ? r.rw_rating.toFixed(1) : '—'}</b><small>R/W</small></span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
