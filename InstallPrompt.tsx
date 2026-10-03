import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, X } from 'lucide-react';
import { dismissInstallBanner, isInstallBannerDismissed, usePwaInstall } from '@/lib/pwa';

/** Dismissible install banner. Fixed to the viewport, so it never shifts page layout. */
export function InstallPrompt() {
  const { canInstall, install } = usePwaInstall();
  const [dismissed, setDismissed] = useState(isInstallBannerDismissed);
  const show = canInstall && !dismissed;

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
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-teal-400 text-slate-950"><Download className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">Install Web App</p>
              <p className="truncate text-xs text-slate-400">Add Novelty Library to your home screen.</p>
            </div>
            <button onClick={() => void install()} className="rounded-full bg-gradient-to-r from-cyan-400 to-teal-400 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:from-cyan-300 hover:to-teal-300">Install</button>
            <button onClick={() => { dismissInstallBanner(); setDismissed(true); }} className="rounded-full p-1.5 text-slate-400 transition hover:text-white" aria-label="Dismiss"><X className="h-4 w-4" /></button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
