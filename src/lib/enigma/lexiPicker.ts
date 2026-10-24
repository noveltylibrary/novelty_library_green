import { hashKey, lastSeen, seenMap } from '@/lib/enigma/seenStore';
import { BLOCKED, loadCommonWords, loadValidWords } from '@/lib/enigma/wordBank';
import { datamuseTopicWords, fiveLetterWords, openLibraryBySubject, wikipediaWords } from '@/lib/enigma/sources';
import { conceptIds, vectorOf, cosine } from '@/lib/enigma/taste';
import type { Signals } from '@/lib/enigma/signals';

export type LexiOrigin = 'book' | 'topic' | 'common';
export interface LexiPick { word: string; origin: LexiOrigin; concepts: string[] }

type Pool = Map<string, number>; // word → weight
const add = (pool: Pool, word: string, w: number) => { if (w > (pool.get(word) ?? 0)) pool.set(word, w); };
const pickWeighted = <T,>(items: [T, number][]): T | null => {
  const total = items.reduce((n, [, w]) => n + w, 0);
  if (!total) return null;
  let r = Math.random() * total;
  for (const [item, w] of items) { r -= w; if (r <= 0) return item; }
  return items[items.length - 1][0];
};
const timeout = <T,>(p: Promise<T>, ms: number, fallback: T): Promise<T> => new Promise((res) => { const t = window.setTimeout(() => res(fallback), ms); p.then((v) => { window.clearTimeout(t); res(v); }, () => { window.clearTimeout(t); res(fallback); }); });

/** Warm the caches while the reader is still on the hub, so a round starts instantly. Never throws. */
export function warmLexiSources(s: Signals): void {
  void loadValidWords(); void loadCommonWords();
  s.subjects.slice(0, 2).forEach((t) => { void datamuseTopicWords([t]); void openLibraryBySubject(t, 30); void wikipediaWords(t); });
}

/** Words from books the reader's taste points at: catalogue reviews (titles, authors, genres, traits, text), Open Library titles, Wikipedia. */
async function bookPool(s: Signals, valid: Set<string>, common: Set<string>): Promise<Pool> {
  const pool: Pool = new Map();
  const seenInCatalogue = new Map<string, number>();
  const rows = s.catalogue.map((b) => ({ b, words: fiveLetterWords(`${b.title} ${b.author} ${b.genre} ${b.traits} ${b.text.slice(0, 1800)}`) }));
  rows.forEach(({ words }) => new Set(words).forEach((w) => seenInCatalogue.set(w, (seenInCatalogue.get(w) ?? 0) + 1)));
  for (const { b, words } of rows) {
    const sim = cosine(s.taste, vectorOf(`${b.genre} ${b.traits} ${b.title}`));
    for (const w of new Set(words)) {
      // a word readers keep using in reviews is recognisable even when it is not in the everyday list
      if (!valid.has(w) || (!common.has(w) && (seenInCatalogue.get(w) ?? 0) < 2)) continue;
      add(pool, w, 1 + sim * 6);
    }
  }
  const live = await timeout(Promise.all(s.subjects.slice(0, 3).map(async (t, i) => {
    const [books, wiki] = await Promise.all([openLibraryBySubject(t, 30), wikipediaWords(t)]);
    const boost = 1 + (3 - i) * 0.6;
    books.forEach((bk) => fiveLetterWords(bk.title).forEach((w) => valid.has(w) && common.has(w) && add(pool, w, 2 * boost)));
    wiki.forEach((w) => valid.has(w) && common.has(w) && add(pool, w, 1.4 * boost));
  })), 2200, null);
  void live;
  return pool;
}

/** Everyday words related to the reader's topics (frequency-checked), plus the built-in list. */
async function topicPool(s: Signals, valid: Set<string>, common: Set<string>): Promise<Pool> {
  const pool: Pool = new Map();
  const rows = await timeout(Promise.all(s.subjects.slice(0, 3).map((t) => datamuseTopicWords([t]))), 1800, [] as Awaited<ReturnType<typeof datamuseTopicWords>>[]);
  rows.flat().forEach(({ word, freq }) => { if (valid.has(word) && (common.has(word) || freq >= 4)) add(pool, word, 1.5 + Math.min(2, freq / 20)); });
  common.forEach((w) => add(pool, w, 1));
  return pool;
}

/**
 * Choose the next LexiWord answer. Book-associated words are preferred to the reader's `bookish` share, but not always;
 * words served inside the no-repeat window are skipped, and only when everything has been served does the pick fall back
 * to the least recently seen word.
 */
export async function pickLexiWord(s: Signals): Promise<LexiPick> {
  const [valid, common] = await Promise.all([loadValidWords(), loadCommonWords()]);
  const seen = seenMap(s.readerKey, 'lexi');
  const fresh = (w: string) => !BLOCKED.has(w) && !seen.has(hashKey(w));

  const leanBook = !s.struggling && Math.random() < s.bookish;
  const order: LexiOrigin[] = leanBook ? ['book', 'topic', 'common'] : s.cruising ? ['topic', 'book', 'common'] : ['topic', 'common', 'book'];

  for (const origin of order) {
    let pool: Pool;
    if (origin === 'book') pool = await bookPool(s, valid, common);
    else if (origin === 'topic') pool = await topicPool(s, valid, common);
    else pool = new Map([...common].map((w) => [w, 1] as [string, number]));
    const items: [string, number][] = [];
    pool.forEach((w, word) => {
      if (!fresh(word)) return;
      let weight = w * (word.endsWith('s') && !common.has(word) ? 0.3 : 1);
      if (s.struggling && !common.has(word)) weight *= 0.3; // friendlier words after two misses
      items.push([word, weight]);
    });
    const word = pickWeighted(items);
    if (word) return { word: word.toUpperCase(), origin, concepts: conceptIds(`${s.subjects.slice(0, 2).join(' ')}`) };
  }

  // Everything has been served within the window: take the one seen longest ago.
  const history = lastSeen(s.readerKey, 'lexi');
  const word = [...common].filter((w) => !BLOCKED.has(w)).sort((a, b) => (history.get(hashKey(a)) ?? 0) - (history.get(hashKey(b)) ?? 0))[0] ?? 'novel';
  return { word: word.toUpperCase(), origin: 'common', concepts: [] };
}
