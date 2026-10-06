import { useEffect, useMemo, useState } from 'react';
import { useCookieConsent } from '@/lib/cookieConsent';

interface AdsterraAdSlotProps {
  className?: string;
  /** When false the ad is not requested yet (e.g. inside a closed dropdown). Default true. */
  active?: boolean;
}

type SlotState = 'loading' | 'filled' | 'empty';

const AD_KEY = '94338a299763bb951992d9cd078429e9';
const AD_SCRIPT_SRC = import.meta.env.VITE_ADSTERRA_SCRIPT_URL || `https://bauval.org/22/${AD_KEY}`;

/**
 * Two ad modes, chosen by the reader's cookie choice:
 *  - 'essential' (Essential only): non-personalised ads. The frame is sandboxed WITHOUT allow-same-origin and sends
 *    no referrer, so the ad code gets no cookies/storage and cannot recognise the reader (contextual / random ads).
 *  - 'all' (Accept all): personalised ads. The frame may keep the ad network's cookies/storage so it can tailor ads.
 * The ad runs inside its own iframe (srcDoc). Adsterra's invoke script uses document.write and
 * sets a global `atOptions`; isolating it in an iframe keeps both away from the app's page, and the
 * 'essential' sandbox has NO allow-same-origin, so third-party ad code can never read the app's storage or login.
 * NOTE: a srcDoc iframe inherits the page's Content-Security-Policy, so vercel.json must allow the ad
 * network's scripts (inline + https:) or the creative is silently blocked.
 */
export function AdsterraAdSlot({ className = '', active = true }: AdsterraAdSlotProps) {
  const consent = useCookieConsent();
  const [state, setState] = useState<SlotState>('loading');
  const personalised = consent === 'all';

  const srcDoc = useMemo(() => `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>html,body{margin:0;padding:0;overflow:hidden;background:transparent}</style></head><body><script>atOptions={'key':'${AD_KEY}','format':'iframe','height':250,'width':300,'params':{}};<\/script><script src="${AD_SCRIPT_SRC}"><\/script></body></html>`, []);

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
          srcDoc={srcDoc}
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
