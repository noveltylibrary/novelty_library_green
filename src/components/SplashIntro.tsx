import { useEffect, useRef, useState } from 'react';

const KEY = 'nl-splash-seen';
const INTRO_DURATION = 4400;
const EXIT_AT = 3970;

function alreadySeen() {
  try { return sessionStorage.getItem(KEY) === '1'; } catch { return false; }
}

interface SplashIntroProps {
  onComplete?: () => void;
}

/** Lightweight, session-scoped brand reveal. The application renders underneath it. */
export function SplashIntro({ onComplete }: SplashIntroProps) {
  const [visible, setVisible] = useState(() => !alreadySeen());
  const [leaving, setLeaving] = useState(false);
  const completeRef = useRef(onComplete);
  const finishedRef = useRef(false);
  completeRef.current = onComplete;

  useEffect(() => {
    if (!visible) {
      if (!finishedRef.current) {
        finishedRef.current = true;
        const t = window.setTimeout(() => completeRef.current?.(), 0);
        return () => window.clearTimeout(t);
      }
      return;
    }

    try { sessionStorage.setItem(KEY, '1'); } catch { /* storage can be unavailable */ }
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const exitDelay = reducedMotion ? 180 : EXIT_AT;
    const finishDelay = reducedMotion ? 420 : INTRO_DURATION;
    const t1 = window.setTimeout(() => setLeaving(true), exitDelay);
    const t2 = window.setTimeout(() => {
      finishedRef.current = true;
      setVisible(false);
      completeRef.current?.();
    }, finishDelay);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [visible]);

  const skip = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setLeaving(true);
    window.setTimeout(() => {
      setVisible(false);
      completeRef.current?.();
    }, 180);
  };

  if (!visible) return null;
  return (
    <div className={`nl-splash${leaving ? ' is-leaving' : ''}`} aria-label="Novelty Library introduction" role="status">
      <div className="nl-splash-scene" aria-hidden="true">
        <div className="nl-splash-horizon" />
        <div className="nl-splash-scene-clean-center" />
        <div className="nl-splash-shelf nl-splash-shelf-left" />
        <div className="nl-splash-shelf nl-splash-shelf-right" />
        <span className="nl-splash-particle nl-splash-particle-1" />
        <span className="nl-splash-particle nl-splash-particle-2" />
        <span className="nl-splash-particle nl-splash-particle-3" />
        <span className="nl-splash-particle nl-splash-particle-4" />
      </div>
      <div className="nl-splash-editorial nl-splash-editorial-left" aria-hidden="true">Stories change<br />everything.</div>
      <div className="nl-splash-editorial nl-splash-editorial-right" aria-hidden="true">Read · Explore · Belong</div>
      <div className="nl-splash-content">
        <img className="nl-splash-logo" src="/novelty-library-logo-white.png" alt="Novelty Library" />
        <div className="nl-splash-brand">NOVELTY LIBRARY</div>
        <div className="nl-splash-title">Every book opens a world.</div>
        <div className="nl-splash-subtitle">Discover your next chapter.</div>
        <div className="nl-splash-ornament" aria-hidden="true"><span /><i>✦</i><span /></div>
      </div>
      <button className="nl-splash-skip" type="button" onClick={skip} aria-label="Skip introduction">Skip intro <span aria-hidden="true">↗</span></button>
    </div>
  );
}

