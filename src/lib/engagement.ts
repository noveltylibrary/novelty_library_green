import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Profile } from '@/types/review';
import { sanitizeUserText } from '@/lib/sanitize';

export interface EngagementStats {
  likeCount: number;
  ratingCount: number;
  ratingSum: number;
  reviewCount: number;
}

export interface FeedbackEntry {
  id: string;
  review_id: string;
  user_id: string;
  user_name: string;
  rating: number | null;
  review_text: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface FeedbackInput {
  rating: number | null;
  reviewText: string;
  tags: string[];
}

export const EMPTY_STATS: EngagementStats = { likeCount: 0, ratingCount: 0, ratingSum: 0, reviewCount: 0 };

/**
 * NL Rating is the cumulative community average for this book/review post.
 * It averages the reviewer's own R/W score (counted as one rating) together with
 * every rating submitted by readers on the community review post, so every post
 * with an R/W score has an NL rating, even before any reader has rated it.
 * Returns null only when there is neither an R/W score nor a reader rating.
 */
export function computeNlRating(rwRating: number | null | undefined, stats?: EngagementStats): number | null {
  const rw = Number(rwRating);
  const hasRw = Number.isFinite(rw) && rw > 0;
  const count = (stats?.ratingCount ?? 0) + (hasRw ? 1 : 0);
  if (count <= 0) return null;
  return ((stats?.ratingSum ?? 0) + (hasRw ? rw : 0)) / count;
}

export function displayNameFor(user: User, profile: Profile | null): string {
  const name = profile?.name?.trim() || profile?.instagram_id?.trim() || user.email?.split('@')[0] || 'Reader';
  return sanitizeUserText(name, 60).slice(0, 60);
}

/** Mirrors the review's engagement to the Google Sheet. Fire-and-forget: never blocks or breaks the UI. */
function syncToSheet(reviewId: string) {
  void (async () => {
    try { await supabase.functions.invoke('engagement-sheet', { body: { review_id: reviewId } }); } catch { /* sheet mirror is best-effort */ }
  })();
}

export async function fetchFeedback(reviewId: string): Promise<FeedbackEntry[]> {
  const { data, error } = await supabase
    .from('community_review_feedback')
    .select('*')
    .eq('review_id', reviewId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as FeedbackEntry[];
}

export async function saveFeedback(user: User, profile: Profile | null, reviewId: string, input: FeedbackInput): Promise<void> {
  const row = {
    review_id: reviewId,
    user_id: user.id,
    user_name: displayNameFor(user, profile),
    rating: input.rating,
    review_text: sanitizeUserText(input.reviewText, 4000).trim(),
    tags: input.tags.map((tag) => sanitizeUserText(tag, 60)).filter(Boolean).slice(0, 10),
  };
  const { error } = await supabase.from('community_review_feedback').upsert(row, { onConflict: 'review_id,user_id' });
  if (error) throw error;
  syncToSheet(reviewId);
}

export async function deleteFeedback(user: User, reviewId: string): Promise<void> {
  const { error } = await supabase.from('community_review_feedback').delete().eq('review_id', reviewId).eq('user_id', user.id);
  if (error) throw error;
  syncToSheet(reviewId);
}

/** Loads engagement counts for every published review plus the signed-in user's likes. */
export function useEngagement() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Record<string, EngagementStats>>({});
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const likedRef = useRef(liked);
  likedRef.current = liked;
  const userId = user?.id;
  /** Taps that have not reached the server yet: what the user wants, what the server had, and the count at the time. */
  const pendingLikes = useRef<Record<string, { want: boolean; base: boolean; baseCount: number; timer: number | null; busy: boolean }>>({});

  const refresh = useCallback(async () => {
    const map: Record<string, EngagementStats> = {};
    // Load the aggregate view first for likes/reviews and the normal counters.
    try {
      const { data } = await supabase.from('community_review_stats').select('*');
      for (const row of (data ?? []) as Array<{ review_id: string; like_count: number; rating_count: number; rating_sum: number; review_count: number }>) {
        map[row.review_id] = { likeCount: Number(row.like_count ?? 0), ratingCount: Number(row.rating_count ?? 0), ratingSum: Number(row.rating_sum ?? 0), reviewCount: Number(row.review_count ?? 0) };
      }
    } catch { /* fall through to the source feedback table */ }

    // NL Rating is authoritative from the source reader-rating rows. Do not add
    // these to community_review_stats: that aggregate already contains the same
    // ratings and doing so doubles the count/sum. Rebuild only the rating fields
    // from community_review_feedback while preserving likes/review counts.
    try {
      const { data: feedbackRows } = await supabase
        .from('community_review_feedback')
        .select('review_id,rating');
      const ratingTotals: Record<string, { count: number; sum: number }> = {};
      for (const row of (feedbackRows ?? []) as Array<{ review_id: string; rating: number | null }>) {
        const rating = row.rating == null ? null : Number(row.rating);
        if (rating == null || !Number.isFinite(rating)) continue;
        const cur = ratingTotals[row.review_id] ?? { count: 0, sum: 0 };
        cur.count += 1;
        cur.sum += rating;
        ratingTotals[row.review_id] = cur;
      }
      for (const [reviewId, totals] of Object.entries(ratingTotals)) {
        const cur = map[reviewId] ?? EMPTY_STATS;
        map[reviewId] = { ...cur, ratingCount: totals.count, ratingSum: totals.sum };
      }
    } catch { /* feedback table unavailable: keep the rest of engagement working */ }

    // Like counts: the stats view only counts rows of a different table than the one likes are saved against,
    // so it reports 0. Count straight from the likes table (public SELECT) so every viewer sees the real total.
    try {
      const likeTotals: Record<string, number> = {};
      const PAGE = 1000;
      for (let from = 0; from < 50000; from += PAGE) {
        const { data: likeRows, error: likeErr } = await supabase.from('community_review_likes').select('review_id').range(from, from + PAGE - 1);
        if (likeErr) throw likeErr;
        for (const row of (likeRows ?? []) as Array<{ review_id: string }>) likeTotals[row.review_id] = (likeTotals[row.review_id] ?? 0) + 1;
        if ((likeRows?.length ?? 0) < PAGE) break;
      }
      for (const id of Object.keys(map)) map[id] = { ...map[id], likeCount: likeTotals[id] ?? 0 };
      for (const [id, n] of Object.entries(likeTotals)) map[id] = { ...(map[id] ?? EMPTY_STATS), likeCount: n };
    } catch { /* keep whatever the view returned */ }

    // Keep a tap that is still settling: its optimistic number wins over the fetched one until the server confirms.
    for (const [id, pend] of Object.entries(pendingLikes.current)) {
      const cur = map[id] ?? EMPTY_STATS;
      map[id] = { ...cur, likeCount: Math.max(0, pend.baseCount + (pend.want ? 1 : 0) - (pend.base ? 1 : 0)) };
    }
    setStats(map);
    if (!userId) { setLiked(new Set()); return; }
    try {
      const { data } = await supabase.from('community_review_likes').select('review_id').eq('user_id', userId);
      const mine = new Set((data ?? []).map((r: { review_id: string }) => r.review_id));
      for (const [id, pend] of Object.entries(pendingLikes.current)) { if (pend.want) mine.add(id); else mine.delete(id); }
      setLiked(mine);
    } catch { /* ignore */ }
  }, [userId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const setLikedLocal = (id: string, on: boolean) =>
    setLiked((prev) => { const next = new Set(prev); if (on) next.add(id); else next.delete(id); return next; });
  const setCountLocal = (id: string, n: number) =>
    setStats((prev) => ({ ...prev, [id]: { ...(prev[id] ?? EMPTY_STATS), likeCount: Math.max(0, n) } }));

  /** Sends only the FINAL wanted state once taps stop, so like → unlike → like never leaves a stray row or a wrong count. */
  const settle = useCallback(async (reviewId: string) => {
    const pend = pendingLikes.current[reviewId];
    if (!pend || !userId || pend.busy) return;
    pend.busy = true;
    const target = pend.want;
    let ok = true;
    try {
      const { error } = target
        ? await supabase.from('community_review_likes').upsert({ review_id: reviewId, user_id: userId }, { onConflict: 'review_id,user_id', ignoreDuplicates: true })
        : await supabase.from('community_review_likes').delete().eq('review_id', reviewId).eq('user_id', userId);
      if (error) ok = false;
    } catch { ok = false; }
    pend.busy = false;
    if (!ok) {
      // Roll back to what the server really has.
      delete pendingLikes.current[reviewId];
      setLikedLocal(reviewId, pend.base);
      setCountLocal(reviewId, pend.baseCount);
      return;
    }
    if (pend.want !== target) { void settle(reviewId); return; } // tapped again while saving: send the newer state
    delete pendingLikes.current[reviewId];
    syncToSheet(reviewId);
    void refresh(); // pull the true total (other readers' likes included)
  }, [userId, refresh]);

  const toggleLike = useCallback((reviewId: string) => {
    if (!userId) return;
    const existing = pendingLikes.current[reviewId];
    const wasLiked = likedRef.current.has(reviewId);
    const pend = existing ?? { want: wasLiked, base: wasLiked, baseCount: stats[reviewId]?.likeCount ?? 0, timer: null, busy: false };
    pend.want = !wasLiked;
    pendingLikes.current[reviewId] = pend;
    // instant feedback, exactly like Instagram: the heart and number flip on every tap
    setLikedLocal(reviewId, pend.want);
    setCountLocal(reviewId, pend.baseCount + (pend.want ? 1 : 0) - (pend.base ? 1 : 0));
    if (pend.timer) window.clearTimeout(pend.timer);
    pend.timer = window.setTimeout(() => { pend.timer = null; void settle(reviewId); }, 450);
  }, [userId, stats, settle]);

  return useMemo(() => ({
    stats,
    liked,
    toggleLike,
    refresh,
    statsFor: (id: string) => stats[id] ?? EMPTY_STATS,
  }), [stats, liked, toggleLike, refresh]);
}
