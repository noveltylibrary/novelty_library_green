import { useEffect, useMemo, useState } from 'react';
import { Check, Flag, Share2, UserCheck, UserPlus, X } from 'lucide-react';
import { ProfileCard, type ProfileCardData } from '@/components/ProfileCard';
import { FollowStatsBar } from '@/components/ConnectionsBar';
import { CoverImg } from '@/components/CoverImg';
import { VerdictBanner } from '@/components/VerdictBanner';
import { summarizeReviews, useAuthorFollow } from '@/lib/authors';
import { useAuth } from '@/lib/auth';
import { REPORT_REASONS, createGrievance, type ReportReason } from '@/lib/moderation';
import { useOverlayHistory } from '@/lib/overlayHistory';
import { fetchShelfCommunityInfo, averageNlRating, type ShelfCommunityInfo } from '@/lib/profileShelf';
import { reviewPath } from '@/lib/readerTools';
import { safeExternalUrl, sanitizeUserText } from '@/lib/sanitize';
import { cleanInstagramHandle } from '@/lib/links';
import { reviewNoOf, shortReviewerId } from '@/lib/reviewers';
import type { Review } from '@/types/review';

export interface ReviewerViewProps {
  name: string;
  /** Novelty Library @username when the reviewer has (or had) one. */
  username: string | null;
  /** Private-email-derived public ID (never an e-mail address). Null when only a username is known. */
  uid: string | null;
  /** Instagram handle the reviewer agreed to show on their public reviews. */
  instagram: string;
  reviews: Review[];
  followKey: string;
  shareUrl: string;
  navigate: (path: string) => void;
}

/**
 * Public card for a reviewer. It is the reader profile card (teal / cyan) with the same Follow / Replay / Report / Share row
 * and followers bar, fed from the reviewer's published reviews. Used for reviewers without an account (/reviewer/<id>) and
 * for @usernames whose reader profile is not public, so a reviewer link never ends on an empty page.
 */
