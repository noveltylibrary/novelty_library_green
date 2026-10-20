import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import { authorPath, usePublished } from '@/lib/readerTools';
import { buildAuthorProfiles, fetchAuthorFollowerCounts } from '@/lib/authors';
import { buildReviewerProfiles, reviewerPath, shortReviewerId, useReviewerIndex } from '@/lib/reviewers';
import { RoleTag } from '@/components/RoleTag';
import { sanitizeUserText } from '@/lib/sanitize';

type Tab = 'authors' | 'reviewers';

/** Directory of every author and every reviewer, so each profile page is reachable (and crawlable) from one place. */
export function PeoplePage({ tab, navigate }: { tab: Tab; navigate: (path: string) => void }) {
  const all = usePublished();
  const index = useReviewerIndex();
  const [query, setQuery] = useState('');
  const [counts, setCounts] = useState<Record<string, number>>({});
  useEffect(() => { let alive = true; void fetchAuthorFollowerCounts().then((c) => { if (alive) setCounts(c); }).catch(() => undefined); return () => { alive = false; }; }, []);

  const authors = useMemo(() => buildAuthorProfiles(all).sort((a, b) => (counts[b.key] ?? 0) - (counts[a.key] ?? 0) || b.count - a.count || a.name.localeCompare(b.name)), [all, counts]);
  const reviewers = useMemo(() => buildReviewerProfiles(all, index).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)), [all, index]);
  const q = query.trim().toLowerCase();
  const shownAuthors = q ? authors.filter((a) => a.name.toLowerCase().includes(q)) : authors;
  const shownReviewers = q ? reviewers.filter((r) => r.name.toLowerCase().includes(q) || (r.username || '').toLowerCase().includes(q) || shortReviewerId(r.uid).toLowerCase().includes(q)) : reviewers;
  const hasCounts = Object.keys(counts).length > 0;

  return (
    <div className="pt-24 pb-20 container-prose animate-fade-in">
      <button type="button" onClick={() => navigate('/reviews')} className="nl-qv-link inline-flex items-center gap-1.5 mb-4"><ArrowLeft className="w-4 h-4" aria-hidden="true" /> Reviews</button>
      <h1 className="font-serif text-3xl md:text-4xl font-semibold" style={{ color: 'var(--color-text)' }}>{tab === 'authors' ? 'Authors' : 'Reviewers'}</h1>
      <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
        {tab === 'authors' ? 'Every author reviewed on Novelty Library, with follower counts.' : 'Every reader who has a published review, grouped by their unique reviewer ID.'}
      </p>
      <div className="nl-people-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'authors'} className={tab === 'authors' ? 'is-on' : ''} onClick={() => navigate('/authors')}>Authors <span>{authors.length}</span></button>
        <button type="button" role="tab" aria-selected={tab === 'reviewers'} className={tab === 'reviewers' ? 'is-on' : ''} onClick={() => navigate('/reviewers')}>Reviewers <span>{reviewers.length}</span></button>
      </div>
      <label className="nl-people-search"><Search aria-hidden="true" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tab === 'authors' ? 'Search authors' : 'Search reviewers, @username or ID'} aria-label="Search" /></label>

      <ul className="nl-people-list">
        {tab === 'authors' && shownAuthors.map((a) => (
          <li key={a.key}>
            <button type="button" className="nl-people-row is-author" onClick={() => navigate(authorPath(a.name))}>
              <span className="nl-people-row-avatar" aria-hidden="true">{sanitizeUserText(a.name, 120).charAt(0).toUpperCase()}</span>
              <span className="nl-people-row-copy"><strong>{sanitizeUserText(a.name, 120)}</strong><small>{a.count} {a.count === 1 ? 'review' : 'reviews'}{a.avgRw != null ? ` · avg R/W ${a.avgRw.toFixed(1)}` : ''}{hasCounts ? ` · ${(counts[a.key] ?? 0).toLocaleString()} ${(counts[a.key] ?? 0) === 1 ? 'follower' : 'followers'}` : ''}</small></span>
              <RoleTag role="author" size="sm" />
            </button>
          </li>
        ))}
        {tab === 'reviewers' && shownReviewers.map((r) => (
          <li key={r.uid}>
            <button type="button" className="nl-people-row is-reviewer" onClick={() => navigate(reviewerPath(r))}>
              <span className="nl-people-row-avatar" aria-hidden="true">{sanitizeUserText(r.name, 120).charAt(0).toUpperCase()}</span>
              <span className="nl-people-row-copy"><strong>{sanitizeUserText(r.name, 120)}</strong><small>{r.username ? `@${sanitizeUserText(r.username, 40)} · ` : ''}ID {shortReviewerId(r.uid)} · {r.count} {r.count === 1 ? 'review' : 'reviews'}{r.avgRw != null ? ` · avg R/W ${r.avgRw.toFixed(1)}` : ''}</small></span>
              <RoleTag role="reviewer" size="sm" />
            </button>
          </li>
        ))}
      </ul>
      {tab === 'reviewers' && all.length > 0 && index.length === 0 && <p className="nl-find-hint">Reviewer profiles are coming soon.</p>}
      {all.length > 0 && ((tab === 'authors' && !shownAuthors.length) || (tab === 'reviewers' && index.length > 0 && !shownReviewers.length)) && <p className="nl-find-hint">Nothing matches “{sanitizeUserText(query, 60)}”.</p>}
    </div>
  );
}
