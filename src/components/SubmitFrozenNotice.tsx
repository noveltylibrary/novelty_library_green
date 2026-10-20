import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Lock, X } from 'lucide-react';
import { sanitizeUserText } from '@/lib/sanitize';
import { useOverlayHistory } from '@/lib/overlayHistory';

/** Banner at the top of the Submit page while it is frozen, and a popup with the admin's note (shown once per visit, reopenable). */
export function SubmitFrozenNotice({ reason, note, adminBypass, forceOpen, onClosed }: { reason: string; note: string; adminBypass: boolean; forceOpen: number; onClosed?: () => void }) {
  const KEY = 'nl_submit_freeze_seen';
  const [open, setOpen] = useState(() => { try { return sessionStorage.getItem(KEY) !== '1'; } catch { return true; } });
  useEffect(() => { if (forceOpen > 0) setOpen(true); }, [forceOpen]);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = () => { setOpen(false); try { sessionStorage.setItem(KEY, '1'); } catch { /* ignore */ } onClosed?.(); };
  useOverlayHistory(open, close);
  const title = reason || 'Submissions are paused';

  return (
    <>
      <div className="nl-freeze-banner" role="status">
        <Lock aria-hidden="true" />
        <div>
          <strong>{sanitizeUserText(title, 90)}</strong>
          <span>{adminBypass ? 'Frozen for readers. You are an admin, so you can still use the form.' : 'You can read every question, but the form is read-only for now.'}</span>
        </div>
        <button type="button" onClick={() => setOpen(true)}>Read note</button>
      </div>
      {open && createPortal(
        <div className="nl-freeze-overlay" role="dialog" aria-modal="true" aria-labelledby="nl-freeze-title" onClick={close}>
          <div className="nl-freeze-sheet" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="nl-share-close" onClick={close} aria-label="Close"><X className="w-4 h-4" /></button>
            <span className="nl-freeze-icon"><Lock aria-hidden="true" /></span>
            <span className="nl-live-kicker">SUBMIT PAGE</span>
            <h2 id="nl-freeze-title" className="nl-freeze-title">{sanitizeUserText(title, 90)}</h2>
            {note && <p className="nl-freeze-note">{sanitizeUserText(note, 600)}</p>}
            <p className="nl-freeze-sub">You can still look through every question. The form opens again when submissions resume.</p>
            <button type="button" className="nl-share-primary" onClick={close}>Got it</button>
          </div>
        </div>, document.body)}
    </>
  );
}
