import { norm, type Match, type SearchBook } from '@/lib/rankingSearch';

/**
 * "Can't spell it?" search: find a book from a half-remembered title, a misspelt author, or a detail you remember
 * ("that book with the octopus"). Forgiving of typos, partial words and word order.
 */
const FILLER = new Set(['a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'about', 'by', 'me', 'my', 'i', 'is', 'it', 'that', 'this', 'was', 'were', 'has', 'had', 'there', 'one', 'some', 'something', 'book', 'books', 'novel', 'story', 'read', 'reading', 'remember', 'forgot', 'name', 'title', 'called', 'where', 'who', 'what', 'which', 'its', 'whose']);

function distance(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

const typosFor = (w: string) => (w.length >= 8 ? 2 : w.length >= 4 ? 1 : 0);

/** 1 exact, .85 starts-with, .7 typo, 0 none. */
function wordFit(q: string, w: string): number {
  if (q === w) return 1;
  if (q.length >= 3 && w.length > q.length && w.startsWith(q)) return 0.85;
  const t = typosFor(q);
  if (t > 0 && distance(q, w, t) <= t) return 0.7;
  return 0;
}
const bestFit = (q: string, words: string[]) => words.reduce((m, w) => Math.max(m, wordFit(q, w)), 0);

export function rememberedSearch(books: SearchBook[], query: string, limit = 3): Match[] {
  const tokens = norm(query).split(' ').filter((t) => t.length > 1 && !FILLER.has(t));
  if (!tokens.length || !books.length) return [];
  const qNorm = tokens.join(' ');
  const prepared = books.map((b) => ({
    b,
    title: norm(b.title).split(' ').filter(Boolean),
    titleStr: norm(b.title),
    author: norm(b.author).split(' ').filter(Boolean),
    text: [...new Set(norm(`${b.text} ${b.traits} ${b.genre}`).split(' ').filter((w) => w.length > 2))],
  }));
  // Rarer words count for more ("octopus" says more than "dark").
  const df = new Map<string, number>();
  for (const p of prepared) for (const t of tokens) if (bestFit(t, p.text) >= 0.85) df.set(t, (df.get(t) ?? 0) + 1);
  const rarity = (t: string) => Math.min(1, Math.log(1 + prepared.length / (1 + (df.get(t) ?? 0))) / Math.log(1 + prepared.length / 2));

  const out: Match[] = [];
  for (const p of prepared) {
    let sum = 0; let hits = 0;
    const titleHits: string[] = []; const authorHits: string[] = []; const textHits: string[] = [];
    for (const t of tokens) {
      const tm = bestFit(t, p.title); const am = bestFit(t, p.author); const xm = bestFit(t, p.text);
      const s = Math.max(3 * tm, 2.5 * am, 1.6 * xm * rarity(t));
      if (s > 0) hits += 1;
      sum += s;
      if (tm >= 0.7 && 3 * tm >= Math.max(2.5 * am, 1.6 * xm * rarity(t))) titleHits.push(t);
      else if (am >= 0.7 && 2.5 * am >= 1.6 * xm * rarity(t)) authorHits.push(t);
      else if (xm >= 0.7) textHits.push(t);
    }
    let score = sum / (3 * tokens.length);
    // Whole-title closeness catches "harry poter" or a title typed in a different spacing.
    const longest = Math.max(qNorm.length, p.titleStr.length);
    const wholeRatio = longest ? 1 - distance(qNorm, p.titleStr, Math.ceil(longest * 0.4)) / longest : 0;
    if (wholeRatio >= 0.6) score = Math.max(score, wholeRatio);
    if (p.titleStr.includes(qNorm) && qNorm.length >= 4) score = Math.max(score, 0.95);
    if (hits < Math.ceil(tokens.length / 2) && wholeRatio < 0.6) continue;
    const pct = Math.round(Math.min(1, score) * 100);
    if (pct < 22) continue;
    const reasons: string[] = [];
    if (wholeRatio >= 0.6 || titleHits.length) reasons.push(`Title looks like “${p.b.title}”`);
    if (authorHits.length) reasons.push(`Author looks like ${p.b.author}`);
    if (textHits.length) reasons.push(`Mentions ${[...new Set(textHits)].slice(0, 3).map((w) => `“${w}”`).join(', ')}`);
    out.push({ book: p.b, score: pct, reasons: reasons.length ? reasons : ['Closest to what you remember'] });
  }
  return out.sort((a, b) => b.score - a.score || (b.book.nl ?? -1) - (a.book.nl ?? -1)).slice(0, limit);
}
