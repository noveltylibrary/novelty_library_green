import { useEffect } from 'react';
import type { Route } from '@/lib/router';

const SITE = 'Novelty Library';
const DEFAULT_DESC = 'What book broke your brain this month? Novelty Library is a community of readers reviewing the books that left a mark.';

/** Public origin used for canonical / Open Graph URLs. Set VITE_SITE_URL on the production build; falls back to the current origin. */
function siteOrigin(): string {
  const configured = (import.meta.env.VITE_SITE_URL as string | undefined)?.trim().replace(/\/+$/, '');
  return configured || window.location.origin;
}

const humanize = (v: string) => { try { return decodeURIComponent(v); } catch { return v; } };
const prettySlug = (slug: string) => humanize(slug).replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, (c) => c.toUpperCase());

/** Pages that should not appear in search: private, account-only or admin screens. */
const PRIVATE = new Set(['submit', 'auth', 'account', 'profile', 'notifications', 'saved', 'not-found']);

function describe(route: Route): { title: string; description?: string; noindex: boolean } {
  const noindex = PRIVATE.has(route.name) || route.name.startsWith('admin') || (route.name === 'profile' && !route.username);
  switch (route.name) {
    case 'home': return { title: `${SITE} — Book Reviews`, noindex };
    case 'reviews': return { title: `All Book Reviews | ${SITE}`, description: 'Browse every book review published on Novelty Library.', noindex };
    case 'review': return { title: `${prettySlug(route.slug)} — Book Review | ${SITE}`, noindex };
    case 'blog-review': return { title: `Book Review | ${SITE}`, noindex };
    case 'genre': return { title: route.genre ? `${humanize(route.genre)} Book Reviews | ${SITE}` : `Genres | ${SITE}`, noindex };
    case 'author': return { title: `${humanize(route.author)} — Author & Reviews | ${SITE}`, noindex };
    case 'authors': return { title: `Authors | ${SITE}`, noindex };
    case 'reviewers': return { title: `Reviewers | ${SITE}`, noindex };
    case 'reviewer': return { title: `Reviewer | ${SITE}`, noindex };
    case 'profile': return { title: route.username ? `${humanize(route.username)} — Reader Profile | ${SITE}` : `Your Profile | ${SITE}`, noindex };
    case 'analytics': return { title: `Reading Analytics | ${SITE}`, noindex };
    case 'live-rankings': return { title: `Live Book Rankings | ${SITE}`, noindex };
    case 'taste-match': return { title: `Taste Match | ${SITE}`, noindex };
    case 'review-guidelines': return { title: `Review Guidelines | ${SITE}`, noindex };
    case 'about': return { title: `Explore | ${SITE}`, noindex };
    case 'privacy': return { title: `Privacy Policy | ${SITE}`, noindex };
    case 'terms': return { title: `Terms of Use | ${SITE}`, noindex };
    case 'cookies': return { title: `Cookie Policy | ${SITE}`, noindex };
    case 'not-found': return { title: `Page not found | ${SITE}`, noindex };
    default: return { title: SITE, noindex };
  }
}

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.setAttribute('content', content);
}

function setCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) { el = document.createElement('link'); el.rel = 'canonical'; document.head.appendChild(el); }
  el.href = href;
}

/** Let a page refine the generic title/description once its real data (book title, author…) has loaded. */
export function setPageMeta(meta: { title?: string; description?: string; image?: string }) {
  if (typeof document === 'undefined') return;
  if (meta.title) { document.title = meta.title; setMeta('property', 'og:title', meta.title); setMeta('name', 'twitter:title', meta.title); }
  if (meta.description) { const d = meta.description.replace(/\s+/g, ' ').trim().slice(0, 300); setMeta('name', 'description', d); setMeta('property', 'og:description', d); }
  if (meta.image) { setMeta('property', 'og:image', meta.image); setMeta('name', 'twitter:image', meta.image); }
}

/** Keeps <title>, description, canonical, Open Graph URL and robots in step with the current clean path. */
export function useSeo(route: Route) {
  const key = JSON.stringify(route);
  useEffect(() => {
    const { title, description, noindex } = describe(route);
    const url = `${siteOrigin()}${window.location.pathname}`.replace(/(.)\/+$/, '$1'); // no query / #fragment
    setPageMeta({ title, description: description ?? DEFAULT_DESC });
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:type', route.name === 'review' ? 'article' : 'website');
    setMeta('property', 'og:site_name', SITE);
    setMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');
    setCanonical(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
