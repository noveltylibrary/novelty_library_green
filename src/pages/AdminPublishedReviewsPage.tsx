import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import {
  ArrowLeft, ExternalLink, Globe2, ImagePlus, Link2, Loader2,
  RefreshCw, Search, Upload, Mail, CheckCircle2, Circle, Table2, LayoutGrid,
  ChevronLeft, ChevronRight, Send, RotateCcw, CalendarClock,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import type { Review } from '@/types/review';
import {
  autoMatchPosterByReviewNo,
  fetchPublishedReviewsForAdmin,
  savePublishedMetadata,
  updateReviewPublication,
  publishMasterReviewsBatch,
  redeployMasterReviews,
  uploadReviewPoster,
  findPosterMatchesByReviewNos,
} from '@/lib/reviews';
import { PosterImage } from '@/components/PosterImage';

interface Props { navigate: (path: string) => void; embedded?: boolean; }
type Draft = { posterUrl: string; posterLink: string; publishedOn: string; noveltyUsername: string; isPublished: boolean };
type ViewMode = 'table' | 'cards';

function reviewNoValue(review: Review) {
  const n = Number(review.review_number ?? review.master_review_no);
  return Number.isFinite(n) ? n : -Infinity;
}

function toDateTimeLocal(value: string | null | undefined) {
  if (!value) return '';
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDateTimeLocal(value: string) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

export function AdminPublishedReviewsPage({ navigate, embedded = false }: Props) {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [matchingId, setMatchingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [reviewNoSearch, setReviewNoSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [page, setPage] = useState(0);

  const [instantTarget, setInstantTarget] = useState('');
  const [instantBusy, setInstantBusy] = useState(false);
  const [repubTarget, setRepubTarget] = useState('');
  const [repubBusy, setRepubBusy] = useState(false);
  const [batchSummary, setBatchSummary] = useState<string | null>(null);
  const [batchPosterStats, setBatchPosterStats] = useState({ matched: 0, missing: 0 });

  const pageSize = 10;
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await fetchPublishedReviewsForAdmin();
      const sorted = [...data].sort((a, b) => reviewNoValue(b) - reviewNoValue(a));
      setReviews(sorted);
      setDrafts(Object.fromEntries(sorted.map((r) => [r.id, {
        posterUrl: r.poster_url || '',
        posterLink: r.poster_link || '',
        publishedOn: toDateTimeLocal(r.published_on),
        noveltyUsername: r.novelty_username || '',
        isPublished: Boolean(r.is_published),
      }])));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load accepted reviews');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (!authLoading && user && isAdmin) void load(); }, [authLoading, user, isAdmin, load]);

  const filtered = useMemo(() => {
    const exactNo = reviewNoSearch.trim().replace(/^#/, '');
    if (exactNo) {
      return reviews.filter((r) => String(r.review_number ?? r.master_review_no ?? '') === exactNo);
    }
    const q = search.trim().toLowerCase();
    const result = q ? reviews.filter((r) =>
      r.title.toLowerCase().includes(q) || r.author.toLowerCase().includes(q) ||
      (r.reviewer_name || '').toLowerCase().includes(q) ||
      (r.reviewer_handle || '').toLowerCase().includes(q) ||
      (r.reviewer_email || '').toLowerCase().includes(q)
    ) : reviews;
    return [...result].sort((a, b) => reviewNoValue(b) - reviewNoValue(a));
  }, [reviews, search, reviewNoSearch]);

  useEffect(() => { setPage(0); }, [search, reviewNoSearch]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pageReviews = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const counts = useMemo(() => ({
    total: reviews.length,
    published: reviews.filter((r) => r.is_published).length,
    draft: reviews.filter((r) => !r.is_published).length,
  }), [reviews]);

  const setDraft = (id: string, patch: Partial<Draft>) => setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  const notify = (text: string) => { setMessage(text); window.setTimeout(() => setMessage(null), 4500); };

  const handleUpload = async (review: Review, file: File | undefined) => {
    if (!file || !review.review_number) return;
    setUploadingId(review.id); setError(null);
    try {
      const url = await uploadReviewPoster(review.review_number, file);
      setDraft(review.id, { posterUrl: url });
      // Save immediately so the poster is attached and can never be lost by
      // forgetting to press Save before Publish.
      await savePublishedMetadata(review.id, review.review_number, { posterUrl: url });
      const loads = await new Promise<boolean>((resolve) => { const img = new Image(); img.onload = () => resolve(true); img.onerror = () => resolve(false); img.src = url; });
      if (!loads) setError(`Poster was uploaded and saved, but the image URL could not be loaded in the browser: ${url} — check that the "covers" storage bucket is Public.`);
      else notify(`Poster uploaded and assigned to Review No. ${review.review_number}.`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Poster upload failed'); }
    finally { setUploadingId(null); }
  };

  const handleAutoMatch = async (review: Review) => {
    if (!review.review_number) return;
    setMatchingId(review.id); setError(null);
    try {
      const url = await autoMatchPosterByReviewNo(review.review_number);
      if (!url) { notify(`No poster file matching ${review.review_number} was found.`); return; }
      setDraft(review.id, { posterUrl: url });
      await savePublishedMetadata(review.id, review.review_number, { posterUrl: url });
      notify(`Poster ${review.review_number} matched and assigned.`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Auto-match failed'); }
    finally { setMatchingId(null); }
  };

  const saveChanges = async (review: Review) => {
    setSavingId(review.id); setError(null);
    try {
      const d = drafts[review.id] || { posterUrl: '', posterLink: '', publishedOn: '', noveltyUsername: review.novelty_username || '', isPublished: review.is_published };
      await savePublishedMetadata(review.id, review.review_number ?? review.master_review_no ?? '', {
        posterUrl: d.posterUrl.trim() || null,
        posterLink: d.posterLink.trim() || null,
        publishedOn: fromDateTimeLocal(d.publishedOn),
        noveltyUsername: d.noveltyUsername.trim().replace(/^@/, '') || null,
      });
      notify(`Saved publishing metadata for Review No. ${review.review_number ?? '—'}.`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to save changes'); }
    finally { setSavingId(null); }
  };

  const setPublication = async (review: Review, isPublished: boolean) => {
    setBusyId(review.id); setError(null);
    try {
      if (isPublished) {
        // Persist whatever is in the poster / link / date boxes first, so the
        // published snapshot always carries the poster that is on screen.
        const d = drafts[review.id];
        if (d) {
          await savePublishedMetadata(review.id, review.review_number ?? review.master_review_no ?? '', {
            posterUrl: d.posterUrl.trim() || null,
            posterLink: d.posterLink.trim() || null,
            publishedOn: fromDateTimeLocal(d.publishedOn),
            noveltyUsername: d.noveltyUsername.trim().replace(/^@/, '') || null,
          });
        }
      }
      await updateReviewPublication(review.id, isPublished);
      notify(isPublished ? `Review No. ${review.review_number ?? '—'} published.` : `Review No. ${review.review_number ?? '—'} moved to Draft.`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to update publication status'); }
    finally { setBusyId(null); }
  };

  const redeployOne = async (review: Review) => {
    setBusyId(review.id); setError(null);
    try {
      const d = drafts[review.id];
      if (d) await savePublishedMetadata(review.id, review.review_number ?? review.master_review_no ?? '', { posterUrl: d.posterUrl.trim() || null, posterLink: d.posterLink.trim() || null, noveltyUsername: d.noveltyUsername.trim().replace(/^@/, '') || null });
      await redeployMasterReviews([review.id]);
      notify(`Review No. ${review.review_number ?? '—'} republished from the latest Accepted Reviews data.`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'RePublish failed'); }
    finally { setBusyId(null); }
  };

  const findByNo = (no: number) => reviews.find((r) => reviewNoValue(r) === no);

  const instantPublish = async () => {
    const target = Number.parseInt(instantTarget.trim(), 10);
    if (!Number.isInteger(target) || target <= 0) return setError('Enter a valid Review No.');
    const review = findByNo(target);
    if (!review) return setError(`Review No. ${target} was not found in Accepted Reviews.`);
    setInstantBusy(true); setError(null);
    try {
      let poster = (drafts[review.id]?.posterUrl || review.poster_url || '').trim();
      let matchUnavailable = false;
      if (!poster) {
        try { poster = (await autoMatchPosterByReviewNo(target)) || ''; }
        catch { matchUnavailable = true; }
      }
      if (poster) {
        try {
          await savePublishedMetadata(review.id, target, { posterUrl: poster });
        } catch (posterError) {
          console.warn('Poster metadata save failed; continuing publication:', posterError);
        }
      }
      await publishMasterReviewsBatch([review.id]);
      notify(`Review No. ${target} is live. ${poster ? 'Poster matched and assigned.' : matchUnavailable ? 'Poster matching was unavailable; the review was published without one.' : 'No poster was found; the review was published without one.'}`);
      await load();
    } catch (e) { setError(e instanceof Error ? `Instant Publish failed: ${e.message}` : 'Instant Publish failed.'); }
    finally { setInstantBusy(false); }
  };

  const batchPublish = async () => {
    const target = Number.parseInt(instantTarget.trim(), 10);
    if (!Number.isInteger(target) || target <= 0) return setError('Enter a valid target Review No. for Batch Publish.');
    setInstantBusy(true); setError(null); setBatchSummary(null);
    try {
      const candidates = reviews.filter((r) => {
        const n = reviewNoValue(r);
        return Number.isFinite(n) && n > 0 && n <= target && !r.is_published;
      }).sort((a, b) => reviewNoValue(a) - reviewNoValue(b));
      if (!candidates.length) {
        notify(`Nothing to publish: all existing reviews through #${target} are already live.`);
        return;
      }
      const nums = candidates.map((r) => reviewNoValue(r));
      let matches: Record<string, string> = {};
      try { matches = await findPosterMatchesByReviewNos(nums); } catch {
        // Posters are optional: if Drive matching is unavailable, publish the
        // reviews with their existing poster URLs (or blank poster fields).
      }
      let matched = 0; let missing = 0;
      for (const review of candidates) {
        const no = String(reviewNoValue(review));
        const existing = (drafts[review.id]?.posterUrl || review.poster_url || '').trim();
        const poster = existing || matches[no] || '';
        if (poster) {
          matched += 1;
          await savePublishedMetadata(review.id, no, { posterUrl: poster });
        } else missing += 1;
      }
      await publishMasterReviewsBatch(candidates.map((r) => r.id));
      setBatchPosterStats({ matched, missing });
      setBatchSummary(`Published ${candidates.length} reviews through #${target}: ${matched} poster(s) matched, ${missing} left without a poster.`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Batch Publish failed'); }
    finally { setInstantBusy(false); }
  };

  const republishOneByNumber = async () => {
    const target = Number.parseInt(repubTarget.trim(), 10);
    if (!Number.isInteger(target) || target <= 0) return setError('Enter a valid Review No. for RePublish.');
    const review = findByNo(target);
    if (!review) return setError(`Review No. ${target} was not found.`);
    setRepubBusy(true); setError(null);
    try {
      await redeployMasterReviews([review.id]);
      notify(`Review No. ${target} republished with the current Accepted Reviews data.`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'RePublish failed'); }
    finally { setRepubBusy(false); }
  };

  const republishAll = async () => {
    const target = Number.parseInt(repubTarget.trim(), 10);
    if (!Number.isInteger(target) || target <= 0) return setError('Enter a target Review No. for RePublish All.');
    setRepubBusy(true); setError(null);
    try {
      const live = reviews.filter((r) => r.is_published && reviewNoValue(r) > 0 && reviewNoValue(r) <= target).sort((a, b) => reviewNoValue(a) - reviewNoValue(b));
      await redeployMasterReviews(live.map((r) => r.id));
      notify(`RePublished ${live.length} live reviews through #${target}.`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'RePublish All failed'); }
    finally { setRepubBusy(false); }
  };

  if (authLoading || (loading && !user)) return <div className="py-16 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading...</div>;
  if (!user) return <div className="py-16 text-center"><p className="mb-4">Sign in required.</p><button className="btn-primary" onClick={() => navigate('/auth')}>Sign In</button></div>;
  if (!isAdmin) return <div className="py-16 text-center"><p className="mb-4">Admin access required.</p><button className="btn-ghost" onClick={() => navigate('/admin')}>Back to Admin</button></div>;

  return (
    <div className={embedded ? 'animate-fade-in' : 'pt-24 pb-20 container-prose animate-fade-in'}>
      {!embedded && <button onClick={() => navigate('/admin')} className="inline-flex items-center gap-1.5 text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}><ArrowLeft className="w-4 h-4" /> Admin Dashboard</button>}

      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1"><Globe2 className="w-5 h-5" style={{ color: 'var(--color-teal-dark)' }} /><h2 className="font-serif text-2xl font-semibold" style={{ color: 'var(--color-text)' }}>Publishing Queue</h2></div>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Every Accepted Review lands here first. Assign a poster and affiliate link, then Publish to send it live on Community Reviews.</p>
        </div>
        <div className="flex gap-2">
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
            <button onClick={() => setViewMode('table')} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium" style={{ background: viewMode === 'table' ? 'var(--color-teal-dark)' : 'var(--color-surface)', color: viewMode === 'table' ? 'white' : 'var(--color-text-muted)' }}><Table2 className="w-3.5 h-3.5" /> Table</button>
            <button onClick={() => setViewMode('cards')} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium" style={{ background: viewMode === 'cards' ? 'var(--color-teal-dark)' : 'var(--color-surface)', color: viewMode === 'cards' ? 'white' : 'var(--color-text-muted)' }}><LayoutGrid className="w-3.5 h-3.5" /> Cards</button>
          </div>
          <button onClick={() => void load()} className="btn-ghost text-sm"><RefreshCw className="w-4 h-4" /> Refresh</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-5">
        <section className="surface-card p-4" style={{ border: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-2 mb-1"><Send className="w-4 h-4" style={{ color: 'var(--color-teal-dark)' }} /><h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Instant Publish</h3></div>
          <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>Enter a Review No. to publish one review or everything unpublished up to that number. Poster matching is automatic when a file exists; missing optional fields stay empty.</p>
          <div className="flex flex-wrap items-center gap-2">
            <input value={instantTarget} onChange={(e) => setInstantTarget(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="Review No. e.g. 150" className="input w-48" />
            <button onClick={() => void instantPublish()} disabled={instantBusy || !instantTarget} className="btn-ghost text-sm">{instantBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Publish Review</button>
            <button onClick={() => void batchPublish()} disabled={instantBusy || !instantTarget} className="btn-primary text-sm">{instantBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />} Batch Publish</button>
          </div>
          {batchSummary && <p className="mt-3 text-xs" style={{ color: 'var(--color-teal-dark)' }}>{batchSummary}</p>}
          {(batchPosterStats.matched + batchPosterStats.missing > 0) && <p className="mt-1 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{batchPosterStats.matched} poster(s) matched · {batchPosterStats.missing} without poster</p>}
        </section>

        <section className="surface-card p-4" style={{ border: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-2 mb-1"><RotateCcw className="w-4 h-4" style={{ color: 'var(--color-teal-dark)' }} /><h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>RePublish</h3></div>
          <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>Sync live reviews with the latest Accepted Reviews edits. RePublish All updates every live review from #1 through your target.</p>
          <div className="flex flex-wrap items-center gap-2">
            <input value={repubTarget} onChange={(e) => setRepubTarget(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="Review No. e.g. 35" className="input w-48" />
            <button onClick={() => void republishOneByNumber()} disabled={repubBusy || !repubTarget} className="btn-ghost text-sm">{repubBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} RePublish Review</button>
            <button onClick={() => void republishAll()} disabled={repubBusy || !repubTarget} className="btn-primary text-sm">{repubBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} RePublish All</button>
          </div>
        </section>
      </div>

      <div className="flex flex-wrap gap-2 mb-5 text-xs">
        <span className="px-3 py-1.5 rounded-full" style={{ background: 'var(--color-surface)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>{counts.total} accepted</span>
        <span className="px-3 py-1.5 rounded-full" style={{ background: 'rgba(0,151,178,.08)', color: 'var(--color-teal-dark)', border: '1px solid rgba(0,151,178,.18)' }}>{counts.published} published</span>
        <span className="px-3 py-1.5 rounded-full" style={{ background: 'rgba(239,68,68,.07)', color: '#dc2626', border: '1px solid rgba(239,68,68,.16)' }}>{counts.draft} in queue</span>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-3 mb-4"><div className="relative flex-1 w-full"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} /><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Search book, author, reviewer, email..." className="input pl-9 w-full" /></div><div className="relative w-full md:w-56"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold" style={{ color: 'var(--color-cyan-dark)' }}>#</span><input value={reviewNoSearch} onChange={(e) => { setReviewNoSearch(e.target.value.replace(/[^0-9]/g, '')); setPage(0); }} inputMode="numeric" placeholder="Exact Review No." className="input pl-7 w-full" aria-label="Search exact review number only" />{reviewNoSearch && <button type="button" onClick={() => setReviewNoSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--color-text-muted)' }}>Clear</button>}</div></div>
      {error && <div className="mb-4 rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,.18)' }}>{error}</div>}
      {message && <div className="fixed right-5 top-24 z-[100] rounded-xl px-4 py-3 text-sm font-medium shadow-xl animate-fade-in" role="status" style={{ background: 'var(--color-surface)', color: 'var(--color-teal-dark)', border: '1px solid rgba(16,185,129,.28)' }}><span className="inline-flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> {message}</span></div>}

      {loading ? <div className="surface-card py-16 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading accepted reviews...</div> : filtered.length === 0 ? <div className="surface-card py-16 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>No accepted reviews found.</div> : viewMode === 'table' ? (
        <>
          <div className="surface-card overflow-hidden">
            <div className="overflow-x-auto" style={{ maxHeight: '65vh' }}>
              <table className="border-collapse w-full" style={{ tableLayout: 'fixed', minWidth: 1160 }}>
                <thead className="sticky top-0 z-20"><tr style={{ background: 'var(--color-paper)' }}>
                  {([['Review No.',80],['Timestamp',115],['Name',120],['Email',155],['Instagram',120],['Book Title',155],['Author',125],['Publishing',330]] as const).map(([h,w]) => <th key={h} style={{ width:w, minWidth:w }} className="text-left px-2.5 py-2 font-semibold whitespace-nowrap border-b-2"><span className="text-xs" style={{ color:'var(--color-text-muted)' }}>{h}</span></th>)}
                </tr></thead>
                <tbody>{pageReviews.map((review,i) => <PublishedTableRow key={review.id} review={review} index={i} draft={drafts[review.id]} setDraft={setDraft} fileRefs={fileRefs} handleUpload={handleUpload} handleAutoMatch={handleAutoMatch} saveChanges={saveChanges} setPublication={setPublication} redeploy={redeployOne} uploadingId={uploadingId} matchingId={matchingId} savingId={savingId} busyId={busyId} />)}</tbody>
              </table>
            </div>
          </div>
          <PublishedPagination currentPage={currentPage} totalPages={totalPages} pageSize={pageSize} filteredCount={filtered.length} setPage={setPage} />
        </>
      ) : (
        <><div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{pageReviews.map((review) => <PublishedCard key={review.id} review={review} draft={drafts[review.id]} setDraft={setDraft} fileRefs={fileRefs} handleUpload={handleUpload} handleAutoMatch={handleAutoMatch} saveChanges={saveChanges} setPublication={setPublication} redeploy={redeployOne} uploadingId={uploadingId} matchingId={matchingId} savingId={savingId} busyId={busyId} />)}</div><PublishedPagination currentPage={currentPage} totalPages={totalPages} pageSize={pageSize} filteredCount={filtered.length} setPage={setPage} /></>
      )}
    </div>
  );
}

type ControlsProps = {
  review: Review; draft?: Draft; setDraft: (id: string, patch: Partial<Draft>) => void;
  fileRefs: MutableRefObject<Record<string, HTMLInputElement | null>>;
  handleUpload: (review: Review, file: File | undefined) => void;
  handleAutoMatch: (review: Review) => void; saveChanges: (review: Review) => void;
  setPublication: (review: Review, published: boolean) => void;
  redeploy: (review: Review) => void;
  uploadingId: string | null; matchingId: string | null; savingId: string | null; busyId: string | null;
};

function PublishingControls(props: ControlsProps & { compact?: boolean }) {
  const { review, draft, setDraft, fileRefs, handleUpload, handleAutoMatch, saveChanges, setPublication, redeploy, uploadingId, matchingId, savingId, busyId, compact = false } = props;
  const d = draft || { posterUrl: review.poster_url || '', posterLink: review.poster_link || '', publishedOn: toDateTimeLocal(review.published_on), noveltyUsername: review.novelty_username || '', isPublished: Boolean(review.is_published) };
  const published = d.isPublished;
  const pad = compact ? { padding: '4px 7px' } : undefined;
  return <div className="min-w-0 space-y-1.5">
    <div className={`relative aspect-square w-full rounded-lg overflow-hidden ${compact ? 'max-w-[96px]' : 'max-w-[220px]'}`} style={{ background: 'var(--color-paper)', border: '1px solid var(--color-border)' }} title="Poster preview (1:1)"><PosterImage src={d.posterUrl} alt={`Poster for ${review.title}`} /></div>
    <div className="grid grid-cols-2 gap-1.5">
      <input ref={(el) => { fileRefs.current[review.id] = el; }} type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" className="hidden" onChange={(e) => void handleUpload(review, e.target.files?.[0])} />
      <button className="btn-ghost text-[10px]" style={pad} disabled={uploadingId === review.id || !review.review_number} onClick={() => fileRefs.current[review.id]?.click()}>{uploadingId === review.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />} Upload Poster</button>
      <button className="btn-ghost text-[10px]" style={pad} disabled={matchingId === review.id || !review.review_number} onClick={() => void handleAutoMatch(review)}>{matchingId === review.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImagePlus className="w-3 h-3" />} Auto-Match</button>
    </div>
    <div className="relative"><Link2 className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3" style={{ color:'var(--color-text-muted)' }} /><input value={d.posterUrl} onChange={(e) => setDraft(review.id,{posterUrl:e.target.value})} placeholder="Poster image URL" className="input pl-7 text-[10px] w-full" /></div>
    <div className="relative"><ExternalLink className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3" style={{ color:'var(--color-text-muted)' }} /><input value={d.posterLink} onChange={(e) => setDraft(review.id,{posterLink:e.target.value})} placeholder="Poster Link / affiliate URL" className="input pl-7 text-[10px] w-full" /></div>
    <div className="relative"><CalendarClock className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3" style={{ color:'var(--color-text-muted)' }} /><input type="datetime-local" value={d.publishedOn} onChange={(e) => setDraft(review.id,{publishedOn:e.target.value})} className="input pl-7 text-[10px] w-full" aria-label="Published On" /></div>
    {review.reviewer_email && <div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold" style={{ color:'var(--color-text-muted)' }}>@</span><input value={d.noveltyUsername} onChange={(e) => setDraft(review.id,{noveltyUsername:e.target.value.replace(/\s/g, '').replace(/^@/, '').toLowerCase()})} placeholder="Novelty username" className="input pl-7 text-[10px] w-full" aria-label="Novelty username" /></div>}
    <div className="flex flex-wrap items-center gap-1">
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide mr-auto" style={{ background: published ? 'rgba(16,185,129,.12)' : 'rgba(239,68,68,.10)', color: published ? '#059669' : '#dc2626', border: `1px solid ${published ? 'rgba(16,185,129,.25)' : 'rgba(239,68,68,.20)'}` }}>{published ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3" />}{published?'Published':'In Queue'}</span>
      {d.posterUrl && <a className="btn-ghost text-[10px]" style={pad} href={d.posterUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-3 h-3" /> Poster</a>}
      {d.posterLink && <a className="btn-ghost text-[10px]" style={pad} href={d.posterLink} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-3 h-3" /> Link</a>}
      <button className="btn-ghost text-[10px]" style={pad} disabled={savingId===review.id} onClick={() => void saveChanges(review)}>{savingId===review.id?<Loader2 className="w-3 h-3 animate-spin" />:<RefreshCw className="w-3 h-3" />} Save</button>
      <button className={published?'btn-ghost text-[10px]':'btn-primary text-[10px]'} style={pad} disabled={busyId===review.id} onClick={() => void setPublication(review,!published)}>{busyId===review.id?<Loader2 className="w-3 h-3 animate-spin" />:published?'Depublish':'Publish'}</button>
      {published && <button className="btn-ghost text-[10px]" style={{...pad,borderColor:'rgba(0,151,178,.25)'}} disabled={busyId===review.id} onClick={() => void redeploy(review)}><RotateCcw className="w-3 h-3" /> RePublish</button>}
    </div>
  </div>;
}

function PublishedTableRow(props: ControlsProps & { index:number }) {
  const { review,index } = props;
  return <tr style={{ borderBottom:'1px solid var(--color-border)', background:index%2?'rgba(0,0,0,.015)':'transparent' }}>
    <td className="px-2.5 py-1.5 font-semibold whitespace-nowrap" style={{ color:'var(--color-teal-dark)' }}>#{review.review_number ?? review.master_review_no ?? '—'}</td>
    <td className="px-2.5 py-1.5 truncate" style={{ color:'var(--color-text-muted)' }} title={review.created_at || ''}>{review.created_at || '—'}</td>
    <td className="px-2.5 py-1.5 truncate" style={{ color:'var(--color-text)' }} title={review.reviewer_name || ''}>{review.reviewer_name || '—'}</td>
    <td className="px-2.5 py-1.5 truncate" style={{ color:'var(--color-text-muted)' }} title={review.reviewer_email || ''}><span className="inline-flex max-w-full items-center gap-1"><Mail className="w-3 h-3 shrink-0" /> <span className="truncate">{review.reviewer_email || '—'}</span></span></td>
    <td className="px-2.5 py-1.5 truncate" style={{ color:'var(--color-text-muted)' }} title={review.reviewer_handle || ''}>{review.reviewer_handle || '—'}</td>
    <td className="px-2.5 py-1.5 truncate" style={{ color:'var(--color-text)' }} title={review.title || ''}>{review.title || '—'}</td>
    <td className="px-2.5 py-1.5 truncate" style={{ color:'var(--color-text)' }} title={review.author || ''}>{review.author || '—'}</td>
    <td className="px-2.5 py-1.5 align-top"><PublishingControls {...props} compact /></td>
  </tr>;
}

function PublishedCard(props: ControlsProps) {
  const { review,draft } = props;
  const d = draft || { posterUrl:review.poster_url||'',posterLink:review.poster_link||'',publishedOn:toDateTimeLocal(review.published_on),noveltyUsername:review.novelty_username||'',isPublished:Boolean(review.is_published) };
  return <article className="surface-card p-4 flex flex-col gap-3">
    <div className="flex items-start justify-between gap-3"><span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background:'rgba(0,151,178,.1)',color:'var(--color-teal-dark)' }}>Review No. #{review.review_number ?? review.master_review_no ?? '—'}</span><span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide" style={{ background:d.isPublished?'rgba(16,185,129,.12)':'rgba(239,68,68,.10)', color:d.isPublished?'#059669':'#dc2626', border:`1px solid ${d.isPublished?'rgba(16,185,129,.25)':'rgba(239,68,68,.20)'}` }}>{d.isPublished?<CheckCircle2 className="w-3.5 h-3.5" />:<Circle className="w-3.5 h-3.5" />}{d.isPublished?'Published':'In Queue'}</span></div>
    <div className="flex items-start gap-3">{review.cover_image_url?<img src={review.cover_image_url} alt={review.title} className="w-16 h-20 rounded-lg object-cover flex-shrink-0" />:<div className="w-16 h-20 rounded-lg flex-shrink-0" style={{background:'var(--color-paper)'}} />}<div className="min-w-0"><h3 className="font-serif text-lg font-semibold leading-snug truncate" style={{color:'var(--color-text)'}} title={review.title}>{review.title||'Untitled'}</h3><p className="text-sm truncate" style={{color:'var(--color-text-muted)'}}>{review.author||'—'}</p><p className="text-xs mt-1 truncate" style={{color:'var(--color-text-muted)'}}>{review.created_at||'—'}</p></div></div>
    <div className="grid grid-cols-1 gap-1 text-xs min-w-0" style={{color:'var(--color-text-muted)'}}><div className="truncate"><strong style={{color:'var(--color-text)'}}>Reviewer:</strong> {review.reviewer_name||'—'}</div><div className="truncate"><strong style={{color:'var(--color-text)'}}>Instagram:</strong> {review.reviewer_handle||'—'}</div><div className="truncate"><strong style={{color:'var(--color-text)'}}>Novelty username:</strong> {d.noveltyUsername ? `@${d.noveltyUsername.replace(/^@/, '')}` : '—'}</div><div className="truncate"><strong style={{color:'var(--color-text)'}}>Email:</strong> {review.reviewer_email||'—'}</div></div>
    <div className="pt-2" style={{borderTop:'1px solid var(--color-border)'}}><p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{color:'var(--color-text-muted)'}}>Publishing metadata</p><PublishingControls {...props} /></div>
  </article>;
}

function PublishedPagination({currentPage,totalPages,pageSize,filteredCount,setPage}:{currentPage:number;totalPages:number;pageSize:number;filteredCount:number;setPage:(page:number)=>void}) {
  if (filteredCount<=pageSize) return null;
  return <div className="flex items-center justify-between mt-4"><p className="text-xs" style={{color:'var(--color-text-muted)'}}>Showing {currentPage*pageSize+1}–{Math.min((currentPage+1)*pageSize,filteredCount)} of {filteredCount}</p><div className="flex items-center gap-2"><button onClick={()=>setPage(Math.max(0,currentPage-1))} disabled={currentPage===0} className="btn-ghost text-xs" style={{padding:'6px 10px',opacity:currentPage===0?0.4:1}}><ChevronLeft className="w-4 h-4" /> Prev</button><span className="text-xs font-medium" style={{color:'var(--color-text)'}}>{currentPage+1} / {totalPages}</span><button onClick={()=>setPage(Math.min(totalPages-1,currentPage+1))} disabled={currentPage>=totalPages-1} className="btn-ghost text-xs" style={{padding:'6px 10px',opacity:currentPage>=totalPages-1?0.4:1}}>Next <ChevronRight className="w-4 h-4" /></button></div></div>;
}
