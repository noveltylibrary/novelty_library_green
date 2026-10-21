import { useMemo, useState, type ReactNode } from 'react';
import { BookOpen, CheckCircle, Clock, Languages, Layers, MessageCircleQuestion, Star, BookMarked } from 'lucide-react';
import type { AcceptedReviewCard } from '@/lib/reviews';
import { readingMinutes } from '@/lib/readerTools';
import { sanitizeUserText } from '@/lib/sanitize';

export type ProfileTabKey = 'reading' | 'questions' | 'published';

/** Instagram-style three-tab strip. The panes are rendered by the caller. */
export function ProfileTabs({ panes, initial = 'reading' }: { panes: Record<ProfileTabKey, ReactNode>; initial?: ProfileTabKey }) {
  const [tab, setTab] = useState<ProfileTabKey>(initial);
  const defs: { key: ProfileTabKey; label: string; Icon: typeof BookOpen }[] = [
    { key: 'reading', label: 'Reading', Icon: BookMarked },
    { key: 'questions', label: 'Questions', Icon: MessageCircleQuestion },
    { key: 'published', label: 'Reviews', Icon: CheckCircle },
  ];
  const onKey = (e: React.KeyboardEvent) => {
    const i = defs.findIndex((d) => d.key === tab);
    if (e.key === 'ArrowRight') setTab(defs[(i + 1) % defs.length].key);
    if (e.key === 'ArrowLeft') setTab(defs[(i + defs.length - 1) % defs.length].key);
  };
  return (
    <section className="nl-ptabs" aria-label="Profile">
      <div className="nl-ptabs-bar" role="tablist" onKeyDown={onKey}>
        {defs.map(({ key, label, Icon }) => (
          <button key={key} type="button" role="tab" id={`nl-ptab-${key}`} aria-selected={tab === key} aria-controls={`nl-ppane-${key}`} tabIndex={tab === key ? 0 : -1} aria-label={label} title={label} className={`nl-ptab ${tab === key ? 'is-on' : ''}`} onClick={() => setTab(key)}>
            <span className="nl-ptab-ic"><Icon aria-hidden="true" /></span>
          </button>
        ))}
      </div>
      <div key={tab} id={`nl-ppane-${tab}`} role="tabpanel" aria-labelledby={`nl-ptab-${tab}`} className="nl-ppane">{panes[tab]}</div>
    </section>
  );
}

export function TabEmpty({ icon, text }: { icon?: ReactNode; text: string }) {
  return <div className="nl-pempty">{icon ?? <BookOpen aria-hidden="true" />}<p>{text}</p></div>;
}

const tally = (values: string[]) => {
  const m = new Map<string, number>();
  for (const v of values) { const k = v.trim(); if (k) m.set(k, (m.get(k) || 0) + 1); }
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
};

/** The "tank" above the published reviews. Counts published reviews only. */
export function PublishedStats({ reviews, nlRatingForReview }: { reviews: AcceptedReviewCard[]; nlRatingForReview?: (review: AcceptedReviewCard) => number | null | undefined }) {
  const s = useMemo(() => {
    const rated = reviews.map((r) => nlRatingForReview?.(r)).filter((n): n is number => n != null && Number.isFinite(n) && n > 0);
    const genres = tally(reviews.map((r) => (r.genre || '').split(/[,/&]/)[0] || ''));
    const langs = tally(reviews.map((r) => r.language || ''));
    const mins = reviews.map((r) => readingMinutes(r.review || '')).filter((n) => n > 0);
    return {
      avg: rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : null,
      genres: genres.slice(0, 1),
      lang: langs[0] || null,
      langCount: langs.length,
      minutes: mins.length ? Math.max(1, Math.round(mins.reduce((a, b) => a + b, 0) / mins.length)) : null,
    };
  }, [reviews, nlRatingForReview]);
  if (!reviews.length) return null;
  const tile = (Icon: typeof Star, label: string, value: ReactNode, sub?: string) => (
    <div className="nl-pstat"><span className="nl-pstat-ic"><Icon aria-hidden="true" /></span><div className="min-w-0"><small>{label}</small><b>{value}</b>{sub && <em>{sub}</em>}</div></div>
  );
  return (
    <div className="nl-pstats" aria-label="Reading summary">
      {tile(CheckCircle, 'Reviews published', reviews.length)}
      {tile(Star, 'Average NL rating', s.avg != null ? `${s.avg.toFixed(1)}/10` : '—')}
      {tile(Layers, 'Most read genres', s.genres.length ? s.genres.map(([g]) => sanitizeUserText(g, 24)).join(', ') : '—')}
      {tile(Languages, 'Most reviewed language', s.lang ? sanitizeUserText(s.lang[0], 24) : '—', s.lang ? `${s.lang[1]} of ${reviews.length} review${reviews.length === 1 ? '' : 's'}` : undefined)}
      {tile(Clock, 'Average read time', s.minutes != null ? `${s.minutes} min` : '—', 'per review')}
    </div>
  );
}

/** Stats tank, then reviews capped at three with a "Show more" button. */
export function PublishedPanel({ reviews, renderReview, cap = 2, nlRatingForReview }: { reviews: AcceptedReviewCard[]; renderReview: (r: AcceptedReviewCard) => ReactNode; cap?: number; nlRatingForReview?: (review: AcceptedReviewCard) => number | null | undefined }) {
  const [all, setAll] = useState(false);
  if (!reviews.length) return <TabEmpty icon={<CheckCircle aria-hidden="true" />} text="No published reviews yet." />;
  const shown = all ? reviews : reviews.slice(0, cap);
  return (
    <div className="space-y-4">
      <PublishedStats reviews={reviews} nlRatingForReview={nlRatingForReview} />
      <div className="grid md:grid-cols-2 gap-4">{shown.map((r) => <div key={r.id} className="min-w-0">{renderReview(r)}</div>)}</div>
      {reviews.length > cap && (
        <div className="text-center"><button type="button" className="nl-more-btn" onClick={() => setAll((v) => !v)}>{all ? 'Show less' : `Show more (${reviews.length - cap})`}</button></div>
      )}
    </div>
  );
}
