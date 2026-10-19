import { useEffect, useRef, useState } from 'react';
import { useCookieConsent } from '@/lib/cookieConsent';

interface AdSenseAdSlotProps {
  className?: string;
  /** When false the ad is not requested yet (e.g. inside a closed dropdown). Default true. */
  active?: boolean;
}

type SlotState = 'loading' | 'filled' | 'empty';

// Set both in Vercel → Settings → Environment Variables (then redeploy):
//   VITE_ADSENSE_CLIENT = optional override; defaults to the publisher ID below
//   VITE_ADSENSE_SLOT   = optional override; defaults to the "Novelty Library WebApp" ad unit below
const CLIENT = String(import.meta.env.VITE_ADSENSE_CLIENT || '').trim() || 'ca-pub-4287486804733527';
const SLOT = String(import.meta.env.VITE_ADSENSE_SLOT || '').trim() || '7417970298';

type AdsWindow = Window & { adsbygoogle?: unknown[] & { requestNonPersonalizedAds?: number } };

let scriptPromise: Promise<void> | null = null;

/** Loads Google's adsbygoogle.js only when an ad-enabled public page renders a slot after cookie consent. */
function loadAdSenseScript(): Promise<void> {
  const selector = 'script[data-nl-adsense], script[src*="pagead/js/adsbygoogle.js"]';
  const existing = document.querySelector<HTMLScriptElement>(selector);
  // The loader may have been removed after navigating to a route where ads are disabled.
  if (!existing) scriptPromise = null;
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    // Reuse the script if an eligible public page has already loaded it; otherwise load it only when an ad slot is mounted.
    const currentScript = document.querySelector<HTMLScriptElement>(selector);
    if (currentScript) { resolve(); return; }
    const s = document.createElement('script');
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.dataset.nlAdsense = '1';
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(CLIENT)}`;
    s.onload = () => resolve();
    // Blocked by an ad blocker / antivirus: the slot collapses instead of showing an empty box.
    s.onerror = () => { scriptPromise = null; s.remove(); reject(new Error('AdSense script blocked or failed to load')); };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/**
 * Google AdSense display slot, rendered directly in the page (AdSense does not allow ads inside sandboxed frames).
 * Cookie choice drives the ad type: "Accept all" = personalised, "Essential only" = non-personalised.
 * Renders nothing until the reader has chosen a cookie option.
 */
export function AdSenseAdSlot({ className = '', active = true }: AdSenseAdSlotProps) {
  const consent = useCookieConsent();
  const [state, setState] = useState<SlotState>('loading');
  const insRef = useRef<HTMLModElement>(null);
  const pushed = useRef(false);
  const enabled = !!CLIENT && !!SLOT;

  useEffect(() => {
    if (!enabled || !consent || !active || pushed.current) return;
    const ins = insRef.current;
    if (!ins) return;
    let cancelled = false;
    let timeout = 0;

    const observer = new MutationObserver(() => {
      const status = ins.getAttribute('data-ad-status');
      if (status === 'filled') { setState('filled'); window.clearTimeout(timeout); }
      else if (status === 'unfilled') { setState('empty'); window.clearTimeout(timeout); }
    });
    observer.observe(ins, { attributes: true, attributeFilter: ['data-ad-status'] });

    loadAdSenseScript().then(() => {
      if (cancelled || pushed.current) return;
      const w = window as AdsWindow;
      w.adsbygoogle = w.adsbygoogle || [];
      // "Essential only" → non-personalised ads (no cookies used for ad targeting).
      w.adsbygoogle.requestNonPersonalizedAds = consent === 'essential' ? 1 : 0;
      try { w.adsbygoogle.push({}); pushed.current = true; } catch { setState('empty'); }
      // No answer from Google in 8s (blocked network, no fill): collapse the slot.
      timeout = window.setTimeout(() => setState((s) => (s === 'loading' ? 'empty' : s)), 8000);
    }).catch(() => { if (!cancelled) setState('empty'); });

    return () => { cancelled = true; observer.disconnect(); window.clearTimeout(timeout); };
  }, [enabled, consent, active]);

  if (!enabled || !consent || !active) return null;

  return (
    <div className={`adsense-slot ${className}`} data-state={state} aria-label="Advertisement">
      <div className="adsense-label"><span>SPONSORED</span></div>
      <div className="adsense-frame">
        <ins
          ref={insRef}
          className="adsbygoogle"
          style={{ display: 'block' }}
          data-ad-client={CLIENT}
          data-ad-slot={SLOT}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    </div>
  );
}

export default AdSenseAdSlot;
