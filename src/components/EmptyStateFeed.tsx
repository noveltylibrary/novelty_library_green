import { useMemo, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Library, PenTool, Trophy, Users } from 'lucide-react';
import { CoverImg } from '@/components/CoverImg';
import { VerdictBanner } from '@/components/VerdictBanner';
import { reviewPath, usePublished } from '@/lib/readerTools';
import { sanitizeUserText } from '@/lib/sanitize';

const excerpt = (text: string, max = 260): string => {
  const clean = sanitizeUserText((text || '').replace(/\s+/g, ' ').trim(), 2000);
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 120))}…`;
};

/**
 * Standard "nothing here" screen for dynamic routes (missing review, unknown username / author / genre, empty search).
 * Never a blank page: a clear message, quick links into the main feed, and a carousel of the latest published reviews with
 * real review text, so visitors and crawlers always land on substantial content.
 */
/** Carousel of the latest published reviews, each with a real text excerpt. */
export function LatestReviewsRail({ heading = 'Latest reviews' }: { heading?: string }) {
  const all = usePublished();
  const recent = useMemo(() => [...all].sort((a, b) => String(b.published_at || b.created_at || '').localeCompare(String(a.published_at || a.created_at || ''))).slice(0, 8), [all]);
  if (!recent.length) return null;
  return (
    <section className="nl-empty-recent" aria-labelledby="nl-empty-recent-h">
      <h2 id="nl-empty-recent-h" className="font-serif text-xl font-semibold" style={{ color: 'var(--color-text)' }}>{heading}</h2>
      <ul className="nl-empty-rail">
        {recent.map((r) => (
          <li key={r.id} className="nl-empty-card">
            <a href={reviewPath(r)} className="nl-empty-card-link">
              <span className="nl-empty-cover"><CoverImg src={r.poster_url || r.cover_image_url} /></span>
              <strong>{sanitizeUserText(r.title, 120)}</strong>
              <small>{sanitizeUserText(r.author, 80)}{r.genre ? ` · ${sanitizeUserText(r.genre, 40)}` : ''}</small>
              {r.verdict && <span className="nl-find-why"><VerdictBanner verdict={r.verdict} size="compact" /></span>}
              <span className="nl-empty-excerpt">{excerpt(r.review_text)}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function EmptyStateFeed({ title, message, navigate, backLabel = 'Back to Reviews', children }: { title: string; message: ReactNode; navigate: (path: string) => void; backLabel?: string; children?: ReactNode }) {
  const all = usePublished();
  const total = all.length;

  return (
    <div className="pt-28 pb-20 container-prose animate-fade-in">
      <div className="nl-empty-head">
        <BookOpen className="nl-empty-ic" aria-hidden="true" />
        <h1 className="font-serif text-2xl md:text-3xl font-semibold" style={{ color: 'var(--color-text)' }}>{title}</h1>
        <p className="nl-empty-msg">{message}</p>
        {children}
        <div className="nl-empty-actions">
          <button type="button" className="btn-primary !w-auto" onClick={() => navigate('/reviews')}>{total > 0 ? `Browse all ${total} reviews` : 'Browse all reviews'} <ArrowRight className="w-4 h-4" aria-hidden="true" /></button>
          <button type="button" className="btn-ghost" onClick={() => navigate('/')}><ArrowLeft className="w-4 h-4" aria-hidden="true" /> {backLabel === 'Back to Reviews' ? 'Home' : backLabel}</button>
        </div>
        <nav className="nl-empty-links" aria-label="Quick links">
          <a href="/reviews"><BookOpen aria-hidden="true" />Reviews</a>
          <a href="/authors"><PenTool aria-hidden="true" />Authors</a>
          <a href="/reviewers"><Users aria-hidden="true" />Reviewers</a>
          <a href="/genres"><Library aria-hidden="true" />Genres</a>
          <a href="/live-rankings"><Trophy aria-hidden="true" />Live Rankings</a>
        </nav>
      </div>

      <LatestReviewsRail />
    </div>
  );
}
