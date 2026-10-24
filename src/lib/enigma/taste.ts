import { conceptsOf, norm } from '@/lib/rankingSearch';

/** Sparse taste vector: `c:<concept>` for genre-like concepts, `t:<word>` for plain words. */
export type TasteVec = Map<string, number>;

const SKIP = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'about', 'book', 'books', 'novel', 'story', 'their', 'there', 'have', 'been', 'were', 'will', 'your', 'what', 'when', 'who']);

export function vectorOf(text: string, weight = 1, into: TasteVec = new Map()): TasteVec {
  const t = norm(text);
  if (!t) return into;
  for (const [id, strength] of conceptsOf(t)) into.set(`c:${id}`, (into.get(`c:${id}`) ?? 0) + strength * weight * 2);
  for (const w of t.split(' ')) if (w.length >= 4 && !SKIP.has(w)) into.set(`t:${w}`, (into.get(`t:${w}`) ?? 0) + weight);
  return into;
}

export function cosine(a: TasteVec, b: TasteVec): number {
  if (!a.size || !b.size) return 0;
  let dot = 0; let na = 0; let nb = 0;
  for (const [k, v] of a) { na += v * v; const o = b.get(k); if (o) dot += v * o; }
  for (const v of b.values()) nb += v * v;
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/** Concept ids (without the prefix) found in a piece of text. */
export const conceptIds = (text: string): string[] => [...conceptsOf(text).keys()];
