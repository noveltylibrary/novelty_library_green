import { useEffect, useMemo, useState } from 'react';
import { CoverImg } from '@/components/CoverImg';
import { createPortal } from 'react-dom';
import { Archive, BookOpen, Bookmark, Camera, Clock3, ImagePlus, Trash2, X } from 'lucide-react';
import { fetchArchive, STORY_RETENTION_NOTE, type ArchiveStory } from '@/lib/social';
import { reviewPath, usePublished, useSavedReviews } from '@/lib/readerTools';
import { HighlightPicker } from '@/components/ProfileHighlights';
import { sanitizeUserText } from '@/lib/sanitize';
import { useOverlayHistory } from '@/lib/overlayHistory';

const fmtDay = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); };

/** Account → Archives: your story archive (last 30 days, ready to add to a Highlight) and your saved list ("My list"). */
export function ArchivesModal({ userId, navigate, onClose }: { userId: string; navigate: (path: string) => void; onClose: () => void }) {
  useOverlayHistory(true, onClose);
  const [tab, setTab] = useState<'stories' | 'saved'>('stories');
  const [archive, setArchive] = useState<ArchiveStory[] | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const all = usePublished();
  const { ids, toggle } = useSavedReviews();
  const saved = useMemo(() => ids.map((id) => all.find((r) => r.id === id)).filter((r): r is NonNullable<typeof r> => !!r), [ids, all]);

  useEffect(() => {
    let alive = true;
    fetchArchive(userId).then((a) => { if (alive) setArchive(a); }).catch(() => { if (alive) setArchive([]); });
    return () => { alive = false; };
  }, [userId]);
  useEffect(() => {
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !pick) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [onClose, pick]);

  return createPortal(
    <>
    <div className="nl-conn-backdrop" onClick={onClose}>
      <div className="nl-conn-modal nl-hlp nl-arch" role="dialog" aria-modal="true" aria-label="Archives" onClick={(e) => e.stopPropagation()}>
        <div className="nl-conn-top"><h2 className="nl-hlp-h"><Archive aria-hidden="true" /> Archives</h2><button type="button" className="nl-conn-x" onClick={onClose} aria-label="Close"><X aria-hidden="true" /></button></div>
        <div className="nl-arch-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'stories'} className={tab === 'stories' ? 'is-on' : ''} onClick={() => setTab('stories')}><Camera aria-hidden="true" /> Highlight archive</button>
          <button type="button" role="tab" aria-selected={tab === 'saved'} className={tab === 'saved' ? 'is-on' : ''} onClick={() => setTab('saved')}><Bookmark aria-hidden="true" /> My list{ids.length ? ` (${ids.length})` : ''}</button>
        </div>
        <div className="nl-hlp-body">
          {tab === 'stories' ? <>
            <p className="nl-hl-note"><Clock3 aria-hidden="true" /> {STORY_RETENTION_NOTE}</p>
            {archive === null ? <p className="nl-conn-empty">Loading…</p> : archive.length === 0 ? <p className="nl-conn-empty">No stories in the last 30 days. Share a story from your profile first.</p> : (
              <ul className="nl-hlp-grid">
                {archive.map((s) => (
                  <li key={s.id}><button type="button" className="nl-hlp-cell" onClick={() => setPick(s.id)} aria-label={`Add story from ${fmtDay(s.created_at)} to a highlight`}>
                    {s.image_url ? <img src={s.image_url} alt="" loading="lazy" /> : <ImagePlus aria-hidden="true" />}
                    <span className="nl-hlp-date">{fmtDay(s.created_at)}{s.live ? ' · live' : ''}</span>
                  </button></li>
                ))}
              </ul>
            )}
            {archive && archive.length > 0 && <p className="nl-hl-note">Tap a story to add it to a Highlight.</p>}
          </> : <>
            <p className="nl-hl-note"><Bookmark aria-hidden="true" /> Reviews you saved with the bookmark. Kept on this device only.</p>
            {saved.length === 0 ? <p className="nl-conn-empty">Nothing saved yet.</p> : (
              <ul className="nl-find-list">
                {saved.map((r) => { const cover = r.poster_url || r.cover_image_url; return (
                  <li key={r.id} className="nl-find-result">
                    <button type="button" className="nl-find-result-main" onClick={() => { onClose(); navigate(reviewPath(r)); }} aria-label={`Open review of ${r.title}`}>
                      <span className="nl-find-cover"><CoverImg src={cover} /></span>
                      <span className="nl-find-copy"><strong>{sanitizeUserText(r.title, 120)}</strong><small>{sanitizeUserText(r.author, 80)}</small></span>
                    </button>
                    <button type="button" className="nl-shelf-x" onClick={() => toggle(r.id)} aria-label={`Remove ${r.title} from my list`}><Trash2 className="w-4 h-4" /></button>
                  </li>
                ); })}
              </ul>
            )}
          </>}
        </div>
      </div>
    </div>
    {pick && <HighlightPicker userId={userId} preselect={[pick]} onClose={() => setPick(null)} onSaved={() => setPick(null)} />}
    </>,
    document.body,
  );
}
