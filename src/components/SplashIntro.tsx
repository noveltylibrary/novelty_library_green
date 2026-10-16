import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { startSplashParticles, type SplashFx } from '@/lib/splashParticles';
import './SplashIntro.css';

const KEY = 'nl-splash-seen';
/** Whole film, ms from the moment the picture is ready. Keep in sync with the --t-* values in SplashIntro.css. */
const INTRO_DURATION = 8800;
/** When the fly-through exit starts. */
const EXIT_AT = 8050;
/** The book "ignites" (flash + ring + spark burst + logo) at this moment. */
const IGNITE_AT = 3500;
/** Never wait longer than this for the picture before starting anyway. */
const READY_FALLBACK = 1800;
const SKIP_FADE = 380;

function alreadySeen() {
  try { return sessionStorage.getItem(KEY) === '1'; } catch { return false; }
}

const css = (vars: Record<string, string | number>) => vars as unknown as CSSProperties;

/** Light shafts from the window: left / width as % of the plate, rotation, strength, delay. */
const RAYS = [
  { l: '80%', w: '3.4%', r: '21deg', o: 0.5, d: '.3s' },
  { l: '85%', w: '2.4%', r: '23deg', o: 0.42, d: '.55s' },
  { l: '89%', w: '6%', r: '25deg', o: 0.5, d: '.4s' },
  { l: '93%', w: '3.2%', r: '27deg', o: 0.38, d: '.7s' },
  { l: '97%', w: '7%', r: '29deg', o: 0.44, d: '.5s' },
];

/** Word-by-word reveal. */
function Words({ text, start, step, accentFrom }: { text: string; start: number; step: number; accentFrom?: number }) {
  const words = text.split(' ');
  return (
    <>
      {words.map((w, i) => (
        <span
          key={`${w}-${i}`}
          className={`nl-sx-w${accentFrom !== undefined && i >= accentFrom ? ' is-accent' : ''}`}
          style={css({ '--d': `${(start + i * step).toFixed(2)}s` })}
        >
          {w}
        </span>
      ))}
    </>
  );
}

/** Letter-by-letter reveal, grouped per word so the line can wrap between words. */
function Chars({ text }: { text: string }) {
  let n = 0;
  return (
    <>
      {text.split(' ').map((word, wi) => (
        <span className="nl-sx-bw" key={`${word}-${wi}`}>
          {Array.from(word).map((c) => {
            const i = n;
            n += 1;
            return <span className="nl-sx-ch" key={i} style={css({ '--i': i })}>{c}</span>;
          })}
        </span>
      ))}
    </>
  );
}

