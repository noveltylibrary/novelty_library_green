import { cleanTraits } from '@/lib/rankingSearch';
import { HANG_SEEDS, type HangSeed } from '@/lib/enigma/hangFallback';
import { hashKey, lastSeen, seenMap } from '@/lib/enigma/seenStore';
import { openLibraryBySubject, type OlBook } from '@/lib/enigma/sources';
import { conceptIds, vectorOf, cosine } from '@/lib/enigma/taste';
import type { Signals } from '@/lib/enigma/signals';

export interface HangPuzzle {
  kind: 'book' | 'author';
  /** What the reader must spell out (upper case; spaces and punctuation are shown for free). */
  answer: string;
  /** Revealed at the end. */
  by: string;
  /** The single clue: a specific trope, harder than naming the author. */
  trope: string;
  source: 'popular' | 'library' | 'open-library';
  concepts: string[];
}

const MAX_LETTERS = 26;
/** Open Library subjects tried once the built-in puzzles have all been served. */
const EXTRA_SUBJECTS = ['fantasy', 'mystery', 'romance', 'science fiction', 'historical fiction', 'thriller', 'classic literature', 'horror', 'adventure', 'dystopia', 'war', 'family saga', 'coming of age', 'detective', 'magic', 'gothic', 'humor', 'crime', 'space opera', 'young adult'];
const plain = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '');
const lettersOnly = (s: string) => plain(s).toLowerCase().replace(/[^a-z]/g, '');
/** Only Latin letters, spaces and light punctuation make a fair puzzle. */
const spellable = (s: string) => /^[A-Za-z0-9 '’.,&:!?-]+$/.test(plain(s)) && lettersOnly(s).length >= 4 && lettersOnly(s).length <= MAX_LETTERS;
const keyOf = (kind: string, answer: string) => `${kind}:${lettersOnly(answer)}`;

const timeout = <T,>(p: Promise<T>, ms: number, fallback: T): Promise<T> => new Promise((res) => { const t = window.setTimeout(() => res(fallback), ms); p.then((v) => { window.clearTimeout(t); res(v); }, () => { window.clearTimeout(t); res(fallback); }); });

const clean = (answer: string) => plain(answer).replace(/’/g, "'").replace(/\s+/g, ' ').trim().toUpperCase();

/* ---------- Open Library: subjects that read like tropes ---------- */
const TROPEY = /(enemies|lovers|chosen|revenge|quest|secret|twin|orphan|heist|detective|murder|haunt|ghost|vampire|witch|dragon|magic|time travel|amnesia|prophecy|rebellion|survival|friendship|betrayal|forbidden|coming of age|found family|second chance|locked|mistaken|undercover|apocalypse|post-apocalyptic|dystop|cult|curse|disguise|inheritance|journey|war|coup|spy|space|alien|robot|mythology|fairy|school|boarding|small town|love triangle|redemption|prison|escape|kidnap|missing|abandoned|island|desert)/i;
const NOISE = /(fiction|accessible|protected|daisy|large type|large print|open library|reading level|nyt|new york times|bestseller|best seller|english language|juvenile|literature|romans|novels|translations|ficción|series|stories|history$|biograph|spanish|french|german|in fiction$|^[a-z]+ \(|^\d)/i;
function tropeFrom(subjects: string[], avoid: string): string | null {
  const bad = new Set(lettersOnly(avoid).length ? plain(avoid).toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3) : []);
  const ok = subjects
    .map((s) => s.trim())
    .filter((s) => s.length >= 5 && s.length <= 42 && !NOISE.test(s) && !plain(s).toLowerCase().split(/[^a-z]+/).some((w) => bad.has(w)));
  const tropes = ok.filter((s) => TROPEY.test(s));
  const best = tropes[0];
  return best ? best.charAt(0).toUpperCase() + best.slice(1) : null;
}

function fromOpenLibrary(b: OlBook): HangPuzzle | null {
  const title = b.title.split(/[:(]/)[0].trim();
  if (!spellable(title) || b.editions < 20) return null; // only books people actually know
  const trope = tropeFrom(b.subjects, `${title} ${b.author}`);
  if (!trope) return null;
  return { kind: 'book', answer: clean(title), by: b.author, trope, source: 'open-library', concepts: conceptIds(`${trope} ${b.subjects.join(' ')}`) };
}

function fromSeed(s: HangSeed): HangPuzzle {
  return { kind: s.kind === 'b' ? 'book' : 'author', answer: clean(s.answer), by: s.by ?? '', trope: s.trope, source: 'popular', concepts: conceptIds(s.tags) };
}

/** The community's own books: a reviewer-written trait is the clue. */
function fromCatalogue(s: Signals): HangPuzzle[] {
  const out: HangPuzzle[] = [];
  for (const b of s.catalogue) {
    const title = b.title.split(/[:(]/)[0].trim();
    if (!spellable(title)) continue;
    const traits = cleanTraits(b.traits).split(/[,;/|]+/).map((t) => t.trim()).filter((t) => t.length >= 6 && t.length <= 40 && !plain(t).toLowerCase().split(/[^a-z]+/).some((w) => w.length > 3 && lettersOnly(title).includes(w)));
    if (!traits.length) continue;
    const trope = traits[Math.floor(Math.random() * traits.length)];
    out.push({ kind: 'book', answer: clean(title), by: b.author, trope: trope.charAt(0).toUpperCase() + trope.slice(1), source: 'library', concepts: conceptIds(`${b.genre} ${b.traits}`) });
  }
  return out;
}

/**
 * Choose the next HangLex puzzle. Taste Match SE turns the reader's taste into a search (a subject sent to Open Library)
 * and ranks popular built-in puzzles and the library's own books against the same taste; most rounds are well-known titles
 * and authors, some come fresh from Open Library. A puzzle the reader has already seen is never offered again.
 */
export async function pickHangPuzzle(s: Signals): Promise<HangPuzzle> {
  const seen = seenMap(s.readerKey, 'hang');
  const fresh = (p: HangPuzzle) => !seen.has(hashKey(keyOf(p.kind, p.answer)));
  const taste = (p: HangPuzzle) => cosine(s.taste, vectorOf(`${p.trope} ${p.answer} ${p.concepts.join(' ')}`));

  const wantLive = s.cruising ? Math.random() < 0.55 : s.struggling ? Math.random() < 0.15 : Math.random() < 0.35;
  let live: HangPuzzle[] = [];
  if (wantLive) {
    const subject = s.subjects[Math.floor(Math.random() * Math.min(3, s.subjects.length))] ?? 'fantasy';
    const books = await timeout(openLibraryBySubject(subject, 40), 3000, [] as OlBook[]);
    live = books.map(fromOpenLibrary).filter((p): p is HangPuzzle => !!p && fresh(p));
  }

  const seeds = HANG_SEEDS.map(fromSeed).filter(fresh);
  const library = fromCatalogue(s).filter(fresh);
  const weighted: [HangPuzzle, number][] = [
    ...seeds.map((p) => [p, (s.struggling ? 1.4 : 1) * (1 + taste(p) * 5)] as [HangPuzzle, number]),
    ...library.map((p) => [p, 0.55 * (1 + taste(p) * 5)] as [HangPuzzle, number]),
    ...live.map((p) => [p, (wantLive ? 2.4 : 0.8) * (1 + taste(p) * 5)] as [HangPuzzle, number]),
  ];
  const total = weighted.reduce((n, [, w]) => n + w, 0);
  if (total > 0) {
    let r = Math.random() * total;
    for (const [p, w] of weighted) { r -= w; if (r <= 0) return p; }
    return weighted[weighted.length - 1][0];
  }

  // The built-in puzzles are used up for this reader: keep asking Open Library about other subjects until something unseen turns up.
  const more = [...s.subjects, ...EXTRA_SUBJECTS.filter((x) => !s.subjects.includes(x))].slice(0, 14);
  for (const subject of more.sort(() => Math.random() - 0.5)) {
    const books = await timeout(openLibraryBySubject(subject, 60), 3000, [] as OlBook[]);
    const found = books.map(fromOpenLibrary).filter((p): p is HangPuzzle => !!p && fresh(p));
    if (found.length) return found[Math.floor(Math.random() * found.length)];
  }

  // Nothing unseen could be reached (offline, or the reader has seen everything): replay the one seen longest ago.
  const history = lastSeen(s.readerKey, 'hang');
  return HANG_SEEDS.map(fromSeed).sort((a, b) => (history.get(hashKey(keyOf(a.kind, a.answer))) ?? 0) - (history.get(hashKey(keyOf(b.kind, b.answer))) ?? 0))[0];
}

export const hangKey = (p: HangPuzzle) => keyOf(p.kind, p.answer);
