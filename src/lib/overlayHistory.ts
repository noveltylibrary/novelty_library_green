import { useEffect, useRef } from 'react';

/**
 * Back-button friendly popups.
 *
 * While a popup / sheet / lightbox is open it owns one browser-history entry (same URL, so the router is never
 * involved). The browser Back button, a swipe-back or the Android back key therefore closes the popup and leaves
 * you on the page you were on, at the same scroll position and on the control you tapped. Closing with the X,
 * the backdrop or Escape removes that same entry again, so Back afterwards still goes to the previous page.
 *
 * Usage: `useOverlayHistory(open, close)` in the component that owns the popup state (pass `true` when the
 * popup component is only mounted while it is open).
 */
interface Entry {
  close: () => void;
  depth: number;
  cancelled: boolean;
  scrollY: number;
  origin: HTMLElement | null;
}

const stack: Entry[] = [];
let queue: Promise<void> = Promise.resolve();
let expectPops = 0;
let popWaiter: (() => void) | null = null;
let installed = false;
let lastTrigger: HTMLElement | null = null;

const enqueue = (job: () => void | Promise<void>): Promise<void> => {
  queue = queue.then(job).catch(() => undefined);
  return queue;
};

const triggerOf = (target: EventTarget | null): HTMLElement | null =>
  target instanceof Element ? (target.closest('button, a, summary, [role="button"], [tabindex]') as HTMLElement | null) : null;

function install() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  // Remember which control opened a popup, so focus and scroll can return to exactly that spot.
  document.addEventListener('pointerdown', (e) => { lastTrigger = triggerOf(e.target); }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') lastTrigger = triggerOf(e.target); }, true);
  window.addEventListener('popstate', onPop);
}

/** Go back `n` history entries and resolve once the browser reports it (or after a short safety timeout). */
function backBy(n: number): Promise<void> {
  return new Promise((resolve) => {
    expectPops += 1;
    popWaiter = resolve;
    window.setTimeout(() => { if (popWaiter === resolve) { popWaiter = null; expectPops = Math.max(0, expectPops - 1); resolve(); } }, 600);
    window.history.go(-n);
  });
}

function restoreSpot(entry: Entry) {
  const apply = () => {
    if (Math.abs(window.scrollY - entry.scrollY) > 2) window.scrollTo(0, entry.scrollY);
    const el = entry.origin;
    if (el && el.isConnected) {
      try { el.focus({ preventScroll: true }); } catch { /* not focusable */ }
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) el.scrollIntoView({ block: 'center' });
    }
  };
  window.requestAnimationFrame(() => { apply(); window.setTimeout(apply, 140); });
}

function onPop(e: PopStateEvent) {
  if (expectPops > 0) {
    expectPops -= 1;
    const done = popWaiter; popWaiter = null; done?.();
    return;
  }
  // A real Back / Forward. history.state.nlOv tells how many popup entries sit under the page we landed on.
  const depth = typeof e.state?.nlOv === 'number' ? e.state.nlOv : 0;
  if (stack.length > depth) {
    const closing = stack.splice(depth);
    const lowest = closing[0];
    closing.reverse().forEach((entry) => entry.close());
    restoreSpot(lowest);
  } else if (depth > stack.length) {
    // Forward onto a popup entry whose popup is gone: step straight back out of it.
    void enqueue(() => backBy(depth - stack.length));
  }
}

/** How many popups are currently open. */
export const overlayDepth = (): number => stack.length;

/** Close every open popup (without losing the page underneath) and resolve when history is settled. */
export function closeAllOverlays(): Promise<void> {
  if (stack.length) {
    const closing = stack.splice(0);
    const lowest = closing[0];
    closing.reverse().forEach((entry) => entry.close());
    void enqueue(async () => {
      const d = typeof window.history.state?.nlOv === 'number' ? window.history.state.nlOv : 0;
      if (d > 0) await backBy(d);
      restoreSpot(lowest);
    });
  }
  return queue;
}

export function useOverlayHistory(open: boolean, onClose: () => void): void {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    install();
    const entry: Entry = { close: () => closeRef.current(), depth: 0, cancelled: false, scrollY: window.scrollY, origin: lastTrigger && lastTrigger.isConnected ? lastTrigger : null };
    // Deferred one tick so React StrictMode's mount/unmount/mount in development pushes only one entry.
    const timer = window.setTimeout(() => {
      void enqueue(() => {
        if (entry.cancelled) return;
        entry.depth = stack.length + 1;
        stack.push(entry);
        window.history.pushState({ nlOv: entry.depth }, '');
      });
    }, 0);

    return () => {
      entry.cancelled = true;
      window.clearTimeout(timer);
      void enqueue(async () => {
        const index = stack.indexOf(entry);
        if (index === -1) return; // already closed by Back / navigation
        stack.splice(index, 1);
        // Only unwind history if we are still sitting on this popup's own entry (not after a link navigated away).
        if (index === stack.length && window.history.state?.nlOv === entry.depth) {
          await backBy(1);
          restoreSpot(entry);
        }
      });
    };
  }, [open]);
}
