import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { safeExternalUrl } from '@/lib/sanitize';

/**
 * Profile pictures for community comments, replies and reader reviews.
 * Uses the SAME avatar the profile card shows (profiles.avatar_url) and honours the reader's
 * "show profile picture" privacy switch (profile_visibility.avatar). Reads go through the
 * `community_user_avatars` RPC (see sql/community_avatars.sql) because profiles rows of other readers are not directly readable.
 * Any failure just falls back to the initial-letter bubble.
 */
const cache = new Map<string, string | null>();

export async function fetchAvatarMap(userIds: string[]): Promise<Record<string, string | null>> {
  const wanted = [...new Set(userIds.filter(Boolean))];
  const missing = wanted.filter((id) => !cache.has(id));
  if (missing.length) {
    try {
      const { data, error } = await supabase.rpc('community_user_avatars', { p_ids: missing });
      if (error) throw error;
      const found = new Map<string, string | null>();
      for (const row of (data ?? []) as { id: string; avatar_url: string | null }[]) found.set(row.id, safeExternalUrl(row.avatar_url));
      for (const id of missing) cache.set(id, found.get(id) ?? null);
    } catch {
      // Not cached on failure so a later render can retry; callers fall back to initials.
    }
  }
  const out: Record<string, string | null> = {};
  for (const id of wanted) out[id] = cache.get(id) ?? null;
  return out;
}

/** Avatar URLs by user id. The signed-in reader's own picture comes straight from their profile. */
export function useUserAvatars(userIds: string[], self?: { id?: string | null; avatarUrl?: string | null }) {
  const key = [...new Set(userIds.filter(Boolean))].sort().join(',');
  const [map, setMap] = useState<Record<string, string | null>>({});
  useEffect(() => {
    let alive = true;
    const ids = key ? key.split(',') : [];
    if (!ids.length) { setMap({}); return; }
    fetchAvatarMap(ids).then((m) => { if (alive) setMap(m); });
    return () => { alive = false; };
  }, [key]);
  const selfId = self?.id || '';
  const selfUrl = self?.avatarUrl ? safeExternalUrl(self.avatarUrl) : null;
  return useMemo(() => (selfId && selfUrl ? { ...map, [selfId]: selfUrl } : map), [map, selfId, selfUrl]);
}
