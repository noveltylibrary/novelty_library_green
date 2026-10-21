import { useMemo } from 'react';
import { CoverImg } from '@/components/CoverImg';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { authorKey, reviewPath, usePublished } from '@/lib/readerTools';
import { VerdictBanner } from '@/components/VerdictBanner';
import { sanitizeUserText } from '@/lib/sanitize';
import { FollowButton } from '@/components/FollowButton';
import { RoleRibbon } from '@/components/RoleTag';
import { NameBlock, nameInitial } from '@/components/NameBlock';
import { PeopleCard } from '@/components/PeopleCard';
import { AuthorBioBlock } from '@/components/AuthorBioBlock';
import { summarizeReviews, useAuthorFollow } from '@/lib/authors';

export function AuthorPage({ name, navigate }: { name: string; navigate: (path: string) => void }) {
  const all = usePublished();
  const key = authorKey(name);
  const follow = useAuthorFollow(key, navigate);
  const books = useMemo(() => all.filter((r) => authorKey(r.author || '') === key).sort((a, b) => (b.rw_rating || 0) - (a.rw_rating || 0)), [all, key]);
  const display = (books[0]?.author || name).trim();
  const stats = useMemo(() => summarizeReviews(books), [books]);
  const shareUrl = `${window.location.origin}/author/${encodeURIComponent(display)}`;

  return (
    <div className="pt-24 pb-20 container-prose animate-fade-in">
      <button type="button" onClick={() => { if (window.history.length > 1) window.history.back(); else navigate('/reviews'); }} className="nl-qv-link inline-flex items-center gap-1.5 mb-4"><ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back</button>
      <RoleRibbon role="author" note="Author profile on Novelty Library" />
      <header className="nl-author-head nl-author-head-v2">
        <span className="nl-author-avatar" aria-hidden="true">{nameInitial(display, 'A', 'last')}</span>
        <div className="nl-author-id">
          <NameBlock major="last" name={display} size={44} color="var(--color-text)" restColor="var(--color-text-muted)" />
          <div className="nl-author-pills">
            {follow.followers != null && <span className="nl-author-pill"><b>{follow.followers.toLocaleString()}</b> {follow.followers === 1 ? 'follower' : 'followers'}</span>}
            <span className="nl-author-pill"><b>{stats.count}</b> {stats.count === 1 ? 'review' : 'reviews'}</span>
            {stats.avgRw != null && <span className="nl-author-pill">avg R/W <b>{stats.avgRw.toFixed(1)}</b>/10</span>}
          </div>
          {(stats.genres.length > 0 || stats.languages.length > 0) && <p className="nl-author-meta">{[...stats.genres.slice(0, 4), ...stats.languages.slice(0, 2)].join(' · ')}</p>}
          {!all.length && <p className="nl-author-meta">Loading reviews…</p>}
        </div>
        <div className="nl-author-follow"><FollowButton following={follow.following} busy={follow.busy} onClick={() => void follow.toggle()} label={sanitizeUserText(display, 60)} /></div>
      </header>

      {books.length > 0 && <AuthorBioBlock name={display} reviewedTitles={books.map((b) => b.title || '')} />}

      {books.length > 0 && (
        <section className="nl-people-section" aria-label={`${display} profile card`}>
          <PeopleCard variant="author" name={display} followers={follow.followers} stats={stats} fileSlug={key.replace(/\s+/g, '-')} shareUrl={shareUrl} />
        </section>
      )}

      {all.length > 0 && books.length === 0 && <p className="nl-find-hint">No published reviews of this author yet.</p>}
      {books.length > 0 && <h2 className="nl-people-h2">Reviews of Books by {sanitizeUserText(display, 80)}</h2>}
      <ul className="nl-find-list">
        {books.map((r) => {
          const cover = r.poster_url || r.cover_image_url;
          return (
            <li key={r.id} className="nl-find-result">
              <button type="button" className="nl-find-result-main" onClick={() => navigate(reviewPath(r))} aria-label={`Open review of ${r.title}`}>
                <span className="nl-find-cover"><CoverImg src={cover} /></span>
                <span className="nl-find-copy">
                  <strong>{sanitizeUserText(r.title, 120)}</strong>
                  <small>{sanitizeUserText(r.genre, 40)}{r.language ? ` · ${sanitizeUserText(r.language, 30)}` : ''}</small>
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
