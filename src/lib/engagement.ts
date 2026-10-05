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
 * It uses only ratings submitted by readers in the community review post;
 * the reviewer's R/W score is intentionally not included in this average.
 * Returns null until at least one community rating exists.
 */
export function computeNlRating(_rwRating: number | null | undefined, stats?: EngagementStats): number | null {
  const count = stats?.ratingCount ?? 0;
  if (count <= 0) return null;
  return (stats?.ratingSum ?? 0) / count;
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

  const refresh = useCallback(async () => {
    try {
      const { data } = await supabase.from('community_review_stats').select('*');
      const map: Record<string, EngagementStats> = {};
      for (const row of (data ?? []) as Array<{ review_id: string; like_count: number; rating_count: number; rating_sum: number; review_count: number }>) {
        map[row.review_id] = { likeCount: row.like_count, ratingCount: row.rating_count, ratingSum: row.rating_sum, reviewCount: row.review_count };
      }
      setStats(map);
    } catch { /* engagement tables not migrated yet: app keeps working without them */ }
    if (!userId) { setLiked(new Set()); return; }
    try {
      const { data } = await supabase.from('community_review_likes').select('review_id').eq('user_id', userId);
      setLiked(new Set((data ?? []).map((r: { review_id: string }) => r.review_id)));
    } catch { /* ignore */ }
  }, [userId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const bump = (id: string, delta: number) =>
    setStats((prev) => {
      const cur = prev[id] ?? EMPTY_STATS;
      return { ...prev, [id]: { ...cur, likeCount: Math.max(0, cur.likeCount + delta) } };
    });

  const toggleLike = useCallback(async (reviewId: string) => {
    if (!userId) return;
    const wasLiked = likedRef.current.has(reviewId);
    // optimistic update
    setLiked((prev) => { const next = new Set(prev); if (wasLiked) next.delete(reviewId); else next.add(reviewId); return next; });
    bump(reviewId, wasLiked ? -1 : 1);
    const { error } = wasLiked
      ? await supabase.from('community_review_likes').delete().eq('review_id', reviewId).eq('user_id', userId)
      : await supabase.from('community_review_likes').insert({ review_id: reviewId, user_id: userId });
    if (error) {
      setLiked((prev) => { const next = new Set(prev); if (wasLiked) next.add(reviewId); else next.delete(reviewId); return next; });
      bump(reviewId, wasLiked ? 1 : -1);
      return;
    }
    syncToSheet(reviewId);
  }, [userId]);

  return useMemo(() => ({
    stats,
    liked,
    toggleLike,
    refresh,
    statsFor: (id: string) => stats[id] ?? EMPTY_STATS,
  }), [stats, liked, toggleLike, refresh]);
}
