import { useEffect, useState } from 'react';
import { AnimatedBook } from '@/components/AnimatedBook';

const KEY = 'nl-splash-seen';

function alreadySeen() {
  try { return sessionStorage.getItem(KEY) === '1'; } catch { return false; }
}

/** Brief branded intro: the book pops up and flips pages, then fades out. Once per browser session. */
export function SplashIntro() {
  const [visible, setVisible] = useState(() => !alreadySeen());
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    try { sessionStorage.setItem(KEY, '1'); } catch { /* ignore */ }
    const t1 = window.setTimeout(() => setLeaving(true), 2100);
    const t2 = window.setTimeout(() => setVisible(false), 2700);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [visible]);

  if (!visible) return null;
  return (
    <div className={`nl-splash${leaving ? ' is-leaving' : ''}`} aria-hidden>
      <AnimatedBook size={150} />
      <div className="nl-splash-title">Novelty Library</div>
    </div>
  );
}
