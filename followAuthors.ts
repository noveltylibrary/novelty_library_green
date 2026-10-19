import { useCallback, useEffect, useState } from 'react';

/* Following an author (this browser only: authors are not accounts, so nothing is stored in Supabase). */
const KEY = 'nl_followed_authors';
const listeners = new Set<() => void>();

function read(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string').slice(0, 500) : [];
  } catch { return []; }
}
function write(next: string[]) {
  try { localStorage.setItem(KEY, JSON.stringify(next.slice(0, 500))); } catch { /* storage blocked: stays in memory only */ }
  listeners.forEach((fn) => fn());
}

export function useFollowedAuthors() {
  const [keys, setKeys] = useState<string[]>(() => read());
  useEffect(() => {
    const sync = () => setKeys(read());
    listeners.add(sync);
    window.addEventListener('storage', sync);
    return () => { listeners.delete(sync); window.removeEventListener('storage', sync); };
  }, []);
  const toggle = useCallback((key: string) => {
    const cur = read();
    write(cur.includes(key) ? cur.filter((x) => x !== key) : [key, ...cur]);
  }, []);
  return { keys, isFollowing: (key: string) => keys.includes(key), toggle };
}
