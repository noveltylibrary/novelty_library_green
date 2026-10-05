import { useEffect, useRef, useState } from 'react';
import { useCookieConsent } from '@/lib/cookieConsent';

interface AdsterraAdSlotProps {
  className?: string;
  /** When false the ad is not requested yet (e.g. inside a closed dropdown). Default true. */
  active?: boolean;
}

type SlotState = 'loading' | 'filled' | 'empty';

const FILL_TIMEOUT_MS = 8000;
const POLL_MS = 350;

/** True once the ad script has put visible content into the iframe document. */
function iframeHasAd(doc: Document | null | undefined): boolean {
  const body = doc?.body;
  if (!body) return false;
  const nodes = body.querySelectorAll('iframe,img,ins,a,object,embed,video,canvas,svg');
  if (nodes.length > 0) return true;
  return Array.from(body.children).some((el) => el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE' && (el.textContent || '').trim().length > 0);
}

const AD_KEY = '94338a299763bb951992d9cd078429e9';
const AD_SCRIPT_SRC = import.meta.env.VITE_ADSTERRA_SCRIPT_URL || `https://bauval.org/22/${AD_KEY}`;

type AdWindow = Window & {
  atOptions?: { key: string; format: string; height: number; width: number; params: Record<string, unknown> };
};

/**
 * Adsterra 300x250 banner.
 *
 * The iframe is created with DOM calls and its document is written to directly
 * (instead of using `srcdoc`), which mobile browsers handle more reliably.
 *
 * `atOptions` is set from here, on the iframe's window, rather than through an
 * inline <script> inside the iframe. The iframe inherits the site's
 * Content-Security-Policy (vercel.json: script-src without 'unsafe-inline'),
 * which blocks inline scripts. The only script written into the iframe is the
 * external Adsterra one from bauval.org, which the policy allows.
 */
export function AdsterraAdSlot({ className = '', active = true }: AdsterraAdSlotProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const consent = useCookieConsent();
  const [state, setState] = useState<SlotState>('loading');

  useEffect(() => {
    if (consent !== 'all' || !active) return; // ads (third-party cookies) load only after "Accept all"
    const container = containerRef.current;
    if (!container) return;
    setState('loading');
    let poll: number | undefined;
    const startedAt = Date.now();

    container.innerHTML = '';

    const iframe = document.createElement('iframe');
    iframe.width = '300';
    iframe.height = '250';
    iframe.title = 'Sponsored advertisement';
    iframe.setAttribute('scrolling', 'no');
    iframe.setAttribute('frameborder', '0');
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.style.cssText = 'display:block;width:300px;height:250px;border:0;overflow:hidden;background:transparent;';
    container.appendChild(iframe);

    const win = iframe.contentWindow as AdWindow | null;
    const doc = iframe.contentDocument ?? win?.document;

    if (win && doc) {
      doc.open();
      win.atOptions = {
        key: AD_KEY,
        format: 'iframe',
        height: 250,
        width: 300,
        params: {},
      };
      doc.write(
        `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
          `<meta name="viewport" content="width=300, initial-scale=1">` +
          `<style>html,body{margin:0;padding:0;width:300px;height:250px;overflow:hidden;background:transparent;}</style>` +
          `</head><body><script src="${AD_SCRIPT_SRC}"></script></body></html>`,
      );
      doc.close();

      // Watch for the ad to appear; if nothing shows up, collapse to a single "Sponsored" line.
      poll = window.setInterval(() => {
        if (iframeHasAd(iframe.contentDocument)) {
          window.clearInterval(poll);
          setState('filled');
        } else if (Date.now() - startedAt > FILL_TIMEOUT_MS) {
          window.clearInterval(poll);
          setState('empty');
        }
      }, POLL_MS);
    } else {
      setState('empty');
    }

    return () => {
      if (poll) window.clearInterval(poll);
      container.innerHTML = '';
    };
  }, [consent, active]);

  if (consent !== 'all') return null;

  return (
    <div className={`adsterra-slot ${className}`} data-state={state} aria-label="Advertisement">
      <div className="adsterra-label"><span>SPONSORED</span></div>
      {/* The frame stays at 0 height until an ad is really there, so there is never a blank box. */}
      <div className="adsterra-frame">
        <div ref={containerRef} className="w-[300px] h-[250px] overflow-hidden" />
      </div>
    </div>
  );
}

export default AdsterraAdSlot;
