/**
 * Live Rankings search + basic taste match. Everything runs in the browser over the already-loaded published
 * reviews (no database access, no schema), so it is safe for the AdSense crawler and cheap to run.
 *
 * Two kinds of matching:
 *  - strictSearch: one chosen field (genre / language / traits / author) + a short query. Exact word first, then
 *    known equivalents ("psychological suspense thriller" = "psychological thriller"), then partial / typo matches.
 *  - broadSearch: free text matched across title, author, genre, traits, language, verdict and review text, with
 *    typo tolerance and "related genre" expansion, so it returns more variants.
 * All comparisons ignore capitals, accents, punctuation and extra spaces.
 */

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
  /** Minimum score; related-only searches use a lower bar. */
  minScore?: number;
}

/** Wide search: any words, any field, typo tolerant, and related genres count too. */
export function broadSearch(books: SearchBook[], text: string, opts: BroadOptions = {}): Match[] {
  const qNorm = norm(text);
  const tokens = qNorm.split(' ').filter((t) => t && !STOP.has(t));
  if (!tokens.length) return [];
  const bigrams = tokens.slice(0, -1).map((t, i) => `${t} ${tokens[i + 1]}`);
  const qConcepts = new Map<string, number>();
  for (const part of [...bigrams, ...tokens, qNorm]) for (const [id, s] of conceptsOf(part)) qConcepts.set(id, Math.max(qConcepts.get(id) ?? 0, s));
  const min = opts.minScore ?? 2;
  const out: Match[] = [];

  for (const book of books) {
    if (opts.exclude?.has(book.id)) continue;
    const p = prepare(book);
    let score = 0;
    const reasons: string[] = [];
    const addReason = (r: string) => { if (!reasons.includes(r)) reasons.push(r); };

    for (const token of tokens) {
      let bestWeighted = 0; let bestReason = '';
      (['genre', 'traits', 'title', 'author', 'language', 'verdict'] as const).forEach((f) => {
        const { sim, word } = bestSimilarity(token, p[f]);
        const weighted = sim * FIELD_WEIGHT[f];
        if (weighted > bestWeighted) {
          bestWeighted = weighted;
          const shown = f === 'genre' ? book.genre : f === 'traits' ? book.traits : f === 'language' ? book.language : f === 'author' ? book.author : f === 'title' ? book.title : word;
          bestReason = `${REASON_FIELD[f]}: ${shown}`;
        }
      });
      if (p.text.has(token) && FIELD_WEIGHT.text > bestWeighted) { bestWeighted = FIELD_WEIGHT.text; bestReason = 'Mentioned in the review'; }
      if (bestWeighted > 0) { score += bestWeighted; if (bestWeighted >= 1.5) addReason(bestReason); }
    }

    if (tokens.length >= 2 && hasPhrase(p.textNorm, qNorm)) { score += 3; addReason(`Phrase: ${text.trim().slice(0, 40)}`); }

    for (const [id, strength] of qConcepts) {
      const own = p.concepts.get(id);
      if (own) { score += 4 * strength * own; addReason(`${p.genre.length && norm(book.genre) ? 'Genre' : 'Theme'}: ${book.genre || conceptLabel(id)}`); continue; }
      if (strength < 0.8) continue;
      const near = [...(NEIGHBOURS.get(id) ?? [])].find((n) => p.concepts.has(n));
      if (near) { score += 2 * strength; addReason(`Similar vibe: ${conceptLabel(near)}`); }
    }

    if (score >= min) out.push({ book, score, reasons: reasons.slice(0, 3) });
  }
  return out.sort((a, b) => b.score - a.score || (b.book.nl ?? -1) - (a.book.nl ?? -1) || b.book.rw - a.book.rw);
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
    const related = broadSearch(books, seed, { exclude, minScore: 4 });
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

/* ───────────── basic taste match ───────────── */

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

export interface TasteInput { moods: string[]; lovedId: string; language: string }

export function tasteMatch(books: SearchBook[], input: TasteInput, limit = 3): Match[] {
  const moods = input.moods.map((id) => MOODS.find((m) => m.id === id)).filter((m): m is Mood => !!m);
  const loved = books.find((b) => b.id === input.lovedId);
  if (!moods.length && !loved) return [];
  const lovedP = loved ? prepare(loved) : null;
  const langKey = norm(input.language);
  const out: Match[] = [];

  for (const book of books) {
    if (loved && book.id === loved.id) continue;
    if (langKey && norm(book.language) !== langKey) continue;
    const p = prepare(book);
    let score = 0;
    const reasons: string[] = [];
    const add = (r: string) => { if (!reasons.includes(r)) reasons.push(r); };

    for (const mood of moods) {
      let m = 0;
      for (const c of mood.concepts) { if (p.concepts.has(c)) m += 3 * (p.concepts.get(c) ?? 1); else if ([...(NEIGHBOURS.get(c) ?? [])].some((n) => p.concepts.has(n))) m += 1; }
      const pool = [...p.genre, ...p.traits, ...p.title];
      const hits = mood.words.filter((w) => pool.some((x) => wordSimilarity(w, x) >= 0.7));
      m += Math.min(hits.length, 3) * 1.5;
      if (m > 0) { score += m; add(`Fits your ${mood.label.toLowerCase()} mood${book.genre ? ` (${book.genre})` : ''}`); }
    }

    if (loved && lovedP) {
      let s = 0;
      const shared = [...lovedP.concepts.keys()].filter((c) => p.concepts.has(c));
      if (shared.length) { s += 3; add(`Same kind of read as ${loved.title}`); }
      else if ([...lovedP.concepts.keys()].some((c) => [...(NEIGHBOURS.get(c) ?? [])].some((n) => p.concepts.has(n)))) { s += 1; add(`Close to ${loved.title}`); }
      const sharedTraits = lovedP.traits.filter((t) => t.length > 3 && p.traits.includes(t));
      if (sharedTraits.length) { s += Math.min(sharedTraits.length, 2) * 1.5; add(`Shares: ${[...new Set(sharedTraits)].slice(0, 2).join(', ')}`); }
      if (norm(book.author) && norm(book.author) === norm(loved.author)) { s += 2; add(`More from ${book.author}`); }
      score += s;
    }

    if (score <= 0) continue;
    // Quality nudge: well-rated books win ties, but a poor match is never rescued by a rating.
    if (book.nl != null) { score += (book.nl / 10) * 1.5; if (book.nl >= 8) add(`Reader favourite · NL ${book.nl.toFixed(1)}`); }
    if (book.verdict === 'perfection') score += 1;
    out.push({ book, score, reasons: reasons.slice(0, 3) });
  }
  return out.sort((a, b) => b.score - a.score || (b.book.nl ?? -1) - (a.book.nl ?? -1)).slice(0, limit);
}
