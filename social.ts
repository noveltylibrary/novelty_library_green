import { supabase } from '@/lib/supabase';
import { prepareImageForUpload, extForImageType } from '@/lib/imageUpload';

export interface FollowStats { followers: number; following: number; is_following: boolean; }
export interface ConnectionProfile { id: string; novelty_username: string | null; name: string | null; avatar_url: string | null; }
export interface FollowPrivacy { hide_followers: boolean; hide_following: boolean; }
export interface Story {
  id: string; user_id: string; novelty_username: string | null; name: string | null; avatar_url: string | null;
  image_url: string; caption: string | null; created_at: string; expires_at: string;
  source_story_id?: string | null; like_count: number; liked_by_me: boolean; reposted_by_me: boolean;
}

export async function fetchFollowStats(username: string): Promise<FollowStats> {
  const { data, error } = await supabase.rpc('get_follow_stats', { p_username: username.replace(/^@/, '') });
  if (error) throw error;
  return (data ?? { followers: 0, following: 0, is_following: false }) as FollowStats;
}
export async function followUsername(username: string): Promise<void> { const { error } = await supabase.rpc('follow_username', { p_username: username.replace(/^@/, '') }); if (error) throw error; }
export async function unfollowUsername(username: string): Promise<void> { const { error } = await supabase.rpc('unfollow_username', { p_username: username.replace(/^@/, '') }); if (error) throw error; }
export async function fetchFollowPrivacy(username: string): Promise<FollowPrivacy> {
  const { data, error } = await supabase.rpc('get_profile_privacy', { p_username: username.replace(/^@/, '') });
  if (error) throw error;
  return (data ?? { hide_followers: false, hide_following: false }) as FollowPrivacy;
}
export async function fetchConnections(username: string, kind: 'followers' | 'following'): Promise<ConnectionProfile[]> {
  const { data, error } = await supabase.rpc('get_profile_connections', { p_username: username.replace(/^@/, ''), p_kind: kind });
  if (error) throw error;
  return (data ?? []) as ConnectionProfile[];
}

export async function fetchActiveStories(userId?: string): Promise<Story[]> {
  if (!userId) return [];
  const { data, error } = await supabase.from('stories').select('id,user_id,novelty_username,name,avatar_url,image_url,caption,created_at,expires_at,source_story_id').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(60);
  if (error) throw error;
  const rows = data ?? [];
  if (!rows.length) return [];
  const withSignedImages = await Promise.all(rows.map(async (s) => {
    const path = s.image_url.includes('/storage/v1/object/public/stories/') ? s.image_url.split('/storage/v1/object/public/stories/')[1].split('?')[0] : s.image_url;
    const { data: signed } = await supabase.storage.from('stories').createSignedUrl(path, 60 * 60);
    return { ...s, image_url: signed?.signedUrl || s.image_url };
  }));
  const ids = rows.map((s) => s.id);
  const { data: likes } = await supabase.from('story_likes').select('story_id,user_id').in('story_id', ids);
  const { data: reposts } = await supabase.from('story_reposts').select('story_id,user_id').in('story_id', ids).eq('user_id', userId);
  const counts = new Map<string, number>();
  const mine = new Set<string>();
  for (const like of likes ?? []) { counts.set(like.story_id, (counts.get(like.story_id) ?? 0) + 1); if (like.user_id === userId) mine.add(like.story_id); }
  const reposted = new Set((reposts ?? []).map((r) => r.story_id));
  return withSignedImages.map((s) => ({ ...s, like_count: counts.get(s.id) ?? 0, liked_by_me: mine.has(s.id), reposted_by_me: reposted.has(s.id) })) as Story[];
}

export async function toggleStoryLike(userId: string, storyId: string, liked: boolean): Promise<void> {
  if (liked) { const { error } = await supabase.from('story_likes').delete().eq('story_id', storyId).eq('user_id', userId); if (error) throw error; }
  else { const { error } = await supabase.from('story_likes').insert({ story_id: storyId, user_id: userId }); if (error) throw error; }
}
export async function repostStory(storyId: string): Promise<void> { const { error } = await supabase.rpc('repost_story', { p_story_id: storyId }); if (error) throw error; }

export async function uploadStoryImage(rawFile: File, userId: string): Promise<string> {
  const file = await prepareImageForUpload(rawFile); const ext = extForImageType(file.type);
  const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from('stories').upload(fileName, file, { contentType: file.type, cacheControl: '86400' });
  if (error) throw error;
  return fileName;
}
export async function createStory(imageUrl: string, caption?: string): Promise<void> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error('You must be signed in to publish a story.');
  const { error } = await supabase.from('stories').insert({
    user_id: authData.user.id,
    image_url: imageUrl,
    caption: caption?.trim() || null,
  });
  if (error) throw error;
}
