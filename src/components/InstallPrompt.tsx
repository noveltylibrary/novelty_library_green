import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, Download, ExternalLink, PlusSquare, Share, X } from 'lucide-react';
import { dismissInstallBanner, isInstallBannerDismissed, usePwaInstall } from '@/lib/pwa';

/**
 * Dismissible install banner, fixed to the viewport so it never shifts layout.
 * - Chrome / Edge / Samsung (Android + desktop): one-tap native install.
 * - iPhone / iPad: those browsers have no install API, so we show the Share -> Add to Home Screen steps.
 * - In-app browsers (Instagram, Facebook...): installing is impossible there, so we ask to open the real browser.
 */
export function InstallPrompt() {
  const { canInstall, isInstalled, platform, install } = usePwaInstall();
  const [dismissed, setDismissed] = useState(isInstallBannerDismissed);
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);

  // Manual-instruction banners wait a few seconds so they don't cover the page the moment it opens.
  useEffect(() => { const t = window.setTimeout(() => setReady(true), 3500); return () => window.clearTimeout(t); }, []);

  const mode: 'native' | 'ios' | 'in-app' | null = isInstalled ? null : canInstall ? 'native' : ready && platform === 'ios' ? 'ios' : ready && platform === 'in-app' ? 'in-app' : null;
  const show = mode !== null && !dismissed;
  const close = () => { dismissInstallBanner(); setDismissed(true); };
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); window.setTimeout(() => setCopied(false), 2000); }
    catch { window.prompt('Copy this link and open it in Chrome or Safari:', window.location.href); }
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="fixed left-1/2 z-[90] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-teal-500/30 bg-slate-900/95 p-3.5 shadow-[0_8px_40px_rgba(6,182,212,0.25)] backdrop-blur"
          style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
          role="dialog"
          aria-label="Install Novelty Library"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-teal-400 text-slate-950">
              {mode === 'in-app' ? <ExternalLink className="h-5 w-5" /> : <Download className="h-5 w-5" />}
            </span>
            <div className="min-w-0 flex-1">
              {mode === 'native' && (<>
                <p className="text-sm font-semibold text-white">Install Web App</p>
                <p className="truncate text-xs text-slate-400">Add Novelty Library to your home screen.</p>
              </>)}
              {mode === 'ios' && (<>
                <p className="text-sm font-semibold text-white">Install on your iPhone</p>
                <p className="text-xs leading-snug text-slate-300">Tap <Share className="mx-0.5 inline h-3.5 w-3.5 -translate-y-px" /> Share, then <PlusSquare className="mx-0.5 inline h-3.5 w-3.5 -translate-y-px" /> <b>Add to Home Screen</b>.</p>
              </>)}
              {mode === 'in-app' && (<>
                <p className="text-sm font-semibold text-white">Open in your browser to install</p>
                <p className="text-xs leading-snug text-slate-300">This in-app browser can't install apps. Copy the link and open it in Chrome or Safari.</p>
              </>)}
            </div>
            {mode === 'native' && (
              <button onClick={() => void install()} className="rounded-full bg-gradient-to-r from-cyan-400 to-teal-400 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:from-cyan-300 hover:to-teal-300">Install</button>
            )}
            {mode === 'in-app' && (
              <button onClick={() => void copyLink()} className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-cyan-400 to-teal-400 px-3.5 py-2 text-xs font-semibold text-slate-950">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Copied' : 'Copy link'}
              </button>
            )}
            <button onClick={close} className="rounded-full p-1.5 text-slate-400 transition hover:text-white" aria-label="Dismiss"><X className="h-4 w-4" /></button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
