import { useCallback, useEffect, useState } from 'react';
import type { Review } from '@/types/review';
import { fetchReviews } from '@/lib/reviews';
import { cleanTraits, type SearchBook } from '@/lib/rankingSearch';

let listPromise: Promise<Review[]> | null = null;
let listAt = 0;
/** One shared fetch of the published reviews, re-used across pages for a few minutes. */
export function loadPublished(): Promise<Review[]> {
  if (!listPromise || Date.now() - listAt > 5 * 60_000) {
    listAt = Date.now();
    listPromise = fetchReviews().catch((e) => { listPromise = null; throw e; });
  }
  return listPromise;
}

export function usePublished(): Review[] {
  const [all, setAll] = useState<Review[]>([]);
  useEffect(() => {
    let alive = true;
    loadPublished().then((r) => { if (alive) setAll(r); }).catch(() => undefined);
    return () => { alive = false; };
  }, []);
  return all;
}

export const reviewSlug = (r: Review): string => r.slug || `${r.title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')}-${r.master_review_no ?? r.review_number ?? ''}`;
export const reviewPath = (r: Review): string => `/review/${encodeURIComponent(reviewSlug(r))}`;

export const authorKey = (name: string): string => name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export const authorPath = (name: string): string => `/author/${encodeURIComponent(name.trim())}`;

/** About 200 words a minute, never less than one minute. */
export function readingMinutes(text: string): number {
  const words = (text || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/* ---------- Save for later (this browser only) ---------- */
const SAVED_KEY = 'nl_saved_reviews';
const listeners = new Set<() => void>();

function readSaved(): string[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(SAVED_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string').slice(0, 200) : [];
  } catch { return []; }
}
function writeSaved(ids: string[]) {
  try { window.localStorage.setItem(SAVED_KEY, JSON.stringify(ids.slice(0, 200))); } catch { /* private mode: the list simply won't persist */ }
  listeners.forEach((fn) => fn());
}

export function useSavedReviews() {
  const [ids, setIds] = useState<string[]>(() => readSaved());
  useEffect(() => {
    const sync = () => setIds(readSaved());
    listeners.add(sync);
    window.addEventListener('storage', sync);
    return () => { listeners.delete(sync); window.removeEventListener('storage', sync); };
  }, []);
  const toggle = useCallback((id: string) => {
    const cur = readSaved();
    writeSaved(cur.includes(id) ? cur.filter((x) => x !== id) : [id, ...cur]);
  }, []);
  return { ids, isSaved: (id: string) => ids.includes(id), toggle };
}

/** A published review as the matching engine sees it. */
export const reviewToSearchBook = (r: Review): SearchBook => ({
  id: r.id, title: r.title || '', author: r.author || '', genre: r.genre || '', language: r.language || '', traits: cleanTraits(r.traits),
  verdict: r.verdict || '', text: (r.review_text || '').slice(0, 4000), nl: null, rw: Number.isFinite(r.rw_rating) ? r.rw_rating : 0,
});
