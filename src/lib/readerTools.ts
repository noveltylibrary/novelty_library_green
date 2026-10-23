import { useCallback, useEffect, useState } from 'react';
import type { Review } from '@/types/review';
import { fetchReviews } from '@/lib/reviews';
import { supabase } from '@/lib/supabase';
import { cleanTraits, type SearchBook } from '@/lib/rankingSearch';

/** Browser-only Open Library lookup for title/author/year/cover metadata. */
export interface OpenLibraryBookMetadata { title: string; author: string; publishYear: number | null; coverUrl: string | null; isbn: string | null; key: string | null; }
const openLibraryCache = new Map<string, OpenLibraryBookMetadata[]>();
export async function lookupOpenLibraryBook(query: string, signal?: AbortSignal): Promise<OpenLibraryBookMetadata[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const key = q.toLocaleLowerCase();
  if (openLibraryCache.has(key)) return openLibraryCache.get(key)!;
  const response = await fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(q)}&limit=5&fields=key,title,author_name,first_publish_year,cover_i,isbn`, { signal });
  if (!response.ok) throw new Error('Open Library lookup failed');
  const data = await response.json() as { docs?: Array<{key?:string;title?:string;author_name?:string[];first_publish_year?:number;cover_i?:number;isbn?:string[]}> };
  const results = (data.docs ?? []).map((book) => ({ title: book.title ?? '', author: book.author_name?.[0] ?? '', publishYear: book.first_publish_year ?? null, coverUrl: book.cover_i ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg` : null, isbn: book.isbn?.[0] ?? null, key: book.key ?? null })).filter((book) => book.title);
  openLibraryCache.set(key, results);
  return results;
}


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

/* ---------- Save for later ----------
 * The list lives in this browser (works for guests, instant, offline-safe). When the reader is signed in it is also
 * mirrored to `user_saved_reviews` (NL_SQL_220) so it follows them to every device. Every cloud call is best-effort:
 * if the table is missing or the network fails, the browser list keeps working exactly as before. */
const SAVED_KEY = 'nl_saved_reviews';
const OWNER_KEY = 'nl_saved_owner';
const listeners = new Set<() => void>();

const reviewNoOfRow = (r: Review): string => String(r.master_review_no ?? r.review_number ?? '').trim();

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
const getOwner = (): string | null => { try { return window.localStorage.getItem(OWNER_KEY); } catch { return null; } };
const setOwner = (uid: string | null) => { try { if (uid) window.localStorage.setItem(OWNER_KEY, uid); else window.localStorage.removeItem(OWNER_KEY); } catch { /* ignore */ } };

async function currentUserId(): Promise<string | null> {
  try { const { data } = await supabase.auth.getSession(); return data.session?.user?.id ?? null; } catch { return null; }
}

/** Mirror one toggle to the account. Never throws. */
async function pushToggle(reviewId: string, nowSaved: boolean) {
  try {
    const uid = await currentUserId();
    if (!uid) return;
    const rev = (await loadPublished()).find((r) => r.id === reviewId);
    const no = rev ? reviewNoOfRow(rev) : '';
    if (!no) return;
    if (nowSaved) await supabase.from('user_saved_reviews').upsert({ user_id: uid, review_no: no }, { onConflict: 'user_id,review_no', ignoreDuplicates: true });
    else await supabase.from('user_saved_reviews').delete().eq('user_id', uid).eq('review_no', no);
  } catch { /* offline / table not created yet: browser list still works */ }
}

let syncing: Promise<void> | null = null;
/**
 * Pull the account's list and merge it with this browser's list.
 * First sign-in on a browser: union of both (nothing a guest saved is lost). After that the account is the source of truth,
 * so removing a review on one device removes it everywhere.
 */
export function syncSavedWithAccount(): Promise<void> {
  if (syncing) return syncing;
  syncing = (async () => {
    try {
      const uid = await currentUserId();
      if (!uid) return;
      const owner = getOwner();
      if (owner && owner !== uid) { writeSaved([]); } // another account used this browser: never mix lists
      const firstSync = owner !== uid;

      const [all, res] = await Promise.all([
        loadPublished(),
        supabase.from('user_saved_reviews').select('review_no,saved_at').eq('user_id', uid).order('saved_at', { ascending: false }).limit(200),
      ]);
      if (res.error) return; // table missing or blocked: keep the browser list untouched
      const byNo = new Map(all.map((r) => [reviewNoOfRow(r), r.id] as const).filter(([no]) => no));
      const remoteNos = new Set((res.data || []).map((x: { review_no: string }) => String(x.review_no)));
      const remoteIds = (res.data || []).map((x: { review_no: string }) => byNo.get(String(x.review_no))).filter((x): x is string => !!x);

      const local = readSaved();
      const localOnly = firstSync ? local.filter((id) => !remoteIds.includes(id)) : [];
      const merged = [...localOnly, ...remoteIds].slice(0, 200);
      writeSaved(merged);
      setOwner(uid);

      // Upload anything saved as a guest that the account doesn't have yet.
      const idToNo = new Map(all.map((r) => [r.id, reviewNoOfRow(r)] as const));
      const rows = localOnly.map((id) => idToNo.get(id)).filter((no): no is string => !!no && !remoteNos.has(no)).map((no) => ({ user_id: uid, review_no: no }));
      if (rows.length) await supabase.from('user_saved_reviews').upsert(rows, { onConflict: 'user_id,review_no', ignoreDuplicates: true });
    } catch { /* best effort */ }
  })().finally(() => { syncing = null; });
  return syncing;
}

let authWired = false;
function wireAuthSync() {
  if (authWired || typeof window === 'undefined') return;
  authWired = true;
  try {
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') window.setTimeout(() => void syncSavedWithAccount(), 0);
      if (event === 'SIGNED_OUT' && getOwner()) { setOwner(null); writeSaved([]); } // don't leave one reader's list on a shared device
    });
  } catch { /* ignore */ }
}

export function useSavedReviews() {
  const [ids, setIds] = useState<string[]>(() => readSaved());
  useEffect(() => {
    const sync = () => setIds(readSaved());
    listeners.add(sync);
    window.addEventListener('storage', sync);
    wireAuthSync();
    void syncSavedWithAccount();
    return () => { listeners.delete(sync); window.removeEventListener('storage', sync); };
  }, []);
  const toggle = useCallback((id: string) => {
    const cur = readSaved();
    const nowSaved = !cur.includes(id);
    writeSaved(nowSaved ? [id, ...cur] : cur.filter((x) => x !== id));
    void pushToggle(id, nowSaved);
  }, []);
  return { ids, isSaved: (id: string) => ids.includes(id), toggle };
}

/** A published review as the matching engine sees it. */
export const reviewToSearchBook = (r: Review): SearchBook => ({
  id: r.id, title: r.title || '', author: r.author || '', genre: r.genre || '', language: r.language || '', traits: cleanTraits(r.traits),
  verdict: r.verdict || '', text: (r.review_text || '').slice(0, 4000), nl: null, rw: Number.isFinite(r.rw_rating) ? r.rw_rating : 0,
});
