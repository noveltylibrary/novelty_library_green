import { useEffect, useRef, useState } from 'react';
import { useCookieConsent } from '@/lib/cookieConsent';

interface AdsterraAdSlotProps {
  className?: string;
  /** When false the ad is not requested yet (e.g. inside a closed dropdown). Default true. */
  active?: boolean;
}

type SlotState = 'loading' | 'filled' | 'empty';

const FILL_TIMEOUT_MS = 8000;

const AD_KEY = '94338a299763bb951992d9cd078429e9';
const AD_SCRIPT_SRC = import.meta.env.VITE_ADSTERRA_SCRIPT_URL || `https://bauval.org/22/${AD_KEY}`;

type AdWindow = Window & {
  atOptions?: { key: string; format: string; height: number; width: number; params: Record<string, unknown> };
};

export function AdsterraAdSlot({ className = '', active = true }: AdsterraAdSlotProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const consent = useCookieConsent();
  const [state, setState] = useState<SlotState>('loading');

  useEffect(() => {
    if (consent !== 'all' || !active) return;
    const container = containerRef.current;
    if (!container) return;
    setState('loading');
    container.innerHTML = '';

    // Adsterra's publisher code is designed to be pasted into the page itself.
    // The previous implementation created a synthetic iframe document, which can
    // prevent the publisher script/creative from initializing correctly.
    const win = window as AdWindow;
    const previous = win.atOptions;
    win.atOptions = { key: AD_KEY, format: 'iframe', height: 250, width: 300, params: {} };
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = AD_SCRIPT_SRC;
    script.async = false;
    script.onload = () => {
      window.setTimeout(() => setState('filled'), 250);
    };
    script.onerror = () => setState('empty');
    container.appendChild(script);

    const timeout = window.setTimeout(() => {
      // Keep the slot available for slow creatives; only collapse when the script
      // itself failed. Successful scripts can render after the normal timeout.
      if (!container.querySelector('iframe, img, ins, a, object, embed, video, canvas, svg')) {
        setState('filled');
      }
    }, FILL_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeout);
      container.innerHTML = '';
      if (previous) win.atOptions = previous;
      else delete win.atOptions;
    };
  }, [consent, active]);

  if (consent !== 'all') return null;

  return (
    <div className={`adsterra-slot ${className}`} data-state={state} aria-label="Advertisement">
      <div className="adsterra-label"><span>SPONSORED</span></div>
      <div className="adsterra-frame">
        <div ref={containerRef} className="w-[300px] h-[250px] overflow-hidden" />
      </div>
    </div>
  );
}

export default AdsterraAdSlot;
