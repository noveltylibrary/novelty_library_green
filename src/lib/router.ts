import { useEffect, useState, useCallback } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'reviews' }
  | { name: 'analytics' }
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
  | { name: 'admin-admins' }
  | { name: 'admin-users' }
  | { name: 'admin-finances' }
  | { name: 'admin-pages' }
  | { name: 'profile'; username?: string }
  | { name: 'account' }
  | { name: 'notifications' }
  | { name: 'genre'; genre: string };

function parseHash(): Route {
  const hash = window.location.hash.replace(/^#\/?/, '');
  if (!hash || hash === '') return { name: 'home' };
  // Support nested action fragments such as #/submit#reserve. The first hash
  // selects the app route; the trailing fragment is an action handled by the page.
  const routeHash = hash.split('#')[0];
  const parts = routeHash.split('/');
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
    if (parts[1] === 'admins') return { name: 'admin-admins' };
    if (parts[1] === 'users') return { name: 'admin-users' };
    if (parts[1] === 'finances') return { name: 'admin-finances' };
    if (parts[1] === 'pages') return { name: 'admin-pages' };
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
  if (parts[0] === 'genre' && parts[1]) return { name: 'genre', genre: decodeURIComponent(parts[1]) };
  return { name: 'home' };
}

export function useRouter() {
  const [route, setRoute] = useState<Route>(parseHash());

  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = useCallback((path: string) => {
    window.location.hash = path;
  }, []);

  return { route, navigate };
}