/** Cinematic, session-scoped brand reveal. The application renders underneath it. */
export function SplashIntro({ onComplete }: { onComplete?: () => void }) {
  const [visible, setVisible] = useState(() => !alreadySeen());
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const completeRef = useRef(onComplete);
  const finishedRef = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const plateRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<SplashFx | null>(null);
  completeRef.current = onComplete;

  // Already seen this session: just tell the app we are done.
  useEffect(() => {
    if (visible) return;
    const t = window.setTimeout(() => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      completeRef.current?.();
    }, 0);
    return () => window.clearTimeout(t);
  }, [visible]);

  // Wait for the library picture so the film never starts on an empty frame.
  useEffect(() => {
    if (!visible || ready) return;
    try { sessionStorage.setItem(KEY, '1'); } catch { /* storage can be unavailable */ }
    if (plateRef.current?.complete && plateRef.current.naturalWidth > 0) { setLoaded(true); setReady(true); }
    const t = window.setTimeout(() => setReady(true), READY_FALLBACK);
    return () => window.clearTimeout(t);
  }, [visible, ready]);

  // The timeline: particles, exit and completion.
  useEffect(() => {
    if (!visible || !ready) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const exitDelay = reduced ? 1100 : EXIT_AT;
    const finishDelay = reduced ? 1450 : INTRO_DURATION;

    const canvas = canvasRef.current;
    if (!reduced && canvas) {
      fxRef.current = startSplashParticles(canvas, { igniteAt: IGNITE_AT, lite: window.innerWidth < 700 });
    }

    const t1 = window.setTimeout(() => {
      setLeaving(true);
      fxRef.current?.exit();
    }, exitDelay);
    const t2 = window.setTimeout(() => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      setVisible(false);
      completeRef.current?.();
    }, finishDelay);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      fxRef.current?.stop();
      fxRef.current = null;
    };
  }, [visible, ready]);

  const skip = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setSkipping(true);
    setLeaving(true);
    fxRef.current?.exit();
    window.setTimeout(() => {
      setVisible(false);
      completeRef.current?.();
    }, SKIP_FADE);
  }, []);

  // Escape skips as well.
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') skip(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, skip]);

  // Gentle pointer parallax (desktop): the whole plate leans a few pixels with the cursor.
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = rootRef.current;
    if (!el) return;
    el.style.setProperty('--px', (e.clientX / window.innerWidth - 0.5).toFixed(3));
    el.style.setProperty('--py', (e.clientY / window.innerHeight - 0.5).toFixed(3));
  };

  if (!visible) return null;

  const cls = ['nl-splash', ready ? 'is-playing' : '', leaving ? 'is-leaving' : '', skipping ? 'is-skipping' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={rootRef}
      className={cls}
      aria-label="Novelty Library introduction"
      role="status"
      onPointerMove={onPointerMove}
    >
      <span className="nl-splash-sr">Novelty Library. Every book opens a world. Discover your next chapter.</span>

      {/* ───────── The living library: picture, light, magic ───────── */}
      <div className="nl-sx-parallax" aria-hidden="true">
        <div className="nl-sx-zoom">
          <div className="nl-sx-hand">
            <div className="nl-sx-cam">
              <div className="nl-sx-stage">
                <img
                  ref={plateRef}
                  className={`nl-sx-plate${loaded ? ' is-in' : ''}`}
                  src="/novelty-library-intro-library.webp"
                  alt=""
                  width={1600}
                  height={748}
                  decoding="async"
                  draggable={false}
                  onLoad={() => { setLoaded(true); setReady(true); }}
                  onError={() => setReady(true)}
                />

                {/* moving colour theme: deep teal → bright cyan, drifting between the two */}
                <div className="nl-sx-grade nl-sx-grade-deep" />
                <div className="nl-sx-grade nl-sx-grade-cyan" />
                <div className="nl-sx-sun" />

                {/* drifting mist at two depths */}
                <div className="nl-sx-fog nl-sx-fog-1" />
                <div className="nl-sx-fog nl-sx-fog-2" />

                {/* practical lights */}
                <div className="nl-sx-glow nl-sx-glow-window" />
                <div className="nl-sx-glow nl-sx-glow-chandelier" />
                <div className="nl-sx-glow nl-sx-glow-lantern" />
                <div className="nl-sx-glow nl-sx-glow-hall" />
                <span className="nl-sx-candle nl-sx-candle-1" />
                <span className="nl-sx-candle nl-sx-candle-2" />
                <span className="nl-sx-candle nl-sx-candle-3" />
                <span className="nl-sx-candle nl-sx-candle-4" />
                <span className="nl-sx-candle nl-sx-candle-5" />

                {/* god rays */}
                <div className="nl-sx-rays">
                  {RAYS.map((ray, i) => (
                    <i key={i} className="nl-sx-ray" style={css({ '--l': ray.l, '--w': ray.w, '--r': ray.r, '--o': ray.o, '--d': ray.d, '--k': i })}>
                      <b />
                    </i>
                  ))}
                </div>

                {/* the magic swirls, lifted from the picture so they stay perfectly aligned */}
                <img className="nl-sx-swirl nl-sx-swirl-l is-bloom" src="/novelty-library-intro-swirl-l.webp" alt="" draggable={false} />
                <img className="nl-sx-swirl nl-sx-swirl-l" src="/novelty-library-intro-swirl-l.webp" alt="" draggable={false} />
                <img className="nl-sx-swirl nl-sx-swirl-r is-bloom" src="/novelty-library-intro-swirl-r.webp" alt="" draggable={false} />
                <img className="nl-sx-swirl nl-sx-swirl-r" src="/novelty-library-intro-swirl-r.webp" alt="" draggable={false} />

                {/* the book wakes up */}
                <div className="nl-sx-glow nl-sx-glow-book" />
                <div className="nl-sx-ring" />
                <div className="nl-sx-ignite" />
                <span className="nl-sx-streak nl-sx-streak-chandelier" />
                <span className="nl-sx-streak nl-sx-streak-book" />

                {/* tea steam */}
                <span className="nl-sx-steam nl-sx-steam-1" />
                <span className="nl-sx-steam nl-sx-steam-2" />
                <span className="nl-sx-steam nl-sx-steam-3" />

                <canvas ref={canvasRef} className="nl-sx-fx" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ───────── Film finish ───────── */}
      <div className="nl-sx-vignette" aria-hidden="true" />
      <div className="nl-sx-grain" aria-hidden="true" />
      <div className="nl-sx-foot" aria-hidden="true" />
      <div className="nl-sx-flash" aria-hidden="true" />

      {/* ───────── Title sequence ───────── */}
      <div className="nl-sx-content" aria-hidden="true">
        <div className="nl-sx-beat nl-sx-beat-a">
          <h2 className="nl-sx-title"><Words text="Every book opens a world." start={0.7} step={0.22} accentFrom={4} /></h2>
          <span className="nl-sx-rule" />
        </div>

        <div className="nl-sx-beat nl-sx-beat-b">
          <div className="nl-sx-logo-wrap">
            <span className="nl-sx-halo" />
            <img className="nl-sx-logo" src="/novelty-library-logo-white.png" alt="Novelty Library" />
          </div>
          <div className="nl-sx-brand"><Chars text="NOVELTY LIBRARY" /></div>
          <div className="nl-sx-ornament"><span /><i>✦</i><span /></div>
          <p className="nl-sx-sub"><Words text="Discover your next chapter." start={5.1} step={0.17} /></p>
        </div>
      </div>

      {/* ───────── Credits (no bars: they sit directly on the picture) ───────── */}
      <div className="nl-sx-credits" aria-hidden="true">
        <span className="nl-sx-credit nl-sx-credit-l">Stories change everything.</span>
        <span className="nl-sx-credit nl-sx-credit-r">Read · Explore · Belong</span>
      </div>

      <button className="nl-sx-skip" type="button" onClick={skip} aria-label="Skip introduction">
        Skip intro <span aria-hidden="true">↗</span>
      </button>
    </div>
  );
}
