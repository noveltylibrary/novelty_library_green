import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types/review';
import { supabase } from '@/lib/supabase';

export interface FeedbackReply {
  id: string;
  feedback_id: string;
  user_id: string;
  user_name: string;
  reply_text: string;
  parent_id: string | null;
  created_at: string;
}

/** One query for every reader review on a post. */
export async function fetchFeedbackReplies(feedbackIds: string[]): Promise<FeedbackReply[]> {
  if (!feedbackIds.length) return [];
  const { data, error } = await supabase
    .from('community_review_feedback_replies')
    .select('id,feedback_id,user_id,user_name,reply_text,parent_id,created_at')
    .in('feedback_id', feedbackIds)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as FeedbackReply[];
}

function displayName(user: User, profile: Profile | null) {
  return (profile?.name?.trim() || profile?.novelty_username?.trim() || user.email?.split('@')[0] || 'Reader').slice(0, 60);
}

export async function addFeedbackReply(user: User, profile: Profile | null, feedbackId: string, text: string, parentId: string | null = null): Promise<void> {
  const reply = text.trim();
  if (!reply) throw new Error('Write a reply first.');
  if (reply.length > 600) throw new Error('Replies are limited to 600 characters.');
  const { error } = await supabase.from('community_review_feedback_replies').insert({
    feedback_id: feedbackId,
    user_id: user.id,
    user_name: displayName(user, profile),
    reply_text: reply,
    parent_id: parentId,
  });
  if (error) throw error;
}

export async function deleteFeedbackReply(user: User, replyId: string): Promise<void> {
  const { error } = await supabase.from('community_review_feedback_replies').delete().eq('id', replyId).eq('user_id', user.id);
  if (error) throw error;
}
