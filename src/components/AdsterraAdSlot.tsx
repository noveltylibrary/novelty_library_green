import { useEffect, useRef } from 'react';

interface AdsterraAdSlotProps {
  className?: string;
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
export function AdsterraAdSlot({ className = '' }: AdsterraAdSlotProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

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
    }

    return () => {
      container.innerHTML = '';
    };
  }, []);

  return (
    <div className={`adsterra-slot ${className}`} aria-label="Advertisement">
      <div className="adsterra-label">SPONSORED</div>
      <div ref={containerRef} className="w-[300px] h-[250px] overflow-hidden" />
    </div>
  );
}

export default AdsterraAdSlot;
