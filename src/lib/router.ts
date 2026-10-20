import { useEffect, useState, useCallback } from 'react';
import { closeAllOverlays, overlayDepth } from '@/lib/overlayHistory';

export type Route =
  | { name: 'home' }
  | { name: 'reviews' }
  | { name: 'analytics' }
  | { name: 'live-rankings' }
  | { name: 'taste-match' }
  | { name: 'review'; slug: string }
  | { name: 'blog-review'; id: string }
  | { name: 'submit' }
  | { name: 'review-guidelines' }
  | { name: 'about' }
  | { name: 'privacy' }
  | { name: 'terms' }
  | { name: 'cookies' }
  | { name: 'auth' }
  | { name: 'admin' }
  | { name: 'admin-reviews' }
  | { name: 'admin-master-list' }
  | { name: 'admin-posters' }
  | { name: 'admin-book-reviews'; tab: 'submitted' | 'accepted' | 'published' | 'reserved' | 'posters' | 'community' }
  | { name: 'admin-admins'; tab?: 'control' | 'notifications' | 'taste' }
  | { name: 'admin-users' }
  | { name: 'admin-finances' }
  | { name: 'admin-pages'; view?: 'editor' | 'guide' | 'about' | 'profile' | 'announcements' | 'roadmap' | 'submit' }
  | { name: 'profile'; username?: string }
  | { name: 'account' }
  | { name: 'notifications' }
  | { name: 'genre'; genre: string }
  | { name: 'author'; author: string }
  | { name: 'authors' }
  | { name: 'reviewers' }
  | { name: 'reviewer'; uid: string }
  | { name: 'saved' };

