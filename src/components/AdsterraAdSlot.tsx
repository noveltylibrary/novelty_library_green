import { useEffect, useState } from 'react';
import { useCookieConsent } from '@/lib/cookieConsent';

interface AdsterraAdSlotProps {
  className?: string;
  /** When false the ad is not requested yet (e.g. inside a closed dropdown). Default true. */
  active?: boolean;
}

type SlotState = 'loading' | 'filled' | 'empty';

// The ad lives in /ad-frame.html, a static page with its OWN Content-Security-Policy (see vercel.json), so the app's
// own policy can stay strict. Optionally host it on a separate origin: VITE_AD_FRAME_ORIGIN=https://ads.your-domain.com
const FRAME_ORIGIN = String(import.meta.env.VITE_AD_FRAME_ORIGIN || '').replace(/\/$/, '');
const FRAME_SRC = FRAME_ORIGIN ? `${FRAME_ORIGIN}/ad-frame.html` : `${import.meta.env.BASE_URL}ad-frame.html`;
const FRAME_IS_SEPARATE_ORIGIN = (() => { try { return !!FRAME_ORIGIN && new URL(FRAME_ORIGIN).origin !== window.location.origin; } catch { return false; } })();

/**
 * Two ad modes, chosen by the reader's cookie choice:
 *  - Essential only: non-personalised. The frame is sandboxed without allow-same-origin and sends no referrer,
 *    so the ad code gets no cookies/storage and cannot recognise the reader.
 *  - Accept all: personalised ads, ONLY when the ad frame is on a separate origin (VITE_AD_FRAME_ORIGIN). Then
 *    allow-same-origin is safe because the ad code can never reach the app's storage or login session. Without a
 *    separate origin the frame stays fully sandboxed (ads still show, but the network cannot use cookies).
 */
export function AdsterraAdSlot({ className = '', active = true }: AdsterraAdSlotProps) {
  const consent = useCookieConsent();
  const [state, setState] = useState<SlotState>('loading');
  const personalised = consent === 'all' && FRAME_IS_SEPARATE_ORIGIN;

  useEffect(() => { if (consent && active) setState('loading'); }, [consent, active]);

  // No ads until the reader has made a cookie choice (the banner is still showing).
  if (!consent || !active) return null;

  return (
    <div className={`adsterra-slot ${className}`} data-state={state} aria-label="Advertisement">
      <div className="adsterra-label"><span>SPONSORED</span></div>
      <div className="adsterra-frame">
        <iframe
          key={personalised ? 'personalised' : 'basic'}
          data-ad-mode={personalised ? 'personalised' : 'non-personalised'}
          title="Advertisement"
          src={FRAME_SRC}
          width={300}
          height={250}
          scrolling="no"
          loading="lazy"
          referrerPolicy={personalised ? 'no-referrer-when-downgrade' : 'no-referrer'}
          sandbox={`allow-scripts allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation${personalised ? ' allow-same-origin' : ''}`}
          style={{ border: 0, display: 'block', width: 300, height: 250, maxWidth: '100%' }}
          onLoad={() => window.setTimeout(() => setState('filled'), 400)}
          onError={() => setState('empty')}
        />
      </div>
    </div>
  );
}

export default AdsterraAdSlot;
