import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useFollowedAuthors } from '@/lib/followAuthors';
import { authorKey } from '@/lib/readerTools';
import type { Review } from '@/types/review';

/* ---------- Stats shared by author and reviewer profiles ---------- */
export interface PeopleStats {
  count: number;
  avgRw: number | null;
  genres: string[];
  languages: string[];
  verdicts: { perfection: number; go_for_it: number; timepass: number };
  top: Review[];
}

const topKeys = (values: string[], max: number): string[] => {
  const tally = new Map<string, number>();
  for (const v of values) { const t = v.trim(); if (t) tally.set(t, (tally.get(t) ?? 0) + 1); }
  return [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, max).map(([k]) => k);
};

export function summarizeReviews(books: Review[]): PeopleStats {
  const rated = books.filter((b) => Number.isFinite(b.rw_rating) && b.rw_rating > 0);
  const verdicts = { perfection: 0, go_for_it: 0, timepass: 0 };
  for (const b of books) if (b.verdict && b.verdict in verdicts) verdicts[b.verdict] += 1;
  return {
    count: books.length,
    avgRw: rated.length ? rated.reduce((n, b) => n + b.rw_rating, 0) / rated.length : null,
    genres: topKeys(books.flatMap((b) => (b.genre || '').split(/[/,]/)), 6),
    languages: topKeys(books.map((b) => b.language || ''), 4),
    verdicts,
    top: [...books].sort((a, b) => (b.rw_rating || 0) - (a.rw_rating || 0)).slice(0, 3),
  };
}

/* ---------- Authors built from the published reviews ---------- */
export interface AuthorProfile extends PeopleStats {
  key: string;
  name: string;
  books: Review[];
}

export function buildAuthorProfiles(all: Review[]): AuthorProfile[] {
  const groups = new Map<string, Review[]>();
  for (const r of all) {
    const key = authorKey(r.author || '');
    if (!key) continue;
    const list = groups.get(key);
    if (list) list.push(r); else groups.set(key, [r]);
  }
  return [...groups.entries()].map(([key, books]) => {
    const sorted = [...books].sort((a, b) => (b.rw_rating || 0) - (a.rw_rating || 0));
    return { key, name: sorted[0].author.trim(), books: sorted, ...summarizeReviews(sorted) };
  });
}

/* ---------- Follower counts (Supabase, additive NL_SQL_200) with a this-browser fallback ---------- */
export interface AuthorFollowStats { followers: number; is_following: boolean; }

export async function fetchAuthorFollowStats(key: string): Promise<AuthorFollowStats> {
  const { data, error } = await supabase.rpc('get_author_follow_stats', { p_author_key: key });
  if (error) throw error;
  const d = (data ?? {}) as Partial<AuthorFollowStats>;
  return { followers: Number(d.followers) || 0, is_following: Boolean(d.is_following) };
}
export async function fetchAuthorFollowerCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc('author_follower_counts');
  if (error) throw error;
  const out: Record<string, number> = {};
  for (const row of (data ?? []) as { author_key: string; followers: number | string }[]) out[row.author_key] = Number(row.followers) || 0;
  return out;
}
async function setAuthorFollow(key: string, follow: boolean): Promise<void> {
  const { error } = await supabase.rpc(follow ? 'follow_author' : 'unfollow_author', { p_author_key: key });
  if (error) throw error;
}

/**
 * Follow state for one author. Signed-in readers follow through Supabase so the follower count is real.
 * If NL_SQL_200 has not been run yet the count is unavailable (null) and Follow keeps working in this browser only.
 */
export function useAuthorFollow(key: string, navigate: (path: string) => void) {
  const { user } = useAuth();
  const local = useFollowedAuthors();
  const [stats, setStats] = useState<AuthorFollowStats | null>(null);
  const [serverOk, setServerOk] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try { setStats(await fetchAuthorFollowStats(key)); setServerOk(true); }
    catch { setStats(null); setServerOk(false); }
  }, [key]);
  useEffect(() => { setStats(null); setServerOk(null); void refresh(); }, [refresh, user?.id]);

  const following = serverOk ? Boolean(stats?.is_following) : local.isFollowing(key);
  const toggle = useCallback(async () => {
    if (busy) return;
    if (serverOk === false) { local.toggle(key); return; }
    if (!user) { navigate('/auth'); return; }
    setBusy(true);
    try { await setAuthorFollow(key, !following); await refresh(); }
    finally { setBusy(false); }
  }, [busy, serverOk, user, key, following, local, navigate, refresh]);

  return useMemo(() => ({ followers: serverOk ? stats?.followers ?? 0 : null, following, toggle, busy }), [serverOk, stats?.followers, following, toggle, busy]);
}
