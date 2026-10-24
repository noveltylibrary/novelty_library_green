/**
 * Open, key-less word and book sources, all browser-side and best-effort:
 *  - Open Library (books, authors, subjects)   - Wikipedia (article snippets)   - Datamuse (topic-related English words + frequency)
 * Every call has a short timeout and a 24 h cache, so a slow or blocked source never stalls a game.
 */
const TTL = 24 * 3_600_000;
const mem = new Map<string, unknown>();

function cacheGet<T>(key: string): T | null {
  if (mem.has(key)) return mem.get(key) as T;
  try {
    const raw = localStorage.getItem(`nl_en_cache:${key}`);
    if (!raw) return null;
    const { t, v } = JSON.parse(raw) as { t: number; v: T };
    if (Date.now() - t > TTL) return null;
    mem.set(key, v);
    return v;
  } catch { return null; }
}
function cacheSet(key: string, v: unknown) {
  mem.set(key, v);
  try { localStorage.setItem(`nl_en_cache:${key}`, JSON.stringify({ t: Date.now(), v })); } catch { /* quota or private mode */ }
}

async function getJson<T>(url: string, ms = 3500): Promise<T | null> {
  const ctl = new AbortController();
  const timer = window.setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    return res.ok ? (await res.json()) as T : null;
  } catch { return null; } finally { window.clearTimeout(timer); }
}

const FIVE = /\b[a-z]{5}\b/g;

/** Five-letter words from a text. */
export const fiveLetterWords = (text: string): string[] => (text.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').match(FIVE) ?? []);

/* ---------- Datamuse: English words related to some topics, with frequency per million ---------- */
export interface FreqWord { word: string; freq: number }
export async function datamuseTopicWords(topics: string[]): Promise<FreqWord[]> {
  const t = topics.map((x) => x.trim().toLowerCase()).filter(Boolean).slice(0, 5);
  if (!t.length) return [];
  const key = `dm:${t.join('|')}`;
  const hit = cacheGet<FreqWord[]>(key);
  if (hit) return hit;
  const data = await getJson<Array<{ word: string; tags?: string[] }>>(`https://api.datamuse.com/words?sp=?????&topics=${encodeURIComponent(t.join(','))}&md=f&max=120`);
  if (!data) return [];
  const out = data.filter((d) => /^[a-z]{5}$/.test(d.word)).map((d) => ({ word: d.word, freq: Number((d.tags ?? []).find((x) => x.startsWith('f:'))?.slice(2) ?? 0) }));
  cacheSet(key, out);
  return out;
}

/** Is this an English word, and how common? Used for guesses outside the built-in list. */
export async function datamuseCheck(word: string): Promise<FreqWord | null> {
  const key = `dmw:${word}`;
  const hit = cacheGet<FreqWord | 0>(key);
  if (hit !== null) return hit || null;
  const data = await getJson<Array<{ word: string; tags?: string[] }>>(`https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&md=f&max=1`, 2500);
  if (!data) return null; // unreachable: not cached, ask again next time
  const row = data.find((d) => d.word === word);
  const res = row ? { word, freq: Number((row.tags ?? []).find((x) => x.startsWith('f:'))?.slice(2) ?? 0) } : null;
  cacheSet(key, res ?? 0);
  return res;
}

/* ---------- Open Library ---------- */
export interface OlBook { title: string; author: string; subjects: string[]; editions: number; ratings: number; year: number | null }
export async function openLibraryBySubject(subject: string, limit = 40): Promise<OlBook[]> {
  const s = subject.trim().toLowerCase();
  if (!s) return [];
  const key = `ol:${s}:${limit}`;
  const hit = cacheGet<OlBook[]>(key);
  if (hit) return hit;
  const q = encodeURIComponent(`subject:"${s}" language:eng`);
  const data = await getJson<{ docs?: Array<{ title?: string; author_name?: string[]; subject?: string[]; edition_count?: number; ratings_count?: number; first_publish_year?: number }> }>(
    `https://openlibrary.org/search.json?q=${q}&sort=readinglog&limit=${limit}&fields=title,author_name,subject,edition_count,ratings_count,first_publish_year`, 4500);
  if (!data?.docs) return [];
  const out = data.docs.filter((d) => d.title).map((d) => ({ title: d.title!, author: d.author_name?.[0] ?? '', subjects: (d.subject ?? []).slice(0, 40), editions: d.edition_count ?? 0, ratings: d.ratings_count ?? 0, year: d.first_publish_year ?? null }));
  cacheSet(key, out);
  return out;
}

/* ---------- Wikipedia: words used in articles about a topic ---------- */
export async function wikipediaWords(term: string): Promise<string[]> {
  const t = term.trim().toLowerCase();
  if (!t) return [];
  const key = `wp:${t}`;
  const hit = cacheGet<string[]>(key);
  if (hit) return hit;
  const data = await getJson<{ query?: { search?: Array<{ title: string; snippet: string }> } }>(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(`${t} literature novel`)}&srlimit=12&srprop=snippet&format=json&origin=*`);
  const rows = data?.query?.search ?? [];
  if (!rows.length) return [];
  const words = [...new Set(rows.flatMap((r) => fiveLetterWords(`${r.title} ${r.snippet.replace(/<[^>]+>/g, ' ')}`)))];
  cacheSet(key, words);
  return words;
}