export function ReviewerProfileView({ name, username, uid, instagram, reviews, followKey, shareUrl, navigate }: ReviewerViewProps) {
  const { user } = useAuth();
  const follow = useAuthorFollow(followKey, navigate);
  const stats = useMemo(() => summarizeReviews(reviews), [reviews]);

  const [shelf, setShelf] = useState<Record<string, ShelfCommunityInfo>>({});
  useEffect(() => {
    let alive = true;
    if (!reviews.length) { setShelf({}); return; }
    void fetchShelfCommunityInfo(reviews.slice(0, 12).map((r) => ({ reviewNo: reviewNoOf(r), title: r.title, author: r.author }))).then((m) => { if (alive) setShelf(m); }).catch(() => undefined);
    return () => { alive = false; };
  }, [reviews]);

  const [shared, setShared] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>(REPORT_REASONS[0]);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useOverlayHistory(reportOpen, () => { if (!busy) setReportOpen(false); });

  const display = sanitizeUserText(name, 120) || 'Novelty Reader';
  const cardData: ProfileCardData = useMemo(() => ({
    name: display,
    username: username ? sanitizeUserText(username.replace(/^@/, ''), 80) : null,
    handleLabel: username ? null : (uid ? `Reviewer ID ${shortReviewerId(uid)}` : 'Reviewer'),
    roleLabel: 'Reviewer',
    followerCount: follow.followers,
    avatarUrl: null,
    headerImageUrl: null,
    socialLinks: [],
    instagram: cleanInstagramHandle(instagram) || null,
    booksThisMonth: null,
    totalBooksRead: null,
    publishedBooks: stats.count,
    avgRating: stats.avgRw,
    avgNlRating: averageNlRating(reviews.map((r) => ({ nl: shelf[reviewNoOf(r)]?.nlRating }))),
    readingSince: null,
    favoriteBook: null,
    favoriteAuthor: null,
    favoriteGenre: null,
    extraTags: [
      ...(stats.languages.length ? [{ label: stats.languages.join(', '), tone: 'language' as const }] : []),
      ...(stats.genres.length ? [{ label: stats.genres.slice(0, 4).join(', '), tone: 'genre' as const }] : []),
    ],
    answers: {},
    questions: [],
    publishedReviews: reviews.slice(0, 6).map((r) => {
      const no = reviewNoOf(r);
      return { id: r.id, reviewNo: no || null, title: sanitizeUserText(r.title, 200) || 'Untitled review', author: sanitizeUserText(r.author, 160), coverUrl: safeExternalUrl(r.cover_image_url), posterUrl: shelf[no]?.posterUrl || safeExternalUrl(r.poster_url), nlRating: shelf[no]?.nlRating ?? null, rating: Number.isFinite(r.rw_rating) && r.rw_rating > 0 ? r.rw_rating : null };
    }),
  }), [display, username, uid, follow.followers, instagram, stats, reviews, shelf]);

  const share = async () => {
    try { if (navigator.share) { await navigator.share({ title: `${display} on Novelty Library`, url: shareUrl }); return; } } catch (e) { if ((e as Error)?.name === 'AbortError') return; }
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(shareUrl);
      else { const t = document.createElement('textarea'); t.value = shareUrl; t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
      setShared(true); window.setTimeout(() => setShared(false), 2200);
    } catch { /* clipboard blocked */ }
  };

  const submitReport = async () => {
    setBusy(true); setMessage(null);
    try {
      await createGrievance('Reviewer page report', `Report: ${display}`.slice(0, 160), `Reason: ${reason}\nReviewer page: ${shareUrl}\n\n${details.trim()}`);
      setMessage('Report submitted. Thank you.'); setDetails('');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not submit report.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-7">
      <ProfileCard
        data={cardData}
        header={<FollowStatsBar followers={follow.followers} following={null} hideFollowers={false} hideFollowing={false} isOwn={false} onOpen={() => undefined} followersOnly />}
        topActions={({ replay, replayKey }) => (
          <div className="nl-trio" role="group" aria-label="Reviewer actions">
            <button type="button" disabled={follow.busy} onClick={() => void follow.toggle()} aria-pressed={follow.following} aria-label={`${follow.following ? 'Unfollow' : 'Follow'} ${display}`} className={`nl-trio-btn nl-trio-follow ${follow.following ? 'is-following' : ''}`}>
              {follow.following ? <UserCheck aria-hidden="true" /> : <UserPlus aria-hidden="true" />}<span>{follow.following ? 'Following' : 'Follow'}</span>
            </button>
            <button type="button" onClick={replay} className="nl-trio-btn nl-trio-replay" aria-label="Replay animation">
              <svg key={replayKey} className="nl-ico-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg>
            </button>
            {user && <button type="button" onClick={() => { setMessage(null); setReportOpen(true); }} className="nl-trio-btn nl-trio-report" aria-label="Report this reviewer page" title="Report"><Flag aria-hidden="true" /></button>}
            <button type="button" onClick={() => void share()} className={`nl-trio-btn nl-trio-share ${shared ? 'is-done' : ''}`} aria-label="Share this reviewer">{shared ? <Check aria-hidden="true" /> : <Share2 aria-hidden="true" />}</button>
          </div>
        )}
      />

      <section aria-labelledby="nl-reviewer-reviews-h">
        <h2 id="nl-reviewer-reviews-h" className="nl-people-h2">Reviews by {display}</h2>
        <ul className="nl-find-list">
          {reviews.map((r) => (
            <li key={r.id} className="nl-find-result">
              <button type="button" className="nl-find-result-main" onClick={() => navigate(reviewPath(r))} aria-label={`Open review of ${sanitizeUserText(r.title, 120)}`}>
                <span className="nl-find-cover"><CoverImg src={r.poster_url || r.cover_image_url} /></span>
                <span className="nl-find-copy">
                  <strong>{sanitizeUserText(r.title, 120)}</strong>
                  <small>{sanitizeUserText(r.author, 80)}{r.genre ? ` · ${sanitizeUserText(r.genre, 40)}` : ''}</small>
                  {r.verdict && <span className="nl-find-why"><VerdictBanner verdict={r.verdict} size="compact" /></span>}
                </span>
              </button>
              <span className="nl-find-score"><b>{Number.isFinite(r.rw_rating) ? r.rw_rating.toFixed(1) : '—'}</b><small>R/W</small></span>
            </li>
          ))}
        </ul>
      </section>

      {reportOpen && (
        <div className="fixed inset-0 z-[100] grid place-items-center p-4 bg-black/45 backdrop-blur-sm" role="dialog" aria-modal="true" onClick={() => !busy && setReportOpen(false)}>
          <div className="w-full max-w-lg rounded-3xl p-6" style={{ background: 'var(--color-paper)', border: '1px solid var(--color-border)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2"><Flag className="w-5 h-5" style={{ color: 'var(--color-teal-dark)' }} /><h2 className="font-serif text-2xl font-semibold">Report this page</h2></div>
                <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Choose the closest reason. Reports go to the moderators for review.</p>
              </div>
              <button type="button" onClick={() => setReportOpen(false)} disabled={busy} aria-label="Close"><X className="w-5 h-5" /></button>
            </div>
            <div className="mt-5 space-y-4">
              <div><label className="label">What should be reported?</label><select value={reason} onChange={(e) => setReason(e.target.value as ReportReason)} className="input-field">{REPORT_REASONS.map((r) => <option key={r}>{r}</option>)}</select></div>
              <div><label className="label">Additional details (optional)</label><textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={2000} className="input-field min-h-28 resize-y" placeholder="Give moderators useful context." /></div>
              {message && <p className="text-sm" style={{ color: /submitted/i.test(message) ? 'var(--color-teal-dark)' : '#dc2626' }}>{message}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => setReportOpen(false)} disabled={busy} className="btn-ghost flex-1">Cancel</button>
                <button type="button" disabled={busy} onClick={() => void submitReport()} className="btn-primary flex-1">{busy ? 'Submitting…' : 'Submit report'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
