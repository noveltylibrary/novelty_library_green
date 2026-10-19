/**
 * Live Rankings search + taste match. Everything runs in the browser over the already-loaded published
 * reviews (no database access, no schema), so it is safe for the AdSense crawler and cheap to run.
 *
 * Two kinds of matching:
 *  - strictSearch: one chosen field (genre / language / traits / author) + a short query. Exact word first, then
 *    known equivalents ("psychological suspense thriller" = "psychological thriller"), then partial / typo matches.
 *  - broadSearch: free text matched across title, author, genre, traits, language, verdict and review text, with
 *    typo tolerance and "related genre" expansion, so it returns more variants.
 * All comparisons ignore capitals, accents, punctuation and extra spaces.
 */

import { normalizeVerdict, verdictLabel } from '@/lib/verdict';

export type SearchField = 'genre' | 'language' | 'traits' | 'author';

export interface SearchBook {
  id: string;
  title: string;
  author: string;
  genre: string;
  language: string;
  traits: string;
  verdict: string;
  text: string;
  nl: number | null;
  rw: number;
  /** Optional structured metrics from a future catalog integration; numeric values are normalized to 0..1. */
  metricValues?: Record<string, string | number | null | undefined>;
  translatedIn?: string | null;
  seriesName?: string | null;
  seriesNumber?: number | null;
  goodreadsRating?: number | null;
  amazonRating?: number | null;
}

export interface Match<T = SearchBook> {
  book: T;
  score: number;
  /** Short "why it matched" chips, e.g. "Genre: Psychological thriller". */
  reasons: string[];
  /** strict only: true when the field value is the query itself (or a known equivalent). */
  exact?: boolean;
}

export const FIELD_LABELS: Record<SearchField, string> = { genre: 'Genre', language: 'Language', traits: 'Traits', author: 'Author' };
export const FIELD_PLACEHOLDERS: Record<SearchField, string> = {
  genre: 'e.g. Psychological thriller',
  language: 'e.g. Tamil',
  traits: 'e.g. Tragedy',
  author: 'e.g. Rowling',
};

export const norm = (value: unknown): string =>
  String(value ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');

const STOP = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'about', 'by', 'me', 'my', 'i', 'is', 'it', 'that', 'this',
  'book', 'books', 'novel', 'novels', 'story', 'stories', 'read', 'reading', 'like', 'want', 'looking', 'something', 'some', 'any',
  'good', 'best', 'show', 'find', 'tell', 'us', 'more', 'where', 'who', 'what', 'are', 'was', 'be',
]);

