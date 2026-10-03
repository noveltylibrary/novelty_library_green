import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, RefreshCw, Search, CheckCircle2, ExternalLink, Mail } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import type { Review } from '@/types/review';
import { fetchPublishedReviewsForAdmin } from '@/lib/reviews';
import { PosterImage } from '@/components/PosterImage';

interface Props { navigate: (path: string) => void; embedded?: boolean; }

function reviewNoValue(review: Review) {
  const n = Number(review.review_number ?? review.master_review_no);
  return Number.isFinite(n) ? n : -Infinity;
}

function publishDateValue(review: Review) {
  const value = review.published_on || review.published_at || review.created_at || '';
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : 0;
}

function prettyDate(value: string | null | undefined) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : value;
}

export function AdminCommunityReviewsPage({ navigate, embedded = false }: Props) {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await fetchPublishedReviewsForAdmin();
      setReviews(data.filter(r => r.is_published));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load Community Reviews');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (!authLoading && user && isAdmin) void load(); }, [authLoading, user, isAdmin, load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = q ? reviews.filter(r =>
      String(r.review_number ?? r.master_review_no ?? '').includes(q) ||
      r.title.toLowerCase().includes(q) ||
      r.author.toLowerCase().includes(q) ||
      (r.reviewer_name || '').toLowerCase().includes(q) ||
      (r.reviewer_handle || '').toLowerCase().includes(q) ||
      (r.reviewer_email || '').toLowerCase().includes(q)
    ) : reviews;
    return [...result].sort((a, b) => {
      const byDate = publishDateValue(b) - publishDateValue(a);
      return byDate !== 0 ? byDate : reviewNoValue(b) - reviewNoValue(a);
    });
  }, [reviews, search]);

  if (authLoading || (loading && !user)) return <div className="py-16 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading...</div>;
  if (!user) return <div className="py-16 text-center"><p className="mb-4">Sign in required.</p><button className="btn-primary" onClick={() => navigate('/auth')}>Sign In</button></div>;
  if (!isAdmin) return <div className="py-16 text-center"><p className="mb-4">Admin access required.</p><button className="btn-ghost" onClick={() => navigate('/admin')}>Back to Admin</button></div>;

  return (
    <div className={embedded ? 'animate-fade-in' : 'pt-24 pb-20 container-prose animate-fade-in'}>
      {!embedded && <button onClick={() => navigate('/admin')} className="inline-flex items-center gap-1.5 text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}><ArrowLeft className="w-4 h-4" /> Admin Dashboard</button>}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1"><CheckCircle2 className="w-5 h-5" style={{ color: '#059669' }} /><h2 className="font-serif text-2xl font-semibold" style={{ color: 'var(--color-text)' }}>Community Reviews</h2></div>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Published community reviews only. Sorted by Published On, newest first. No editing actions here.</p>
        </div>
        <button onClick={() => void load()} className="btn-ghost text-sm"><RefreshCw className="w-4 h-4" /> Refresh</button>
      </div>
      <div className="flex items-center gap-2 mb-5"><Search className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search review no., book, author, reviewer, email..." className="input flex-1" /></div>
      {error && <div className="mb-4 rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,.18)' }}>{error}</div>}
      {loading ? <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">{Array.from({length:6}).map((_,i)=><div key={i} className="surface-card h-72 animate-pulse" />)}</div> : filtered.length === 0 ? <div className="surface-card py-16 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>No published Community Reviews found.</div> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map(review => <CommunityAdminTile key={review.id} review={review} />)}
        </div>
      )}
    </div>
  );
}

function CommunityAdminTile({ review }: { review: Review }) {
  return <article className="surface-card overflow-hidden flex flex-col">
    <div className="relative aspect-square" style={{ background: 'var(--color-paper)' }}>
      <PosterImage src={review.poster_url} alt={review.title} />
      <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide" style={{ background:'rgba(16,185,129,.94)', color:'#fff' }}><CheckCircle2 className="w-3.5 h-3.5" /> Published</div>
      <div className="absolute right-3 top-3 inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold" style={{ background:'rgba(255,255,255,.94)', color:'var(--color-teal-dark)' }}>#{review.review_number ?? review.master_review_no ?? '—'}</div>
    </div>
    <div className="p-4 min-w-0">
      <div className="text-[10px] uppercase tracking-[0.16em] font-semibold mb-1" style={{ color:'var(--color-teal-dark)' }}>Published {prettyDate(review.published_on)}</div>
      <h3 className="font-serif text-lg font-semibold leading-snug truncate" title={review.title} style={{ color:'var(--color-text)' }}>{review.title || 'Untitled'}</h3>
      <p className="text-sm truncate mb-3" style={{ color:'var(--color-text-muted)' }}>{review.author || '—'}</p>
      <div className="space-y-1.5 text-xs" style={{ color:'var(--color-text-muted)' }}>
        <div className="truncate"><strong style={{color:'var(--color-text)'}}>Reviewer:</strong> {review.reviewer_name || '—'}</div>
        <div className="truncate"><strong style={{color:'var(--color-text)'}}>Instagram:</strong> {review.reviewer_handle || '—'}</div>
        <div className="truncate"><strong style={{color:'var(--color-text)'}}>Email:</strong> <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" />{review.reviewer_email || '—'}</span></div>
        <div className="truncate"><strong style={{color:'var(--color-text)'}}>Image Link:</strong> {review.poster_url ? <a href={review.poster_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1" style={{color:'var(--color-cyan-dark)'}}>Open <ExternalLink className="w-3 h-3" /></a> : '—'}</div>
        <div className="truncate"><strong style={{color:'var(--color-text)'}}>Affiliate Link:</strong> {review.poster_link ? <a href={review.poster_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1" style={{color:'var(--color-cyan-dark)'}}>Open <ExternalLink className="w-3 h-3" /></a> : '—'}</div>
        <div className="truncate"><strong style={{color:'var(--color-text)'}}>Timestamp:</strong> {review.created_at || '—'}</div>
      </div>
    </div>
  </article>;
}
