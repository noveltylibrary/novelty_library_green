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
  | { name: 'saved' }
  | { name: 'not-found' };

const BASE = ((import.meta.env.BASE_URL as string) || '/').replace(/\/+$/, ''); // '' on a root deploy

/** The app path of a location: pathname without the deploy base, e.g. "/genre/Thriller". */
function currentPath(): string {
  let path = window.location.pathname;
  if (BASE && path.startsWith(BASE)) path = path.slice(BASE.length) || '/';
  return path || '/';
}

/**
 * Old shared links used hash routes (`/#/reviews`, `/#/review/123`, `/#/submit#reserve`). Convert them once, before the
 * first render, to the clean path (`/reviews`, `/review/123`, `/submit#reserve`) with replaceState: the old link keeps
 * working, the address bar shows the clean URL, and no extra history entry is added. Auth callbacks such as
 * `#access_token=…` or `#error=…` do not start with `#/`, so they are left alone for Supabase to read.
 */
function upgradeLegacyHashUrl() {
  if (typeof window === 'undefined') return;
  try {
    const hash = window.location.hash;
    if (!hash.startsWith('#/')) return;
    const rest = hash.slice(1); // "/review/123#reserve"
    const cut = rest.indexOf('#');
    const pathPart = cut === -1 ? rest : rest.slice(0, cut);
    const fragment = cut === -1 ? '' : rest.slice(cut);
    window.history.replaceState(window.history.state, '', `${BASE}${pathPart}${window.location.search}${fragment}`);
  } catch { /* ignore */ }
}
upgradeLegacyHashUrl();

function parsePath(): Route {
  try { return parsePathUnsafe(); } catch { return { name: 'not-found' }; }
}

function parsePathUnsafe(): Route {
  const hash = currentPath().replace(/^\/+|\/+$/g, '');
  if (!hash || hash === 'index.html') return { name: 'home' };
  const parts = hash.split('/');
  // Backwards compatibility for the former embedded Taste Match anchor (/live-rankings#taste).
  if (parts[0] === 'live-rankings' && window.location.hash === '#taste') return { name: 'taste-match' };
  if (parts[0] === 'review' && parts[1]) return { name: 'review', slug: decodeURIComponent(parts[1]) };
  if (parts[0] === 'blog-review' && parts[1]) return { name: 'blog-review', id: decodeURIComponent(parts.slice(1).join('/')) };
  if (parts[0] === 'submit') return { name: 'submit' };
  if (parts[0] === 'review-guidelines') return { name: 'review-guidelines' };
  if (parts[0] === 'about' || parts[0] === 'explore') return { name: 'about' };
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
  return { name: 'not-found' };
}

/* ---------- Scroll memory: Back / Forward return to where you were; a normal link opens at the top ---------- */
const SCROLL_PREFIX = 'nl_scroll:';
const locationKey = () => `${window.location.pathname}${window.location.search}`;
let scrollKey = typeof window === 'undefined' ? '' : locationKey();
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

const ROUTE_EVENT = 'nl:route';
const STATIC_EXT = /\.(?:txt|xml|pdf|png|jpe?g|gif|webp|svg|ico|json|js|css|zip|webmanifest|mp4|mp3)$/i;

/**
 * Go to an app path ("/reviews", "/genre/Thriller", "/submit#reserve") with the History API. Usable anywhere (not only
 * inside components). `replace` swaps the current history entry instead of adding one.
 */
export function go(path: string, replace = false) {
  const clean = path.startsWith('#') ? path.slice(1) : path;
  const target = `${BASE}${clean.startsWith('/') ? clean : `/${clean}`}`;
  const now = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (target === now || (clean === '/' && now === `${BASE}/`)) return; // same page: nothing to do
  const run = () => {
    const samePage = target.split('#')[0] === `${window.location.pathname}${window.location.search}`;
    if (!replace && !samePage) pushedByNavigate = true;
    if (replace) window.history.replaceState(null, '', target); else window.history.pushState(null, '', target);
    window.dispatchEvent(new Event(ROUTE_EVENT));
    if (samePage) window.dispatchEvent(new HashChangeEvent('hashchange')); // e.g. /submit -> /submit#reserve
  };
  // A popup that is still open owns a history entry: settle it first so the new page is a clean step forward.
  if (overlayDepth() > 0) void closeAllOverlays().then(run); else run();
}

export function useRouter() {
  const [route, setRoute] = useState<Route>(parsePath());

  useEffect(() => {
    try { if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'; } catch { /* ignore */ }
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => { ticking = false; writeScroll(scrollKey, window.scrollY); });
    };
    const onChange = () => {
      const key = locationKey();
      if (key === scrollKey) { setRoute(parsePath()); return; } // popup entries / #fragment only: same page, keep scroll
      writeScroll(scrollKey, window.scrollY);
      scrollKey = key;
      setRoute(parsePath());
      const wasPush = pushedByNavigate;
      pushedByNavigate = false;
      const saved = wasPush ? null : readScroll(scrollKey);
      if (saved != null && saved > 0) restoreScrollTo(saved); else window.scrollTo(0, 0);
    };
    // Plain <a href="/path"> links anywhere in the app (announcement posters, guide buttons, …) navigate without a reload.
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target instanceof Element ? e.target.closest('a[href]') : null) as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      let url: URL;
      try { url = new URL(a.href, window.location.href); } catch { return; }
      if (url.origin !== window.location.origin || STATIC_EXT.test(url.pathname)) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return; // in-page #fragment: browser default
      e.preventDefault();
      go(`${url.pathname.slice(BASE.length) || '/'}${url.search}${url.hash}`);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('popstate', onChange);
    window.addEventListener(ROUTE_EVENT, onChange);
    document.addEventListener('click', onClick);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('popstate', onChange); window.removeEventListener(ROUTE_EVENT, onChange); document.removeEventListener('click', onClick); };
  }, []);

  const navigate = useCallback((path: string) => go(path), []);

  return { route, navigate };
}