function parseHash(): Route {
  const hash = window.location.hash.replace(/^#\/?/, '');
  if (!hash || hash === '') return { name: 'home' };
  // Support nested action fragments such as #/submit#reserve. The first hash
  // selects the app route; the trailing fragment is an action handled by the page.
  const routeHash = hash.split('#')[0];
  const parts = routeHash.split('/');
  // Backwards compatibility for the former embedded Taste Match anchor.
  if (parts[0] === 'live-rankings' && hash.includes('#taste')) return { name: 'taste-match' };
  if (parts[0] === 'review' && parts[1]) return { name: 'review', slug: decodeURIComponent(parts[1]) };
  if (parts[0] === 'blog-review' && parts[1]) return { name: 'blog-review', id: decodeURIComponent(parts.slice(1).join('/')) };
  if (parts[0] === 'submit') return { name: 'submit' };
  if (parts[0] === 'review-guidelines') return { name: 'review-guidelines' };
  if (parts[0] === 'about') return { name: 'about' };
  if (parts[0] === 'privacy') return { name: 'privacy' };
  if (parts[0] === 'terms') return { name: 'terms' };
  if (parts[0] === 'cookies') return { name: 'cookies' };
  if (parts[0] === 'auth') return { name: 'auth' };
  if (parts[0] === 'admin') {
    if (parts[1] === 'reviews') return { name: 'admin-reviews' };
    if (parts[1] === 'master-list') return { name: 'admin-master-list' };
    if (parts[1] === 'posters') return { name: 'admin-posters' };
    if (parts[1] === 'admins') return { name: 'admin-admins', tab: 'control' };
    if (parts[1] === 'notify' || parts[1] === 'notifications') return { name: 'admin-admins', tab: 'notifications' };
    if (parts[1] === 'announcements') return { name: 'admin-pages', view: 'announcements' };
    if (parts[1] === 'roadmap') return { name: 'admin-pages', view: 'roadmap' };
    if (parts[1] === 'submit-freeze' || parts[1] === 'freeze') return { name: 'admin-pages', view: 'submit' };
    if (parts[1] === 'taste' || parts[1] === 'taste-match') return { name: 'admin-admins', tab: 'taste' };
    if (parts[1] === 'users') return { name: 'admin-users' };
    if (parts[1] === 'finances') return { name: 'admin-finances' };
    if (parts[1] === 'pages') return { name: 'admin-pages', view: (['editor', 'guide', 'about', 'profile', 'announcements', 'roadmap', 'submit'] as const).find((v) => v === parts[2]) };
    if (parts[1] === 'book-reviews') {
      const validTabs = ['submitted', 'accepted', 'published', 'reserved', 'posters', 'community'] as const;
      const requested = parts[2] as (typeof validTabs)[number] | undefined;
      const resolvedTab = requested && validTabs.includes(requested) ? requested : 'submitted';
      return { name: 'admin-book-reviews', tab: resolvedTab };
    }
    return { name: 'admin' };
  }
  if (parts[0] === 'profile' && parts[1]) return { name: 'profile', username: decodeURIComponent(parts.slice(1).join('/')) };
  if (parts[0] === 'profile') return { name: 'profile' };
  if (parts[0] === 'account') return { name: 'account' };
  if (parts[0] === 'notifications') return { name: 'notifications' };
  if (parts[0] === 'reviews') return { name: 'reviews' };
  if (parts[0] === 'analytics') return { name: 'analytics' };
  if (parts[0] === 'taste-match' || parts[0] === 'taste') return { name: 'taste-match' };
  if (parts[0] === 'live-rankings' || parts[0] === 'love-rankings' || parts[0] === 'rankings') return { name: 'live-rankings' };
  if (parts[0] === 'author' && parts[1]) return { name: 'author', author: decodeURIComponent(parts.slice(1).join('/')) };
  if (parts[0] === 'authors') return { name: 'authors' };
  if (parts[0] === 'reviewers') return { name: 'reviewers' };
  if (parts[0] === 'reviewer' && parts[1]) return { name: 'reviewer', uid: decodeURIComponent(parts[1]) };
  if (parts[0] === 'saved') return { name: 'saved' };
  if (parts[0] === 'genres') return { name: 'genre', genre: '' };
  if (parts[0] === 'genre' && parts[1]) return { name: 'genre', genre: decodeURIComponent(parts[1]) };
  return { name: 'home' };
}

/* ---------- Scroll memory: Back / Forward return to where you were; a normal link opens at the top ---------- */
const SCROLL_PREFIX = 'nl_scroll:';
let scrollKey = typeof window === 'undefined' ? '' : window.location.hash;
let pushedByNavigate = false;
let manualScroll = false;

const readScroll = (key: string): number | null => {
  try { const v = sessionStorage.getItem(SCROLL_PREFIX + key); return v == null ? null : Number(v); } catch { return null; }
};
const writeScroll = (key: string, y: number) => { try { sessionStorage.setItem(SCROLL_PREFIX + key, String(Math.round(y))); } catch { /* storage blocked */ } };

/** Put the page back at `y`, retrying while its content (reviews, profile data) is still loading in. */
function restoreScrollTo(y: number) {
  manualScroll = false;
  const stop = () => { manualScroll = true; };
  window.addEventListener('wheel', stop, { once: true, passive: true });
  window.addEventListener('touchstart', stop, { once: true, passive: true });
  const delays = [0, 60, 160, 320, 600, 1000, 1600];
  delays.forEach((delay) => window.setTimeout(() => {
    if (manualScroll) return;
    if (Math.abs(window.scrollY - y) > 2 && document.documentElement.scrollHeight >= y + window.innerHeight * 0.5) window.scrollTo(0, y);
  }, delay));
}

export function useRouter() {
  const [route, setRoute] = useState<Route>(parseHash());

  useEffect(() => {
    try { if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'; } catch { /* ignore */ }
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => { ticking = false; writeScroll(scrollKey, window.scrollY); });
    };
    const onChange = () => {
      writeScroll(scrollKey, window.scrollY);
      scrollKey = window.location.hash;
      setRoute(parseHash());
      const wasPush = pushedByNavigate;
      pushedByNavigate = false;
      const saved = wasPush ? null : readScroll(scrollKey);
      if (saved != null && saved > 0) restoreScrollTo(saved); else window.scrollTo(0, 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('hashchange', onChange);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('hashchange', onChange); };
  }, []);

  const navigate = useCallback((path: string) => {
    const go = () => {
      const target = path.startsWith('#') ? path : `#${path}`;
      if (target === window.location.hash || (path === '/' && !window.location.hash)) return; // same page: no hashchange will follow
      pushedByNavigate = true;
      window.location.hash = path;
    };
    // A popup that is still open owns a history entry: settle it first so the new page is a clean step forward.
    if (overlayDepth() > 0) void closeAllOverlays().then(go); else go();
  }, []);

  return { route, navigate };
}
