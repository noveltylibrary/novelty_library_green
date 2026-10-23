import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookCheck, X } from 'lucide-react';
import { useOverlayHistory } from '@/lib/overlayHistory';

/** Small teal tag for books whose series name says "standalone sufficed". Click for what it means. */
export function StandaloneTag({ seriesName }: { seriesName?: string }) {
  const [open, setOpen] = useState(false);
  useOverlayHistory(open, () => setOpen(false));
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open]);
  return <>
    <button type="button" className="nl-standalone-tag" onClick={() => setOpen(true)} aria-haspopup="dialog" title="What does this mean?">
      <BookCheck className="w-3.5 h-3.5" aria-hidden="true" /> Standalone sufficed
    </button>
    {open && createPortal(
      <div className="nl-taste-pop" onClick={() => setOpen(false)}>
        <div className="nl-taste-pop-card nl-standalone-card" role="dialog" aria-modal="true" aria-labelledby="nl-standalone-h" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="nl-taste-pop-x" onClick={() => setOpen(false)} aria-label="Close"><X size={18} aria-hidden="true" /></button>
          <span className="nl-standalone-ico"><BookCheck aria-hidden="true" /></span>
          <h2 id="nl-standalone-h">Standalone sufficed</h2>
          <p>{seriesName ? <>This book belongs to the <strong>{seriesName}</strong> series, but it</> : <>This book is part of a series, but it</>} can be read on its own. You do not need to read the earlier books first to follow the story and enjoy it.</p>
          <p>The reviewer found the plot complete and the characters easy to pick up without the earlier volumes. Reading the rest of the series is still optional, and may add background and depth.</p>
        </div>
      </div>, document.body)}
  </>;
}
