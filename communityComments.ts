import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types/review';
import { supabase } from '@/lib/supabase';

export interface ReviewComment {
  id: string;
  review_id: string;
  user_id: string;
  user_name: string;
  comment_text: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  like_count: number;
  liked_by_me: boolean;
}

export async function fetchReviewComments(reviewId: string, userId?: string): Promise<ReviewComment[]> {
  const { data, error } = await supabase
    .from('community_review_comments')
    .select('id,review_id,user_id,user_name,comment_text,parent_id,created_at,updated_at')
    .eq('review_id', reviewId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as Omit<ReviewComment, 'like_count' | 'liked_by_me'>[];
  if (!rows.length) return [];

  const ids = rows.map((r) => r.id);
  const { data: likes, error: likesError } = await supabase
    .from('community_review_comment_likes')
    .select('comment_id,user_id')
    .in('comment_id', ids);
  if (likesError) throw likesError;
  const counts = new Map<string, number>();
  const mine = new Set<string>();
  for (const like of likes ?? []) {
    counts.set(like.comment_id, (counts.get(like.comment_id) ?? 0) + 1);
    if (userId && like.user_id === userId) mine.add(like.comment_id);
  }
  return rows.map((r) => ({ ...r, like_count: counts.get(r.id) ?? 0, liked_by_me: mine.has(r.id) }));
}

function displayName(user: User, profile: Profile | null) {
  return (profile?.name?.trim() || profile?.novelty_username?.trim() || user.email?.split('@')[0] || 'Reader').slice(0, 60);
}

export async function addReviewComment(user: User, profile: Profile | null, reviewId: string, text: string, parentId: string | null = null) {
  const comment = text.trim();
  if (!comment) throw new Error('Write a comment first.');
  if (comment.length > 800) throw new Error('Comments are limited to 800 characters.');
  const { error } = await supabase.from('community_review_comments').insert({
    review_id: reviewId,
    user_id: user.id,
    user_name: displayName(user, profile),
    comment_text: comment,
    parent_id: parentId,
  });
  if (error) throw error;
}

export async function toggleCommentLike(user: User, commentId: string, liked: boolean) {
  if (liked) {
    const { error } = await supabase.from('community_review_comment_likes').delete().eq('comment_id', commentId).eq('user_id', user.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('community_review_comment_likes').insert({ comment_id: commentId, user_id: user.id });
    if (error) throw error;
  }
}

export async function deleteReviewComment(user: User, commentId: string) {
  const { error } = await supabase.from('community_review_comments').delete().eq('id', commentId).eq('user_id', user.id);
  if (error) throw error;
}