/** Levenshtein distance, early exit above `max`. */
function editDistance(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** How many typos a word of this length may contain. */
const allowedTypos = (word: string) => (word.length >= 9 ? 2 : word.length >= 5 ? 1 : 0);

/** 1 exact word, 0.7 prefix, 0.6 typo, 0 none. */
function wordSimilarity(q: string, w: string): number {
  if (q === w) return 1;
  if (q.length >= 4 && (w.startsWith(q) || (w.length >= 4 && q.startsWith(w)))) return 0.7;
  const typos = allowedTypos(q);
  if (typos > 0 && editDistance(q, w, typos) <= typos) return 0.6;
  return 0;
}

const hasPhrase = (haystack: string, phrase: string): boolean => !!phrase && ` ${haystack} `.includes(` ${phrase} `);

/* ───────────── genre knowledge ───────────── */

interface Group { id: string; label: string; phrases: string[] }
const GROUPS: Group[] = [
  { id: 'psych', label: 'Psychological thriller', phrases: ['psychological thriller', 'psychological suspense', 'psychological suspense thriller', 'psych thriller', 'mind game thriller', 'cognitive thriller', 'psychological fiction', 'psychological'] },
  { id: 'suspense', label: 'Suspense thriller', phrases: ['suspense thriller', 'suspense', 'thriller', 'suspense and thriller'] },
  { id: 'crime', label: 'Crime', phrases: ['crime thriller', 'crime fiction', 'crime', 'detective', 'detective fiction', 'whodunit', 'murder mystery', 'noir'] },
  { id: 'mystery', label: 'Mystery', phrases: ['mystery', 'mystery thriller', 'mystery and suspense'] },
  { id: 'cogaction', label: 'Cognitive action', phrases: ['cognitive action', 'mind bending action', 'brainy action', 'smart action', 'strategic action', 'spy', 'espionage'] },
  { id: 'action', label: 'Action', phrases: ['action', 'action adventure', 'action thriller'] },
  { id: 'adventure', label: 'Adventure', phrases: ['adventure', 'adventure fiction', 'quest'] },
  { id: 'romance', label: 'Romance', phrases: ['romance', 'romantic', 'love story', 'contemporary romance'] },
  { id: 'romcom', label: 'Romantic comedy', phrases: ['romantic comedy', 'rom com', 'romcom', 'comedy', 'humor', 'humour'] },
  { id: 'darkromance', label: 'Dark romance', phrases: ['mafia romance', 'dark romance'] },
  { id: 'drama', label: 'Drama', phrases: ['drama', 'family drama', 'social drama', 'tragedy'] },
  { id: 'historical', label: 'Historical fiction', phrases: ['historical fiction', 'historical', 'history', 'period fiction', 'historical novel'] },
  { id: 'fantasy', label: 'Fantasy', phrases: ['fantasy', 'epic fantasy', 'high fantasy'] },
  { id: 'myth', label: 'Mythological fiction', phrases: ['mythological fiction', 'mythology', 'myth', 'myth and fantasy fiction', 'myth and fantasy'] },
  { id: 'literary', label: 'Literary fiction', phrases: ['literary fiction', 'literature', 'literary', 'classic', 'classics'] },
  { id: 'nonfiction', label: 'Non-fiction', phrases: ['non fiction', 'nonfiction'] },
  { id: 'selfhelp', label: 'Self-help', phrases: ['self help', 'self improvement', 'personal development', 'self help non fiction'] },
  { id: 'scifi', label: 'Science fiction', phrases: ['science fiction', 'sci fi', 'scifi'] },
  { id: 'dystopian', label: 'Dystopian', phrases: ['dystopian', 'dystopia'] },
  { id: 'horror', label: 'Horror', phrases: ['horror', 'gothic', 'supernatural'] },
  { id: 'business', label: 'Business', phrases: ['business', 'entrepreneurship', 'finance', 'management'] },
  { id: 'memoir', label: 'Memoir', phrases: ['memoir', 'autobiography', 'biography'] },
];
const GROUP_BY_ID = new Map(GROUPS.map((g) => [g.id, g]));
const LOOSE_PAIRS: [string, string][] = [
  ['psych', 'suspense'], ['psych', 'crime'], ['psych', 'mystery'], ['psych', 'cogaction'], ['psych', 'horror'],
  ['suspense', 'crime'], ['suspense', 'mystery'], ['suspense', 'action'], ['suspense', 'horror'], ['crime', 'mystery'],
  ['cogaction', 'action'], ['cogaction', 'scifi'], ['cogaction', 'suspense'], ['action', 'adventure'], ['adventure', 'fantasy'],
  ['adventure', 'historical'], ['romance', 'romcom'], ['romance', 'darkromance'], ['romance', 'drama'], ['drama', 'literary'],
  ['drama', 'historical'], ['historical', 'literary'], ['fantasy', 'myth'], ['fantasy', 'scifi'], ['myth', 'historical'],
  ['scifi', 'dystopian'], ['selfhelp', 'nonfiction'], ['selfhelp', 'business'], ['memoir', 'nonfiction'], ['business', 'nonfiction'],
];
const NEIGHBOURS = new Map<string, Set<string>>();
for (const [a, b] of LOOSE_PAIRS) {
  if (!NEIGHBOURS.has(a)) NEIGHBOURS.set(a, new Set());
  if (!NEIGHBOURS.has(b)) NEIGHBOURS.set(b, new Set());
  NEIGHBOURS.get(a)!.add(b);
  NEIGHBOURS.get(b)!.add(a);
}

/** Group ids a piece of text belongs to, with how strongly (1 = same phrase, .8 = phrase inside / around it). */
export function conceptsOf(text: string): Map<string, number> {
  const t = norm(text);
  const out = new Map<string, number>();
  if (!t) return out;
  for (const g of GROUPS) {
    let best = 0;
    for (const p of g.phrases) {
      if (t === p) { best = 1; break; }
      if (hasPhrase(t, p)) best = Math.max(best, 0.8);
      // A short word that only appears INSIDE a longer phrase ("thriller" in "crime thriller") is a weak hint.
      else if (t.split(' ').length <= 2 && t.length >= 5 && hasPhrase(p, t)) best = Math.max(best, 0.5);
    }
    if (best) out.set(g.id, best);
  }
  return out;
}

const conceptLabel = (id: string) => GROUP_BY_ID.get(id)?.label ?? id;

/* ───────────── field values ───────────── */

function fieldValues(book: SearchBook, field: SearchField): string[] {
  const raw = field === 'genre' ? book.genre : field === 'language' ? book.language : field === 'traits' ? book.traits : book.author;
  const whole = norm(raw);
  if (!whole) return [];
  if (field === 'language' || field === 'author') return [whole];
  const parts = String(raw).split(/[,;/|]+|\.\s+/).map(norm).filter(Boolean);
  return [...new Set([whole, ...parts])];
}

/** Trait cells sometimes carry pasted form noise ("... Language: English  Click here to be redirected to BUY"); keep only the real traits. */
export function cleanTraits(raw: unknown): string {
  return String(raw ?? '').split(/\s{2,}|language\s*:|click here/i)[0].trim();
}

const displayValue = (book: SearchBook, field: SearchField) =>
  field === 'genre' ? book.genre : field === 'language' ? book.language : field === 'traits' ? book.traits : book.author;

/* ───────────── strict search ───────────── */

function strictScore(values: string[], q: string, qTokens: string[], qConcepts: Map<string, number>, useConcepts: boolean): { score: number; exact: boolean } {
  let best = 0;
  let exact = false;
  for (const v of values) {
    let s = 0;
    if (v === q) { s = 100; exact = true; }
    else if (useConcepts && [...qConcepts].some(([id, strength]) => strength === 1 && GROUP_BY_ID.get(id)!.phrases.includes(v))) { s = 92; exact = true; }
    else if (hasPhrase(v, q)) s = 85;
    else if (v.length >= 5 && hasPhrase(q, v)) s = 80;
    else {
      const vTokens = v.split(' ');
      if (qTokens.length && qTokens.every((t) => vTokens.includes(t))) s = 75;
      else if (qTokens.length && qTokens.every((t) => vTokens.some((w) => wordSimilarity(t, w) > 0))) s = 60;
    }
    if (s > best) best = s;
  }
  return { score: best, exact };
}

/** Direct search: the chosen field only. Highest = exact word, then equivalents, then partial and typo matches. */
export function strictSearch(books: SearchBook[], field: SearchField, query: string): Match[] {
  const q = norm(query);
  if (!q) return [];
  const qTokens = q.split(' ').filter((t) => !STOP.has(t) || q.split(' ').length === 1);
  const useConcepts = field === 'genre' || field === 'traits';
  const qConcepts = useConcepts ? conceptsOf(q) : new Map<string, number>();
  const out: Match[] = [];
  for (const book of books) {
    const { score, exact } = strictScore(fieldValues(book, field), q, qTokens, qConcepts, useConcepts);
    if (score <= 0) continue;
    out.push({ book, score, exact, reasons: [`${FIELD_LABELS[field]}: ${displayValue(book, field)}`] });
  }
  return out.sort((a, b) => b.score - a.score || (b.book.nl ?? -1) - (a.book.nl ?? -1) || b.book.rw - a.book.rw);
}

/* ───────────── broad search ───────────── */

const FIELD_WEIGHT = { genre: 5, traits: 4, title: 4, author: 4, language: 3, verdict: 1.5, text: 1 } as const;
const VERDICT_WORDS: Record<string, string> = { perfection: 'perfection perfect masterpiece', go_for_it: 'go for it recommended worth', timepass: 'timepass light casual easy' };

interface Prepared { genre: string[]; traits: string[]; title: string[]; author: string[]; language: string[]; verdict: string[]; text: Set<string>; concepts: Map<string, number>; textNorm: string }
const prepCache = new WeakMap<SearchBook, Prepared>();
function prepare(book: SearchBook): Prepared {
  const cached = prepCache.get(book);
  if (cached) return cached;
  const words = (s: string) => norm(s).split(' ').filter(Boolean);
  const concepts = new Map<string, number>();
  for (const v of [...fieldValues(book, 'genre'), ...fieldValues(book, 'traits')]) for (const [id, s] of conceptsOf(v)) concepts.set(id, Math.max(concepts.get(id) ?? 0, s));
  const textNorm = norm(`${book.title} ${book.genre} ${book.traits} ${book.author}`);
  const p: Prepared = {
    genre: words(book.genre), traits: words(book.traits), title: words(book.title), author: words(book.author), language: words(book.language),
    verdict: words(VERDICT_WORDS[book.verdict] ?? book.verdict), text: new Set(words(book.text).slice(0, 600)), concepts, textNorm,
  };
  prepCache.set(book, p);
  return p;
}

function bestSimilarity(token: string, words: string[]): { sim: number; word: string } {
  let best = 0; let word = '';
  for (const w of words) { const s = wordSimilarity(token, w); if (s > best) { best = s; word = w; if (s === 1) break; } }
  return { sim: best, word };
}

const REASON_FIELD: Record<'genre' | 'traits' | 'title' | 'author' | 'language' | 'verdict', string> = { genre: 'Genre', traits: 'Trait', title: 'Title', author: 'Author', language: 'Language', verdict: 'Verdict' };

export interface BroadOptions {
  exclude?: Set<string>;
  /** Minimum cosine similarity in percent (default 5). */
  minScore?: number;
}

/** Wide search: TF-IDF + cosine similarity over every review. `score` is the cosine similarity as a percentage (0-100). */
export function broadSearch(books: SearchBook[], text: string, opts: BroadOptions = {}): Match[] {
  if (!norm(text) || !books.length) return [];
  const idx = getIndex(books);
  const q = queryVector(idx, text);
  if (!q.vec.size) return [];
  const min = opts.minScore ?? 5;
  const out: Match[] = [];
  for (const doc of idx.docs) {
    if (opts.exclude?.has(doc.book.id)) continue;
    const pct = cosine(q.vec, doc.vec) * 100;
    if (pct >= min) out.push({ book: doc.book, score: Math.round(pct * 10) / 10, reasons: explainMatch(doc, q, text) });
  }
  return out.sort((x, y) => y.score - x.score || (y.book.nl ?? -1) - (x.book.nl ?? -1) || y.book.rw - x.book.rw);
}

/* ───────────── TF-IDF + cosine similarity engine ─────────────
 * Every published review becomes a weighted bag of terms (genre, traits, title, author, language, verdict and review text,
 * plus concept tags for related genres). Terms are weighted by TF-IDF (sublinear tf, smoothed idf, L2-normalised - the same
 * recipe as scikit-learn's TfidfVectorizer) and a query is ranked by cosine similarity against every review.
 * Runs entirely in the browser: no server, no database change. */

type Vec = Map<string, number>;
export type FieldKey = 'genre' | 'traits' | 'title' | 'author' | 'language' | 'verdict';
interface TfDoc { book: SearchBook; vec: Vec; fields: Record<FieldKey, Set<string>>; text: Set<string>; concepts: Map<string, number> }
interface TfIndex { docs: TfDoc[]; idf: Map<string, number>; vocab: string[]; cfg: TfConfig }

/** Every knob of the TF-IDF engine. The live site always uses DEFAULT_TF_CONFIG; the admin Taste Match lab can try others. */
export interface TfConfig {
  /** Weight of a word found in each field (genre, traits...). Higher = that field matters more. */
  fieldWeights: Record<FieldKey, number>;
  /** Weight of a word found in the review text. */
  textWeight: number;
  /** Only the first N words of the review text are used. */
  textTermLimit: number;
  /** Weight of the concept tags (related-genre groups) a book belongs to. */
  conceptWeight: number;
  /** Weight of neighbouring concept tags (genres close to the book's own). */
  neighbourWeight: number;
  /** true: tf = 1 + ln(count) (scikit-learn sublinear_tf). false: raw count. */
  sublinear: boolean;
  /** smooth: ln((1+n)/(1+df)) + 1. plain: ln(n/df). off: every word weighs the same. */
  idf: 'smooth' | 'plain' | 'off';
}
export const DEFAULT_TF_CONFIG: TfConfig = { fieldWeights: { genre: 3, traits: 3, title: 2, author: 2, language: 2, verdict: 1 }, textWeight: 1, textTermLimit: 600, conceptWeight: 3, neighbourWeight: 0.8, sublinear: true, idf: 'smooth' };

const stem = (w: string): string => (w.length > 4 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);
const termsOf = (text: string): string[] => norm(text).split(' ').filter((t) => t && !STOP.has(t)).map(stem);
const bigramsOf = (terms: string[]): string[] => terms.slice(0, -1).map((t, i) => `${t} ${terms[i + 1]}`);

function bookCounts(book: SearchBook, cfg: TfConfig): { counts: Map<string, number>; fields: TfDoc['fields']; text: Set<string>; concepts: Map<string, number> } {
  const counts = new Map<string, number>();
  const add = (t: string, w: number) => counts.set(t, (counts.get(t) ?? 0) + w);
  const fields = { genre: new Set<string>(), traits: new Set<string>(), title: new Set<string>(), author: new Set<string>(), language: new Set<string>(), verdict: new Set<string>() };
  const raw: Record<FieldKey, string> = { genre: book.genre, traits: book.traits, title: book.title, author: book.author, language: book.language, verdict: VERDICT_WORDS[book.verdict] ?? book.verdict };
  (Object.keys(raw) as FieldKey[]).forEach((f) => {
    // Genre / traits are lists ("Thriller, Psychological"): count single words and the neighbouring pairs inside each item.
    const items = f === 'genre' || f === 'traits' ? String(raw[f] ?? '').split(/[,;/|]+/) : [raw[f]];
    for (const item of items) {
      const ts = termsOf(item);
      ts.forEach((t) => { add(t, cfg.fieldWeights[f]); fields[f].add(t); });
      if (f === 'genre' || f === 'traits') bigramsOf(ts).forEach((b) => { add(b, cfg.fieldWeights[f]); fields[f].add(b); });
    }
  });
  const text = new Set<string>();
  termsOf(book.text).slice(0, cfg.textTermLimit).forEach((t) => { add(t, cfg.textWeight); text.add(t); });
  // Concept tags make "psychological thriller" and "psychological suspense" land close together.
  const concepts = new Map<string, number>();
  for (const v of [...fieldValues(book, 'genre'), ...fieldValues(book, 'traits')]) for (const [id, st] of conceptsOf(v)) concepts.set(id, Math.max(concepts.get(id) ?? 0, st));
  for (const [id, st] of concepts) {
    add(`§${id}`, cfg.conceptWeight * st);
    for (const n of NEIGHBOURS.get(id) ?? []) if (!concepts.has(n)) add(`§${n}`, cfg.neighbourWeight * st);
  }
  return { counts, fields, text, concepts };
}

function l2(vec: Vec): Vec {
  let sum = 0; vec.forEach((v) => { sum += v * v; });
  const n = Math.sqrt(sum) || 1;
  vec.forEach((v, k) => vec.set(k, v / n));
  return vec;
}

/** Review side clamps at 1 (a word is never weighed below one occurrence); the query side keeps fractional weights as they are. */
const tfOf = (count: number, cfg: TfConfig, clamp = true): number => (cfg.sublinear ? 1 + Math.log(clamp ? Math.max(count, 1) : count) : count);

export function buildIndex(books: SearchBook[], cfg: TfConfig = DEFAULT_TF_CONFIG): TfIndex {
  const prepared = books.map((book) => ({ book, ...bookCounts(book, cfg) }));
  const df = new Map<string, number>();
  prepared.forEach((p) => p.counts.forEach((_, t) => df.set(t, (df.get(t) ?? 0) + 1)));
  const n = prepared.length;
  const idf = new Map<string, number>();
  df.forEach((d, t) => idf.set(t, cfg.idf === 'off' ? 1 : cfg.idf === 'plain' ? Math.max(Math.log(n / d), 0.05) : Math.log((1 + n) / (1 + d)) + 1));
  const docs: TfDoc[] = prepared.map((p) => {
    const vec: Vec = new Map();
    p.counts.forEach((c, t) => vec.set(t, tfOf(c, cfg) * (idf.get(t) ?? 1)));
    return { book: p.book, vec: l2(vec), fields: p.fields, text: p.text, concepts: p.concepts };
  });
  return { docs, idf, vocab: [...idf.keys()].filter((t) => !t.startsWith('§')), cfg };
}

const indexCache = new WeakMap<SearchBook[], TfIndex>();
function getIndex(books: SearchBook[]): TfIndex {
  let idx = indexCache.get(books);
  if (!idx || idx.docs.length !== books.length) { idx = buildIndex(books); indexCache.set(books, idx); }
  return idx;
}

/** Maps a query word to a word that exists in the library (fixes small typos, accepts prefixes). */
function resolveTerm(t: string, idx: TfIndex): string | null {
  if (idx.idf.has(t)) return t;
  const max = allowedTypos(t);
  let best: string | null = null; let bestD = Infinity;
  for (const w of idx.vocab) {
    if (w.includes(' ')) continue;
    if (t.length >= 4 && w.length > t.length && w.startsWith(t)) { if (0.5 < bestD) { best = w; bestD = 0.5; } continue; }
    if (!max) continue;
    const d = editDistance(t, w, max);
    if (d <= max && d < bestD) { best = w; bestD = d; }
  }
  return best;
}

interface QueryVec { vec: Vec; terms: string[]; concepts: Map<string, number> }

/** Query text (+ optional extra concept weights) -> L2-normalised TF-IDF vector. */
function queryVector(idx: TfIndex, text: string, extraConcepts?: Map<string, number>): QueryVec {
  const raw = termsOf(text).map((t) => resolveTerm(t, idx)).filter((t): t is string => !!t);
  const counts = new Map<string, number>();
  const add = (t: string, w: number) => { if (idx.idf.has(t)) counts.set(t, (counts.get(t) ?? 0) + w); };
  raw.forEach((t) => add(t, 1));
  bigramsOf(raw).forEach((b) => add(b, 1));
  const qNorm = norm(text);
  const parts = [qNorm, ...qNorm.split(' ').filter((t) => t && !STOP.has(t)), ...bigramsOf(qNorm.split(' ').filter((t) => t && !STOP.has(t)))];
  const concepts = new Map<string, number>(extraConcepts ?? []);
  for (const part of parts) for (const [id, st] of conceptsOf(part)) concepts.set(id, Math.max(concepts.get(id) ?? 0, st));
  for (const [id, st] of concepts) {
    add(`§${id}`, idx.cfg.conceptWeight * st);
    if (st >= 0.8) for (const n of NEIGHBOURS.get(id) ?? []) add(`§${n}`, idx.cfg.neighbourWeight * st);
  }
  const vec: Vec = new Map();
  counts.forEach((c, t) => vec.set(t, tfOf(c, idx.cfg, false) * (idx.idf.get(t) ?? 1)));
  return { vec: l2(vec), terms: [...new Set(raw)], concepts };
}

function cosine(a: Vec, b: Vec): number {
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  let dot = 0; small.forEach((v, k) => { const w = big.get(k); if (w) dot += v * w; });
  return dot;
}

const FIELD_LABEL_SHORT: Record<FieldKey, string> = { genre: 'Genre', traits: 'Trait', title: 'Title', author: 'Author', language: 'Language', verdict: 'Verdict' };

/** Short "why it matched" chips for a document, taken from the query terms it actually shares. */
function explainMatch(doc: TfDoc, q: QueryVec, queryText: string): string[] {
  const reasons: string[] = [];
  const add = (r: string) => { if (r && !reasons.includes(r)) reasons.push(r); };
  const shown = (f: FieldKey): string => (f === 'genre' ? doc.book.genre : f === 'traits' ? doc.book.traits : f === 'language' ? doc.book.language : f === 'author' ? doc.book.author : f === 'title' ? doc.book.title : doc.book.verdict.replace(/_/g, ' '));
  (['genre', 'traits', 'author', 'language', 'title', 'verdict'] as FieldKey[]).forEach((f) => {
    if (q.terms.some((t) => doc.fields[f].has(t))) add(`${FIELD_LABEL_SHORT[f]}: ${shown(f)}`.slice(0, 48));
  });
  for (const [id, st] of q.concepts) {
    if (doc.concepts.has(id)) add(`Genre: ${doc.book.genre || conceptLabel(id)}`.slice(0, 48));
    else if (st >= 0.8) { const near = [...(NEIGHBOURS.get(id) ?? [])].find((n) => doc.concepts.has(n)); if (near) add(`Similar vibe: ${conceptLabel(near)}`); }
  }
  if (!reasons.length && q.terms.some((t) => doc.text.has(t))) add('Mentioned in the review');
  if (norm(queryText).split(' ').length >= 2 && !reasons.length) add('Closest wording');
  return reasons.slice(0, 3);
}

/* ───────────── combined search used by the page ───────────── */

export interface SearchOutcome {
  mode: 'none' | 'direct' | 'description' | 'both';
  direct: Match[];
  related: Match[];
}

export function runSearch(books: SearchBook[], field: SearchField, strictQuery: string, moreText: string): SearchOutcome {
  const hasStrict = !!norm(strictQuery);
  const hasMore = !!norm(moreText);
  if (!hasStrict && !hasMore) return { mode: 'none', direct: [], related: [] };

  const direct = hasStrict ? strictSearch(books, field, strictQuery) : [];
  const exclude = new Set(direct.map((m) => m.book.id));

  if (hasStrict && !hasMore) {
    // Variant views of the same idea: related genres / near words, never repeating the direct hits.
    const seed = field === 'genre' || field === 'traits' ? strictQuery : `${strictQuery}`;
    const related = broadSearch(books, seed, { exclude, minScore: 8 });
    return { mode: 'direct', direct, related };
  }
  if (!hasStrict) return { mode: 'description', direct: [], related: broadSearch(books, moreText) };

  // Both: direct hits first (ordered with the description as a tiebreaker), then wider matches for the description + the first query.
  const moreScores = new Map(broadSearch(books, moreText).map((m) => [m.book.id, m.score]));
  const orderedDirect = [...direct].sort((a, b) => b.score - a.score || (moreScores.get(b.book.id) ?? 0) - (moreScores.get(a.book.id) ?? 0));
  const related = broadSearch(books, `${moreText} ${strictQuery}`, { exclude });
  return { mode: 'both', direct: orderedDirect, related };
}

/** Distinct values that exist in the library for a field (for quick-pick chips). */
export function popularValues(books: SearchBook[], field: SearchField, limit = 6): string[] {
  const counts = new Map<string, { label: string; n: number }>();
  for (const b of books) {
    const raw = field === 'genre' ? b.genre : field === 'language' ? b.language : field === 'traits' ? b.traits : b.author;
    const parts = field === 'traits' || field === 'genre' ? String(raw).split(/[,;/|]+|\.\s+/) : [raw];
    for (const part of parts) {
      const label = String(part ?? '').trim().replace(/\s+/g, ' ');
      const key = norm(label);
      if (!key) continue;
      const cur = counts.get(key);
      counts.set(key, { label: cur?.label ?? label, n: (cur?.n ?? 0) + 1 });
    }
  }
  return [...counts.values()].sort((a, b) => b.n - a.n || a.label.localeCompare(b.label)).slice(0, limit).map((v) => v.label);
}

/* ───────────── "Did you mean" + nearest matches (when a search finds nothing) ───────────── */

/** Library values for the chosen field that look like what was typed (typos, partial words). */
export function didYouMean(books: SearchBook[], field: SearchField, query: string, limit = 3): string[] {
  const q = norm(query);
  if (!q) return [];
  const qTokens = q.split(' ').filter(Boolean);
  const scored: { label: string; s: number }[] = [];
  for (const label of popularValues(books, field, 500)) {
    const v = norm(label);
    if (!v || v === q) continue;
    let best = 0;
    const maxWhole = Math.max(2, Math.round(Math.max(q.length, v.length) * 0.34));
    const d = editDistance(q, v, maxWhole);
    if (d <= maxWhole) best = Math.max(best, 1 - d / (Math.max(q.length, v.length) + 1));
    const vTokens = v.split(' ');
    for (const qt of qTokens) for (const vt of vTokens) { const w = wordSimilarity(qt, vt); if (w >= 0.6) best = Math.max(best, w * 0.8); }
    if (best > 0) scored.push({ label, s: best });
  }
  return scored.sort((a, b) => b.s - a.s || a.label.localeCompare(b.label)).slice(0, limit).map((x) => x.label);
}

/** Closest books to a search that matched nothing; falls back to reader favourites so the box is never a dead end. */
export function nearestBooks(books: SearchBook[], strictQuery: string, moreText: string, limit = 3): { matches: Match[]; fallback: boolean } {
  const near = broadSearch(books, `${strictQuery} ${moreText}`.trim(), { minScore: 0.5 }).slice(0, limit);
  if (near.length) return { matches: near, fallback: false };
  const fav = [...books].sort((a, b) => (b.nl ?? b.rw) - (a.nl ?? a.rw) || b.rw - a.rw).slice(0, limit)
    .map((book): Match => ({ book, score: 0, reasons: [book.nl != null ? `Reader favourite · NL ${book.nl.toFixed(1)}` : `Reviewer favourite · R/W ${book.rw.toFixed(1)}`] }));
  return { matches: fav, fallback: true };
}

/* ───────────── taste match ───────────── */

export interface Mood { id: string; label: string; hint: string; concepts: string[]; words: string[] }
export const MOODS: Mood[] = [
  { id: 'mind', label: 'Mind-bending', hint: 'twists, psychology', concepts: ['psych', 'cogaction', 'scifi'], words: ['mind', 'brain', 'twist', 'psychology', 'psychological', 'unreliable', 'sickness', 'mental'] },
  { id: 'thrill', label: 'Edge-of-seat', hint: 'suspense, crime', concepts: ['suspense', 'crime', 'psych', 'action'], words: ['thriller', 'suspense', 'murder', 'chase', 'crime', 'detective', 'mystery'] },
  { id: 'emotional', label: 'Emotional', hint: 'heart, family, loss', concepts: ['drama', 'romance'], words: ['emotional', 'heartbreak', 'tragedy', 'love', 'grief', 'family', 'loss'] },
  { id: 'romantic', label: 'Romantic', hint: 'love stories', concepts: ['romance', 'romcom', 'darkromance'], words: ['romance', 'love', 'romantic', 'heartbreak'] },
  { id: 'epic', label: 'Epic & adventurous', hint: 'quests, history, myth', concepts: ['adventure', 'fantasy', 'myth', 'historical'], words: ['adventure', 'quest', 'journey', 'war', 'chivalry', 'myth', 'fantasy', 'epic'] },
  { id: 'dark', label: 'Dark & intense', hint: 'gritty, raw', concepts: ['horror', 'darkromance', 'crime', 'psych'], words: ['dark', 'anger', 'violence', 'mafia', 'tragedy', 'revenge', 'boxer'] },
  { id: 'light', label: 'Light & fun', hint: 'easy, funny', concepts: ['romcom'], words: ['comedy', 'funny', 'light', 'humor', 'humour', 'fun', 'cozy'] },
  { id: 'think', label: 'Thought-provoking', hint: 'ideas, society', concepts: ['literary', 'nonfiction', 'dystopian', 'historical'], words: ['philosophy', 'society', 'power', 'politics', 'ideas', 'life', 'reflective'] },
  { id: 'grow', label: 'Inspiring', hint: 'growth, comebacks', concepts: ['selfhelp', 'business', 'memoir'], words: ['hope', 'healing', 'redemption', 'comeback', 'inspiration', 'growth', 'motivation', 'business'] },
];

/** `verdicts`: reviewer verdicts to keep ('perfection' | 'go_for_it' | 'timepass'); empty/undefined = any. Reviews without a verdict are left out while a verdict is chosen. */
export interface TasteInput { moods: string[]; lovedId: string; language: string; verdicts?: string[] }

export function tasteMatch(books: SearchBook[], input: TasteInput, limit = 3): Match[] {
  const moods = input.moods.map((id) => MOODS.find((m) => m.id === id)).filter((m): m is Mood => !!m);
  const loved = books.find((b) => b.id === input.lovedId);
  const verdictSet = new Set((input.verdicts ?? []).map((v) => normalizeVerdict(v)).filter((v): v is NonNullable<ReturnType<typeof normalizeVerdict>> => !!v));
  const verdictOk = (b: SearchBook) => !verdictSet.size || verdictSet.has(normalizeVerdict(b.verdict) as never);
  const verdictReason = (b: SearchBook) => { const v = normalizeVerdict(b.verdict); return v ? `Verdict: ${verdictLabel(v)}` : ''; };
  if (!moods.length && !loved) {
    // Verdict only: no taste to compare, so list the best-rated reviews that carry the chosen verdict.
    if (!verdictSet.size) return [];
    const langOnly = norm(input.language);
    return books
      .filter((b) => verdictOk(b) && (!langOnly || norm(b.language) === langOnly))
      .sort((a, b) => (b.nl ?? b.rw) - (a.nl ?? a.rw) || b.rw - a.rw)
      .slice(0, limit)
      .map((book): Match => ({ book, score: 0, reasons: [verdictReason(book), book.nl != null ? `Reader rating · NL ${book.nl.toFixed(1)}` : `Reviewer rating · R/W ${book.rw.toFixed(1)}`].filter(Boolean) }));
  }
  const idx = getIndex(books);
  const lovedP = loved ? prepare(loved) : null;
  const langKey = norm(input.language);

  // Taste profile = the moods you picked (their words + genre concepts) + the book you loved, as one TF-IDF vector.
  const profile: Vec = new Map();
  const mix = (v: Vec, w: number) => v.forEach((x, k) => profile.set(k, (profile.get(k) ?? 0) + x * w));
  for (const mood of moods) {
    const concepts = new Map<string, number>(mood.concepts.map((c) => [c, 1] as [string, number]));
    mix(queryVector(idx, mood.words.join(' '), concepts).vec, 1);
  }
  if (loved) { const d = idx.docs.find((x) => x.book.id === loved.id); if (d) mix(d.vec, moods.length ? 1.2 : 2); }
  l2(profile);

  const out: { m: Match; key: number }[] = [];
  for (const doc of idx.docs) {
    const book = doc.book;
    if (loved && book.id === loved.id) continue;
    if (langKey && norm(book.language) !== langKey) continue;
    if (!verdictOk(book)) continue;
    const pct = cosine(profile, doc.vec) * 100;
    if (pct < 4) continue;
    const p = prepare(book);
    const reasons: string[] = [];
    const add = (r: string) => { if (!reasons.includes(r)) reasons.push(r); };
    for (const mood of moods) {
      const hit = mood.concepts.some((c) => p.concepts.has(c) || [...(NEIGHBOURS.get(c) ?? [])].some((n) => p.concepts.has(n)))
        || mood.words.some((w) => [...p.genre, ...p.traits, ...p.title].some((x) => wordSimilarity(w, x) >= 0.7));
      if (hit) add(`Fits your ${mood.label.toLowerCase()} mood${book.genre ? ` (${book.genre})` : ''}`);
    }
    if (loved && lovedP) {
      if ([...lovedP.concepts.keys()].some((c) => p.concepts.has(c))) add(`Same kind of read as ${loved.title}`);
      else if ([...lovedP.concepts.keys()].some((c) => [...(NEIGHBOURS.get(c) ?? [])].some((n) => p.concepts.has(n)))) add(`Close to ${loved.title}`);
      const sharedTraits = lovedP.traits.filter((t) => t.length > 3 && p.traits.includes(t));
      if (sharedTraits.length) add(`Shares: ${[...new Set(sharedTraits)].slice(0, 2).join(', ')}`);
      if (norm(book.author) && norm(book.author) === norm(loved.author)) add(`More from ${book.author}`);
    }
    if (verdictSet.size) add(verdictReason(book));
    if (book.nl != null && book.nl >= 8) add(`Reader favourite · NL ${book.nl.toFixed(1)}`);
    if (!reasons.length) add('Closest to your taste profile');
    // Ranked by similarity; ratings only break near-ties, so a poor match is never rescued by a rating.
    const key = pct + (book.nl != null ? (book.nl / 10) * 2 : 0) + (book.verdict === 'perfection' ? 1 : 0);
    out.push({ m: { book, score: Math.round(pct * 10) / 10, reasons: reasons.slice(0, 3) }, key });
  }
  return out.sort((a, b) => b.key - a.key).slice(0, limit).map((x) => x.m);
}

/* ───────────── "More like this" ───────────── */

/** Reviews closest to one review, by cosine similarity of their TF-IDF vectors (never returns the review itself). */
export function similarBooks(books: SearchBook[], id: string, limit = 3, minPct = 12): Match[] {
  const idx = getIndex(books);
  const target = idx.docs.find((d) => d.book.id === id);
  if (!target) return [];
  const out: Match[] = [];
  for (const doc of idx.docs) {
    if (doc.book.id === id) continue;
    const pct = cosine(target.vec, doc.vec) * 100;
    if (pct < minPct) continue;
    const reasons: string[] = [];
    const add = (r: string) => { if (r && !reasons.includes(r)) reasons.push(r.slice(0, 48)); };
    if (norm(doc.book.genre) && [...doc.fields.genre].some((t) => target.fields.genre.has(t) && !t.includes(' '))) add(`Genre: ${doc.book.genre}`);
    if ([...doc.fields.traits].some((t) => target.fields.traits.has(t) && !t.includes(' ') && t.length > 3)) add(`Shared trait: ${[...doc.fields.traits].filter((t) => target.fields.traits.has(t) && !t.includes(' ') && t.length > 3)[0]}`);
    if (norm(doc.book.author) && norm(doc.book.author) === norm(target.book.author)) add(`Same author: ${doc.book.author}`);
    if (norm(doc.book.language) && norm(doc.book.language) === norm(target.book.language) && reasons.length < 2) add(`${doc.book.language}`);
    if (!reasons.length) for (const [cid] of target.concepts) { const near = doc.concepts.has(cid) ? cid : [...(NEIGHBOURS.get(cid) ?? [])].find((n) => doc.concepts.has(n)); if (near) { add(`Similar vibe: ${conceptLabel(near)}`); break; } }
    out.push({ book: doc.book, score: Math.round(pct * 10) / 10, reasons: reasons.slice(0, 3) });
  }
  return out.sort((a, b) => b.score - a.score || (b.book.nl ?? -1) - (a.book.nl ?? -1) || b.book.rw - a.book.rw).slice(0, limit);
}


/* ───────────── admin Taste Match lab ───────────── */

export interface LabTerm { term: string; /** query weight × review weight, i.e. this term's share of the cosine. */ share: number }
export interface LabResult { book: SearchBook; /** cosine similarity, 0–100 */ score: number; terms: LabTerm[] }
export interface LabOutput { queryTerms: { term: string; weight: number }[]; results: LabResult[]; vocabularySize: number; reviews: number }

const prettyTerm = (t: string): string => (t.startsWith('§') ? `[${conceptLabel(t.slice(1))}]` : t);

/**
 * Runs the real engine with any settings and shows its working: the query's strongest terms, and for every review the
 * terms that contributed most to its cosine score. Builds its own index, so the live site is never affected.
 */
export function labSearch(books: SearchBook[], text: string, cfg: TfConfig, minScore = 1, limit = 10): LabOutput {
  const idx = buildIndex(books, cfg);
  const empty: LabOutput = { queryTerms: [], results: [], vocabularySize: idx.idf.size, reviews: books.length };
  if (!norm(text) || !books.length) return empty;
  const q = queryVector(idx, text);
  if (!q.vec.size) return empty;
  const results: LabResult[] = [];
  for (const doc of idx.docs) {
    const parts: LabTerm[] = [];
    let dot = 0;
    q.vec.forEach((qw, t) => { const dw = doc.vec.get(t); if (dw) { const c = qw * dw; dot += c; parts.push({ term: prettyTerm(t), share: c }); } });
    const pct = dot * 100;
    if (pct >= minScore) results.push({ book: doc.book, score: Math.round(pct * 10) / 10, terms: parts.sort((a, b) => b.share - a.share).slice(0, 6).map((p) => ({ ...p, share: Math.round(p.share * 1000) / 10 })) });
  }
  results.sort((a, b) => b.score - a.score);
  const queryTerms = [...q.vec.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([term, weight]) => ({ term: prettyTerm(term), weight: Math.round(weight * 1000) / 1000 }));
  return { queryTerms, results: results.slice(0, limit), vocabularySize: idx.idf.size, reviews: books.length };
}
