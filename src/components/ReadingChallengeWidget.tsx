import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { paceFor, type ReadingChallenge } from '@/lib/readingChallenge';

/** Reading challenge progress; detailed pace feedback is private to the profile owner. */
export function ReadingChallengeWidget({ challenge, read, isOwn = false, isDefault = false }: { challenge: ReadingChallenge; read: number; isOwn?: boolean; isDefault?: boolean }) {
  const now = new Date();
  const pace = paceFor(read, challenge.goal, now);
  // Fill from 0 so the bar animates in on first paint and on every change.
  const [fill, setFill] = useState(0);
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setFill(pace.pct));
    return () => window.cancelAnimationFrame(id);
  }, [pace.pct]);
  return (
    <section className={`surface-card nl-rc is-${pace.tone}`} aria-label={`${now.getFullYear()} reading challenge`}>
      <div className="nl-rc-head">
        <h3 className="nl-rc-title"><Trophy aria-hidden="true" className="nl-rc-ico" /> {now.getFullYear()} Reading Challenge</h3>
        <p className="nl-rc-count"><strong>{read}</strong> / <strong>{challenge.goal}</strong> read this year</p>
      </div>
      <div className="nl-rc-bar" role="progressbar" aria-valuemin={0} aria-valuemax={challenge.goal} aria-valuenow={Math.min(read, challenge.goal)} aria-label="Reading challenge progress">
        <span className="nl-rc-fill" style={{ width: `${fill}%` }} />
      </div>
      {isOwn && <p className="nl-rc-sub">{pace.text}{isDefault ? ' This uses the default goal; personalize it any time in Edit profile › Reading goals.' : ''}</p>}
    </section>
  );
}
