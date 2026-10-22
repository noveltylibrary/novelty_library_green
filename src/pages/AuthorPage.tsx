import { useMemo, useState } from 'react';
import { ArrowLeft, Check, Flag, Share2, UserCheck, UserPlus, X } from 'lucide-react';
import { authorKey, usePublished } from '@/lib/readerTools';
import { sanitizeUserText } from '@/lib/sanitize';
import { PeopleCard } from '@/components/PeopleCard';
import { AuthorBioBlock } from '@/components/AuthorBioBlock';
import { summarizeReviews, useAuthorFollow } from '@/lib/authors';
import { useAuth } from '@/lib/auth';
import { REPORT_REASONS, createGrievance, type ReportReason } from '@/lib/moderation';
import { useOverlayHistory } from '@/lib/overlayHistory';

/** Author page: the purple-and-gold card (with follow / replay / report / share above it) and the About note below it. */
export function AuthorPage({ name, navigate }: { name: string; navigate: (path: string) => void }) {
  const { user } = useAuth();
  const all = usePublished();
  const key = authorKey(name);
  const follow = useAuthorFollow(key, navigate);
  const books = useMemo(() => all.filter((r) => authorKey(r.author || '') === key).sort((a, b) => (b.rw_rating || 0) - (a.rw_rating || 0)), [all, key]);
  const display = (books[0]?.author || name).trim();
  const stats = useMemo(() => summarizeReviews(books), [books]);
  const shareUrl = `${window.location.origin}/author/${encodeURIComponent(display)}`;

  const [shared, setShared] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>(REPORT_REASONS[0]);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useOverlayHistory(reportOpen, () => { if (!busy) setReportOpen(false); });

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
      await createGrievance('Author page report', `Report: ${display}`.slice(0, 160), `Reason: ${reason}\nAuthor page: ${shareUrl}\n\n${details.trim()}`);
      setMessage('Report submitted. Thank you.'); setDetails('');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not submit report.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="pt-24 pb-20 container-prose animate-fade-in">
      <button type="button" onClick={() => { if (window.history.length > 1) window.history.back(); else navigate('/reviews'); }} className="nl-qv-link inline-flex items-center gap-1.5 mb-4"><ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back</button>

      {!all.length && <p className="nl-find-hint">Loading author…</p>}
      {all.length > 0 && books.length === 0 && <p className="nl-find-hint">No published reviews of this author yet.</p>}

      {books.length > 0 && (
        <section className="nl-people-section" aria-label={`${display} profile card`}>
          <PeopleCard
            variant="author"
            name={display}
            followers={follow.followers}
            stats={stats}
            fileSlug={key.replace(/\s+/g, '-')}
            shareUrl={shareUrl}
            topActions={({ replay, replayKey }) => (
              <div className="nl-trio" role="group" aria-label="Author actions">
                <button type="button" disabled={follow.busy} onClick={() => void follow.toggle()} aria-pressed={follow.following} aria-label={`${follow.following ? 'Unfollow' : 'Follow'} ${sanitizeUserText(display, 60)}`} className={`nl-trio-btn nl-trio-follow ${follow.following ? 'is-following' : ''}`}>
                  {follow.following ? <UserCheck aria-hidden="true" /> : <UserPlus aria-hidden="true" />}<span>{follow.following ? 'Following' : 'Follow'}</span>
                </button>
                <button type="button" onClick={replay} className="nl-trio-btn nl-trio-replay" aria-label="Replay animation">
                  <svg key={replayKey} className="nl-ico-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg>
                </button>
                {user && <button type="button" onClick={() => { setMessage(null); setReportOpen(true); }} className="nl-trio-btn nl-trio-report" aria-label="Report this author page" title="Report"><Flag aria-hidden="true" /></button>}
                <button type="button" onClick={() => void share()} className={`nl-trio-btn nl-trio-share ${shared ? 'is-done' : ''}`} aria-label="Share this author">{shared ? <Check aria-hidden="true" /> : <Share2 aria-hidden="true" />}</button>
              </div>
            )}
          />
        </section>
      )}

      {books.length > 0 && <AuthorBioBlock name={display} reviewedTitles={books.map((b) => b.title || '')} />}

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
