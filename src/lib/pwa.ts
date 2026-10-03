import { useSyncExternalStore } from 'react';

/** Singleton listener so the `beforeinstallprompt` event is never missed (it can fire before React mounts). */
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let deferred: InstallEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  installed =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installed = true;
    emit();
  });
}

const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
const getCanInstall = () => deferred !== null && !installed;

export async function promptInstall(): Promise<void> {
  if (!deferred) return;
  const ev = deferred;
  await ev.prompt();
  await ev.userChoice;
  deferred = null; // the browser only allows one prompt per event
  emit();
}

export function usePwaInstall() {
  const canInstall = useSyncExternalStore(subscribe, getCanInstall, () => false);
  return { canInstall, install: promptInstall };
}

const DISMISS_KEY = 'nl-install-dismissed-at';
const DISMISS_DAYS = 7;

export function isInstallBannerDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < DISMISS_DAYS * 86400000;
  } catch { return false; }
}
export function dismissInstallBanner(): void {
  try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* storage unavailable */ }
}
