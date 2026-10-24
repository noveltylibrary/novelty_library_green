import { useEffect, useRef, useState } from 'react';
import { BookOpen, Check, X } from 'lucide-react';
import { IDLE_CHECK, checkBook, type BookCheck } from '@/lib/bookVerify';

interface BookVerifyCardProps {
  title: string;
  author: string;
  hasCover: boolean;
  onUseDetails: (title: string, author: string) => void;
  onUseCover: (url: string) => void;
}

/** Waits for typing to pause, then asks Open Library about the title and author. Quiet when offline or when nothing matches. */
function useBookCheck(title: string, author: string): BookCheck {
  const [check, setCheck] = useState<BookCheck>(IDLE_CHECK);
  useEffect(() => {
    const t = title.trim();
    if (t.length < 3) { setCheck(IDLE_CHECK); return; }
    const ctl = new AbortController();
    setCheck((c) => ({ ...c, status: 'checking' }));
    const timer = window.setTimeout(() => {
      checkBook(t, author, ctl.signal).then(setCheck).catch(() => undefined);
    }, 750);
    return () => { window.clearTimeout(timer); ctl.abort(); };
  }, [title, author]);
  return check;
}

/**
 * Live book check under the title and author fields. It only suggests: nothing in the form changes
 * until the reviewer presses "Use these details" or "Use this cover".
 */
export function BookVerifyCard({ title, author, hasCover, onUseDetails, onUseCover }: BookVerifyCardProps) {
  const check = useBookCheck(title, author);
  const [dismissed, setDismissed] = useState('');
  const sig = `${title.trim().toLowerCase()}|${author.trim().toLowerCase()}`;
  const lastSig = useRef(sig);
  useEffect(() => { if (lastSig.current !== sig) { lastSig.current = sig; setDismissed(''); } }, [sig]);

  if (check.status === 'checking') return title.trim().length >= 3 ? <p className="nl-bv-note" role="status">Checking Open Library…</p> : null;
  if ((check.status !== 'verified' && check.status !== 'suggest') || !check.best || dismissed === sig) return null;
  const b = check.best;
  const verified = check.status === 'verified';
  const showCover = !!b.coverLargeUrl && !hasCover;
  return (
    <div className="nl-bv" data-state={check.status} role="status">
      {b.coverUrl ? <img className="nl-bv-cover" src={b.coverUrl} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} /> : <span className="nl-bv-cover nl-bv-cover-empty"><BookOpen size={20} aria-hidden="true" /></span>}
      <div className="nl-bv-body">
        <span className="nl-bv-kicker">{verified ? <><Check size={13} aria-hidden="true" /> Matches Open Library</> : 'Open Library suggests'}</span>
        <p className="nl-bv-line"><strong>{b.title}</strong> by {check.bestAuthor || b.author}{b.publishYear ? <span> · first published {b.publishYear}</span> : null}</p>
        {!verified ? <p className="nl-bv-sub">{check.titleDiffers && check.authorDiffers ? 'Title and author differ from what you typed.' : check.titleDiffers ? 'The title is spelled differently from what you typed.' : 'The author is spelled differently from what you typed.'}</p> : null}
        <div className="nl-bv-actions">
          {!verified ? <button type="button" onClick={() => onUseDetails(b.title, check.bestAuthor || b.author)}>Use these details</button> : null}
          {showCover ? <button type="button" onClick={() => onUseCover(b.coverLargeUrl!)}>Use this cover</button> : null}
        </div>
      </div>
      <button type="button" className="nl-bv-x" onClick={() => setDismissed(sig)} aria-label="Dismiss Open Library suggestion"><X size={14} aria-hidden="true" /></button>
    </div>
  );
}
