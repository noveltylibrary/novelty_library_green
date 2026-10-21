import { useEffect, useState } from 'react';
import { norm } from '@/lib/rankingSearch';
import { parseName } from '@/components/NameBlock';

/** Public-web author facts (Wikipedia + Open Library). Best-effort: every failure just means "show nothing". */
export interface AuthorBio {
  description: string;
  summary: string;
  url: string;
  otherBooks: string[];
  years: string;
}

const cache = new Map<string, AuthorBio | null>();
const WRITER = /writer|novelist|author|poet|playwright|essayist|journalist|dramatist|screenwriter|philosopher|critic|historian|biograph|scholar|storyteller|lyricist|satirist/i;

async function getJson(url: string, ms = 6000): Promise<any> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; } finally { clearTimeout(t); }
}

function tidySummary(text: string): string {
  let t = (text || '').replace(/\s+/g, ' ').trim();
  // Drop the long birth/death parenthesis and pronunciations that clutter the first line.
  t = t.replace(/\s*\([^)]{18,}\)/, '').replace(/\s*\[[^\]]*\]/g, '');
  if (t.length > 420) {
    const cut = t.slice(0, 420);
    const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '));
    t = end > 160 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, '') + '…';
  }
  return t;
}

export async function fetchAuthorBio(fullName: string, reviewedTitles: string[] = []): Promise<AuthorBio | null> {
  const parsed = parseName(fullName);
  const clean = [parsed.first, parsed.rest].filter(Boolean).join(' ').trim();
  const withTitle = [parsed.title, clean].filter(Boolean).join(' ');
  if (clean.length < 3) return null;
  const key = norm(withTitle);
  if (cache.has(key)) return cache.get(key) ?? null;

  const last = norm(clean).split(' ').filter(Boolean).pop() || '';
  const nameTokens = norm(clean).split(' ').filter((w) => w.length > 2);

  const [wiki, ol] = await Promise.all([
    getJson(`https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(`${withTitle} writer author`)}&gsrlimit=4&prop=extracts%7Cdescription%7Cinfo&exintro=1&explaintext=1&exsentences=4&inprop=url&format=json&origin=*`),
    getJson(`https://openlibrary.org/search.json?author=${encodeURIComponent(clean)}&sort=editions&limit=25&fields=title,first_publish_year,author_name,edition_count`),
  ]);

  let description = ''; let summary = ''; let url = '';
  const pages = Object.values(wiki?.query?.pages ?? {}) as any[];
  pages.sort((a, b) => (a.index ?? 9) - (b.index ?? 9));
  for (const pg of pages) {
    const title = norm(pg.title);
    const hitsName = nameTokens.filter((w) => title.includes(w)).length;
    if (!title.includes(last) || hitsName < Math.min(2, nameTokens.length)) continue;
    if (!WRITER.test(`${pg.description || ''} ${pg.extract || ''}`.slice(0, 600))) continue;
    description = pg.description || ''; summary = tidySummary(pg.extract || ''); url = pg.fullurl || '';
    break;
  }

  const reviewed = new Set(reviewedTitles.map((t) => norm(t)));
  const seen = new Set<string>(); const otherBooks: string[] = []; const years: number[] = [];
  for (const d of (ol?.docs ?? []) as any[]) {
    const names = (d.author_name ?? []).map((n: string) => norm(n));
    if (!names.some((n: string) => n.includes(last) && nameTokens.filter((w) => n.includes(w)).length >= Math.min(2, nameTokens.length))) continue;
    if (Number.isFinite(d.first_publish_year)) years.push(d.first_publish_year);
    const t = String(d.title || '').trim();
    const k = norm(t);
    if (!t || t.length > 70 || seen.has(k)) continue;
    seen.add(k);
    // A reviewed book (or a title that contains one) is already on the page below.
    if ([...reviewed].some((r) => r && (k === r || k.includes(r) || r.includes(k)))) continue;
    if (otherBooks.length < 6) otherBooks.push(t);
  }
  const yrs = years.filter((y) => y > 1400);
  const span = yrs.length ? `${Math.min(...yrs)}–${Math.max(...yrs)}` : '';
  const out = summary || otherBooks.length ? { description, summary, url, otherBooks, years: span } : null;
  cache.set(key, out);
  return out;
}

export function useAuthorBio(name: string, reviewedTitles: string[]): { bio: AuthorBio | null; loading: boolean } {
  const [bio, setBio] = useState<AuthorBio | null>(null);
  const [loading, setLoading] = useState(true);
  const titlesKey = reviewedTitles.join('|');
  useEffect(() => {
    let live = true;
    setLoading(true);
    fetchAuthorBio(name, reviewedTitles).then((b) => { if (live) { setBio(b); setLoading(false); } }).catch(() => { if (live) setLoading(false); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, titlesKey]);
  return { bio, loading };
}

export interface BookHint { title: string; author: string; year: number | null }

/** When nothing in our reviews matches, ask Open Library what the reader probably meant. */
export function useBookHints(query: string, enabled: boolean): BookHint[] {
  const [hints, setHints] = useState<BookHint[]>([]);
  useEffect(() => {
    const q = query.trim();
    if (!enabled || q.length < 4) { setHints([]); return; }
    let live = true;
    const t = setTimeout(async () => {
      const j = await getJson(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=3&fields=title,author_name,first_publish_year`);
      if (!live) return;
      setHints(((j?.docs ?? []) as any[]).filter((d) => d.title).map((d) => ({ title: String(d.title), author: String(d.author_name?.[0] ?? ''), year: Number.isFinite(d.first_publish_year) ? d.first_publish_year : null })));
    }, 600);
    return () => { live = false; clearTimeout(t); };
  }, [query, enabled]);
  return hints;
}
