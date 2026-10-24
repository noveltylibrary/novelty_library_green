import { lookupOpenLibraryBook, type OpenLibraryBookMetadata } from '@/lib/readerTools';

/**
 * Checks a typed title (and author) against Open Library and says how well they agree.
 * Never changes anything by itself: the submit form shows the result and the reviewer decides.
 */
export type BookCheckStatus = 'idle' | 'checking' | 'verified' | 'suggest' | 'unknown' | 'offline';
export interface BookCheck {
  status: BookCheckStatus;
  best: OpenLibraryBookMetadata | null;
  /** The credited author that best matches what was typed (falls back to the first credited author). */
  bestAuthor: string;
  titleDiffers: boolean;
  authorDiffers: boolean;
}
export const IDLE_CHECK: BookCheck = { status: 'idle', best: null, bestAuthor: '', titleDiffers: false, authorDiffers: false };

const plain = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
const words = (s: string) => plain(s).replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
const titleKey = (s: string) => words(s.split(/[:(]/)[0]).filter((w, i) => !(i === 0 && (w === 'the' || w === 'a' || w === 'an'))).join(' ');

/** 0..1 similarity of two strings by edit distance. */
function ratio(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const m = a.length; const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return 1 - prev[n] / Math.max(m, n);
}

const titleSim = (typed: string, found: string) => ratio(titleKey(typed), titleKey(found));

/** Names match when the surname agrees and any first name or initial does not contradict it ("Sarah J Maas" = "Sarah J. Maas" = "Maas, Sarah"). */
function authorSim(typed: string, found: string): number {
  const flip = (s: string) => (s.includes(',') ? s.split(',').reverse().join(' ') : s);
  const a = words(flip(typed)); const b = words(flip(found));
  if (!a.length || !b.length) return 0;
  const surnameA = a[a.length - 1]; const surnameB = b[b.length - 1];
  const surname = ratio(surnameA, surnameB);
  if (surname < 0.75) return Math.min(0.5, ratio(a.join(' '), b.join(' ')));
  const firstA = a[0]; const firstB = b[0];
  const first = a.length === 1 || b.length === 1 ? 1 : firstA[0] === firstB[0] ? (firstA.length === 1 || firstB.length === 1 ? 1 : ratio(firstA, firstB)) : 0.3;
  return 0.55 * surname + 0.45 * first;
}

function bestAuthorOf(typed: string, book: OpenLibraryBookMetadata): { name: string; sim: number } {
  const names = book.authors.length ? book.authors : [book.author];
  let best = { name: book.author, sim: 0 };
  for (const n of names) { const sim = typed.trim() ? authorSim(typed, n) : 0; if (sim >= best.sim) best = { name: n, sim }; }
  return best;
}

export function judgeBook(title: string, author: string, docs: OpenLibraryBookMetadata[]): BookCheck {
  const typedAuthor = author.trim();
  let top: { book: OpenLibraryBookMetadata; score: number; t: number; a: { name: string; sim: number } } | null = null;
  for (const book of docs) {
    const t = titleSim(title, book.title);
    const a = bestAuthorOf(typedAuthor, book);
    const score = t * (typedAuthor ? 0.65 : 1) + (typedAuthor ? a.sim * 0.35 : 0) + (book.coverUrl ? 0.02 : 0) + (book.publishYear ? 0.01 : 0);
    if (!top || score > top.score) top = { book, score, t, a };
  }
  if (!top || top.t < 0.6) return { ...IDLE_CHECK, status: 'unknown' };
  const titleDiffers = top.t < 0.999;
  const authorDiffers = !!typedAuthor && top.a.sim < 0.95;
  if (typedAuthor && top.a.sim < 0.5 && top.t < 0.999) return { ...IDLE_CHECK, status: 'unknown' };
  const bestAuthor = top.a.name || top.book.author;
  return { status: titleDiffers || authorDiffers ? 'suggest' : 'verified', best: top.book, bestAuthor, titleDiffers, authorDiffers };
}

/** Look the book up and judge it. Resolves to `offline` when Open Library cannot be reached. */
export async function checkBook(title: string, author: string, signal?: AbortSignal): Promise<BookCheck> {
  try {
    let docs = await lookupOpenLibraryBook(title, signal, author);
    // A misspelt author hides a right title: retry on the title alone.
    if (!docs.length && author.trim()) docs = await lookupOpenLibraryBook(title, signal);
    return judgeBook(title, author, docs);
  } catch (e) {
    if (signal?.aborted) throw e;
    return { ...IDLE_CHECK, status: 'offline' };
  }
}

/**
 * Pasted/imported reviews often open with the book's name: "Title by Author", "Review of Title by Author",
 * "Title: …" / "Author: …" lines. Only these explicit shapes are read; anything else is left alone.
 */
export function guessBookFromText(text: string): { title?: string; author?: string } {
  const head = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 6);
  const out: { title?: string; author?: string } = {};
  for (const line of head) {
    const t = /^(?:book\s+)?title\s*[:\-–]\s*(.{2,150})$/i.exec(line);
    const a = /^(?:book\s+)?author\s*[:\-–]\s*(.{2,100})$/i.exec(line);
    if (t && !out.title) out.title = t[1].replace(/^["“”']|["“”']$/g, '').trim();
    if (a && !out.author) out.author = a[1].trim();
  }
  if (!out.title) {
    const m = /^(?:(?:[Aa]\s+)?(?:[Bb]ook\s+)?[Rr]eview\s*(?:of|:)\s*|[Rr]eviewing\s+)?["“‘']?([^"“”\n]{2,120}?)["”’']?\s+by\s+([A-Z][\p{L}.'’-]+(?:\s+[A-Z][\p{L}.'’-]+){0,3})\s*[.:!]?$/u.exec(head[0] ?? '');
    if (m && head[0].length <= 160) { out.title = m[1].trim(); out.author = out.author ?? m[2].trim(); }
  }
  return out;
}
