import { supabase } from '@/lib/supabase';
import { compressImageForUpload, extForImageType } from '@/lib/imageUpload';

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
  const file = await compressImageForUpload(rawFile, 1080, 0.82); const ext = extForImageType(file.type);
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

/* ---------- Story highlights + 30-day archive ---------- */
export const MAX_HIGHLIGHTS = 7;
export const MAX_HIGHLIGHT_ITEMS = 30;
export const STORY_RETENTION_NOTE = 'Stories are deleted from Novelty Library after 30 days. Add a story to a Highlight to keep it on your profile.';

export interface HighlightItem { id: string; highlight_id: string; image_url: string; image_path: string; caption: string | null; source_story_id: string | null; story_created_at: string | null; }
export interface Highlight { id: string; user_id: string; title: string; sort_order: number; created_at: string; cover_path?: string | null; cover_url?: string | null; items: HighlightItem[]; }
export interface ArchiveStory { id: string; path: string; image_url: string; caption: string | null; created_at: string; live: boolean; }

const storyPath = (v: string) => (v.includes('/storage/v1/object/public/stories/') ? v.split('/storage/v1/object/public/stories/')[1].split('?')[0] : v);
const highlightUrl = (path: string) => supabase.storage.from('highlights').getPublicUrl(path).data.publicUrl;

export async function fetchHighlights(userId: string): Promise<Highlight[]> {
  const base = () => supabase.from('story_highlights');
  // cover_path is added by sql/NL_SQL_210_highlight_cover.sql; read without it until that has been run.
  let res = await base().select('id,user_id,title,sort_order,created_at,cover_path').eq('user_id', userId).order('sort_order', { ascending: true }).order('created_at', { ascending: true }).limit(MAX_HIGHLIGHTS);
  if (res.error && /cover_path/.test(res.error.message || '')) res = await base().select('id,user_id,title,sort_order,created_at').eq('user_id', userId).order('sort_order', { ascending: true }).order('created_at', { ascending: true }).limit(MAX_HIGHLIGHTS) as unknown as typeof res;
  const { data: hs, error } = res;
  if (error) throw error;
  if (!hs?.length) return [];
  const { data: its, error: e2 } = await supabase.from('story_highlight_items').select('id,highlight_id,image_path,caption,source_story_id,story_created_at,created_at').in('highlight_id', hs.map((h) => h.id)).order('created_at', { ascending: true });
  if (e2) throw e2;
  return hs.map((h) => ({ ...h, cover_url: (h as { cover_path?: string | null }).cover_path ? highlightUrl((h as { cover_path: string }).cover_path) : null, items: (its ?? []).filter((i) => i.highlight_id === h.id).map((i) => ({ id: i.id, highlight_id: i.highlight_id, image_path: i.image_path, image_url: highlightUrl(i.image_path), caption: i.caption, source_story_id: i.source_story_id, story_created_at: i.story_created_at })) }));
}

/** The reader's own stories from the last 30 days (live ones included). */
export async function fetchArchive(userId: string): Promise<ArchiveStory[]> {
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { data, error } = await supabase.from('stories').select('id,image_url,caption,created_at,expires_at').eq('user_id', userId).gt('created_at', since).order('created_at', { ascending: false }).limit(200);
  if (error) throw error;
  const rows = data ?? [];
  return Promise.all(rows.map(async (s) => {
    const path = storyPath(s.image_url);
    const { data: signed } = await supabase.storage.from('stories').createSignedUrl(path, 60 * 60);
    return { id: s.id, path, image_url: signed?.signedUrl || '', caption: s.caption, created_at: s.created_at, live: new Date(s.expires_at).getTime() > Date.now() };
  }));
}

/** Copy the chosen stories into a highlight (creating it first when highlightId is null). Returns the highlight id. */
export async function saveToHighlight(userId: string, target: { id: string } | { title: string }, stories: ArchiveStory[]): Promise<string> {
  let highlightId: string;
  if ('id' in target) highlightId = target.id;
  else {
    const title = target.title.trim().slice(0, 24);
    if (!title) throw new Error('Give the highlight a name.');
    const { data, error } = await supabase.from('story_highlights').insert({ user_id: userId, title }).select('id').single();
    if (error) throw error;
    highlightId = data.id;
  }
  {
    for (const s of stories) {
      const ext = (s.path.split('.').pop() || 'jpg').toLowerCase();
      const dest = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: cErr } = await supabase.storage.from('stories').copy(s.path, dest, { destinationBucket: 'highlights' });
      if (cErr) throw cErr;
      const { error } = await supabase.from('story_highlight_items').insert({ highlight_id: highlightId, user_id: userId, image_path: dest, caption: s.caption, source_story_id: s.id, story_created_at: s.created_at });
      if (error) { await supabase.storage.from('highlights').remove([dest]); throw error; }
    }
  }
  return highlightId;
}

export async function removeHighlightItem(item: HighlightItem): Promise<void> {
  const { error } = await supabase.from('story_highlight_items').delete().eq('id', item.id);
  if (error) throw error;
  await supabase.storage.from('highlights').remove([item.image_path]);
}
export async function deleteHighlight(h: Highlight): Promise<void> {
  const { error } = await supabase.from('story_highlights').delete().eq('id', h.id);
  if (error) throw error;
  const files = [...h.items.map((i) => i.image_path), ...(h.cover_path ? [h.cover_path] : [])];
  if (files.length) await supabase.storage.from('highlights').remove(files);
}
export async function renameHighlight(id: string, title: string): Promise<void> {
  const t = title.trim().slice(0, 24); if (!t) throw new Error('Give the highlight a name.');
  const { error } = await supabase.from('story_highlights').update({ title: t }).eq('id', id);
  if (error) throw error;
}

/** Highlight cover: pick one of your last-30-day stories, or upload a photo from your gallery. */
export async function setHighlightCover(userId: string, highlight: Highlight, source: { story: ArchiveStory } | { file: File }): Promise<void> {
  let dest: string;
  if ('story' in source) {
    const ext = (source.story.path.split('.').pop() || 'jpg').toLowerCase();
    dest = `${userId}/cover-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from('stories').copy(source.story.path, dest, { destinationBucket: 'highlights' });
    if (error) throw error;
  } else {
    const f = source.file;
    if (!/^image\/(jpeg|png|webp)$/i.test(f.type)) throw new Error('Choose a JPG, PNG or WebP image.');
    if (f.size > 8 * 1024 * 1024) throw new Error('Image must be 8 MB or smaller.');
    const ext = f.type === 'image/png' ? 'png' : f.type === 'image/webp' ? 'webp' : 'jpg';
    dest = `${userId}/cover-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from('highlights').upload(dest, f, { contentType: f.type, cacheControl: '86400' });
    if (error) throw error;
  }
  const { error: uErr } = await supabase.from('story_highlights').update({ cover_path: dest }).eq('id', highlight.id);
  if (uErr) { await supabase.storage.from('highlights').remove([dest]); throw new Error(/cover_path/.test(uErr.message || '') ? 'Highlight covers need the NL_SQL_210 database update first.' : uErr.message); }
  if (highlight.cover_path) await supabase.storage.from('highlights').remove([highlight.cover_path]);
}
