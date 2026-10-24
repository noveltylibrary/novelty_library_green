/**
 * Review Helper · Taste Match: "Polish" for review text.
 *
 * A careful, local, rule-based proofreader. It runs only when the reviewer presses the button and changes mechanics only:
 * spelling slips, apostrophes, capitals, spacing, punctuation, a/an and a few comma habits. It never rewrites sentences,
 * never swaps words for "better" ones and never touches the reviewer's opinions, slang, ALL-CAPS emphasis, links or emoticons.
 * Longer-range advice (very long sentences, same opener over and over) is returned as hints and left for the reviewer.
 */
import { correctWords, fixGrammar, loadDict, type Dict } from '@/lib/reviewSpell';

export interface PolishResult {
  text: string;
  /** What was fixed, e.g. "Fixed 3 spelling slips". */
  changes: string[];
  /** Suggestions the reviewer may act on; the text is not altered for these. */
  hints: string[];
}

/* ---------- protected spans: kept exactly as written ---------- */
const PROTECT = /(https?:\/\/\S+|www\.\S+|\b[\w.+-]+@[\w-]+\.[\w.-]+\b|(?<![\w])[@#][\w]+|`[^`\n]*`|(?<=^|\s)[:;=]-?[)(DdPpOo/|\\*]+(?=\s|$)|\b[A-Z]{2,}[A-Z0-9]*\b)/gm;

function shield(text: string): { text: string; restore: (s: string) => string } {
  const kept: string[] = [];
  const out = text.replace(PROTECT, (m) => { kept.push(m); return `\u0001${kept.length - 1}\u0002`; });
  return { text: out, restore: (s) => s.replace(/\u0001(\d+)\u0002/g, (_m, i: string) => kept[Number(i)] ?? '') };
}

/** Keeps the capital letters the reviewer used: "Dont" -> "Don't", "dont" -> "don't". */
const matchCase = (from: string, to: string) => (from[0] === from[0].toUpperCase() && from[0] !== from[0].toLowerCase() ? to[0].toUpperCase() + to.slice(1) : to);

/* ---------- word fixes ---------- */
const CONTRACTIONS: Record<string, string> = {
  dont: "don't", doesnt: "doesn't", didnt: "didn't", isnt: "isn't", arent: "aren't", wasnt: "wasn't", werent: "weren't",
  hasnt: "hasn't", havent: "haven't", hadnt: "hadn't", wouldnt: "wouldn't", couldnt: "couldn't", shouldnt: "shouldn't", cant: "can't",
  wont: "won't", mustnt: "mustn't", im: "I'm", ive: "I've", youre: "you're", theyre: "they're", weve: "we've", youve: "you've", theyve: "they've",
  thats: "that's", whats: "what's", theres: "there's", heres: "here's", whos: "who's",
};
const SPELLING: Record<string, string> = {
  teh: 'the', adn: 'and', taht: 'that', wich: 'which', becuase: 'because', beacuse: 'because', becasue: 'because', definately: 'definitely', definatly: 'definitely',
  defintely: 'definitely', seperate: 'separate', seperately: 'separately', recieve: 'receive', recieved: 'received', occured: 'occurred', occurence: 'occurrence',
  untill: 'until', alot: 'a lot', thier: 'their', wierd: 'weird', accomodate: 'accommodate', beleive: 'believe', beleived: 'believed', begining: 'beginning',
  charecter: 'character', charecters: 'characters', charactor: 'character', intresting: 'interesting', interseting: 'interesting', freind: 'friend', freinds: 'friends',
  realy: 'really', truely: 'truly', writting: 'writing', buisness: 'business', publically: 'publicly', enviroment: 'environment', goverment: 'government',
  sucess: 'success', sucessful: 'successful', succesful: 'successful', dissapointed: 'disappointed', dissapointing: 'disappointing', dissapoint: 'disappoint',
  suprise: 'surprise', suprised: 'surprised', suprising: 'surprising', embarass: 'embarrass', embarassing: 'embarrassing', commited: 'committed',
  excellant: 'excellent', plesant: 'pleasant', neccessary: 'necessary', necesary: 'necessary', tommorow: 'tomorrow', tomorow: 'tomorrow', noticable: 'noticeable',
  reccomend: 'recommend', recomend: 'recommend', reccommend: 'recommend', reccomended: 'recommended', recomended: 'recommended', existance: 'existence',
  grammer: 'grammar', occassion: 'occasion', persue: 'pursue', rythm: 'rhythm', rhythem: 'rhythm', sentance: 'sentence', paragragh: 'paragraph', protagonst: 'protagonist',
  antagonst: 'antagonist', climex: 'climax', predicable: 'predictable', atmosphear: 'atmosphere', thouroughly: 'thoroughly', throughly: 'thoroughly',
};
/** Doubled words that are often deliberate ("had had", "that that", emphatic "very very") stay. */
const KEEP_DOUBLE = new Set(['had', 'that', 'very', 'so', 'really', 'no', 'ha', 'bye', 'yeah', 'well', 'more', 'much', 'go', 'now', 'oh', 'ah', 'never', 'long', 'far']);
const INTRO_WORDS = 'However|Therefore|Moreover|Furthermore|Overall|Honestly|Personally|Ultimately|Meanwhile|Unfortunately|Fortunately|Surprisingly|Nevertheless|Frankly|Admittedly|Thankfully|Sadly';
const SUBJECTS = 'I|it|the|this|that|these|those|we|you|he|she|they|there|my|our|his|her|their|its|a|an|one|some|most|all|everything|nothing|anyone|everyone';
const U_AS_CONSONANT = /^(uni|use|usu|uti|ura|uro|ubi|uk\b|ufo|euro|eul|ewe|one\b|once\b)/i;
const SILENT_H = /^(hour|honest|honou?r|heir|hono)/i;
/** "nothing but the truth", "all but the last": no comma. */
const NO_COMMA_BEFORE_BUT = new Set(['nothing', 'anything', 'everything', 'all', 'none', 'nobody', 'anyone', 'everyone', 'last', 'next', 'only', 'help', 'cannot', 'one', 'not']);
const ABBREVIATIONS = new Set(['e.g', 'i.e', 'vs', 'etc', 'cf', 'approx', 'mr', 'mrs', 'ms', 'dr', 'st', 'no', 'vol', 'ch', 'fig', 'pp', 'p']);

type Counter = Map<string, number>;
const bump = (c: Counter, label: string, n = 1) => { if (n > 0) c.set(label, (c.get(label) ?? 0) + n); };
/** Replace and count the replacements that actually change the text. */
function sub(text: string, re: RegExp, fn: (...m: string[]) => string, c: Counter, label: string): string {
  let n = 0;
  const out = text.replace(re, (...args) => {
    const m = args.slice(0, -2) as string[]; // drop offset + whole string
    const r = fn(...m);
    if (r !== m[0]) n += 1;
    return r;
  });
  bump(c, label, n);
  return out;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function polishReview(input: string, dict?: Dict): PolishResult {
  const counts: Counter = new Map();
  const original = input.replace(/\r\n?/g, '\n');
  const sh = shield(original);
  let t = sh.text;

  // --- spacing ---
  t = sub(t, /[ \t]+$/gm, () => '', counts, 'spacing');
  t = sub(t, /(\S)[ \t]{2,}(?=\S)/g, (_m, a) => `${a} `, counts, 'spacing');
  t = sub(t, /\n{3,}/g, () => '\n\n', counts, 'spacing');

  // --- apostrophes and spelling (whole words, case kept) ---
  t = sub(t, /\b([A-Za-z]{2,})\b/g, (m) => {
    const low = m.toLowerCase();
    if (!(low in CONTRACTIONS)) return m;
    return low === 'im' || low === 'ive' ? CONTRACTIONS[low] : matchCase(m, CONTRACTIONS[low]);
  }, counts, 'apostrophes');
  t = sub(t, /\b([A-Za-z]{3,})\b/g, (m) => {
    const low = m.toLowerCase();
    if (!(low in SPELLING)) return m;
    return matchCase(m, SPELLING[low]);
  }, counts, 'spelling');
  t = sub(t, /\bi(?=['’](?:m|ve|ll|d)\b)/g, () => 'I', counts, 'capitals');
  t = sub(t, /(^|[^\w'’-])i(?![\w'’-])/g, (_m, a) => `${a}I`, counts, 'capitals');

  // --- deeper pass (only when the word list is loaded): half-typed / misspelt words and safe grammar slips ---
  let unsure: string[] = [];
  const spelled: Array<[string, string]> = [];
  if (dict) {
    const sp = correctWords(t, dict);
    t = sp.text; unsure = sp.unsure; spelled.push(...sp.fixed);
    bump(counts, 'spelling', sp.fixed.length);
    const g = fixGrammar(t);
    t = g.text; bump(counts, 'grammar', g.count);
  }

  // --- repeated words ---
  t = sub(t, /\b([A-Za-z]{2,8})(\s+)\1\b(?!['’-])/gi, (m, w) => (KEEP_DOUBLE.has(w.toLowerCase()) ? m : w), counts, 'repeats');

  // --- a / an ---
  t = t.replace(/\b([Aa]n?)(\s+)([A-Za-z]+)/g, (m, art: string, sp: string, next: string) => {
    const vowelLike = /^[aeiou]/i.test(next) && !U_AS_CONSONANT.test(next) || SILENT_H.test(next);
    const wantAn = vowelLike;
    const isAn = art.toLowerCase() === 'an';
    if (wantAn === isAn) return m;
    // "a" -> "an" only before clear vowel sounds; "an" -> "a" only before consonant sounds
    const fixed = wantAn ? (art === 'A' ? 'An' : 'an') : (art === 'An' ? 'A' : 'a');
    counts.set('articles', (counts.get('articles') ?? 0) + 1);
    return `${fixed}${sp}${next}`;
  });

  // --- punctuation ---
  t = sub(t, /(?<=[^\s.])[ \t]+([,;:!?])(?!\u0001)/g, (_m, p) => p, counts, 'punctuation');
  t = sub(t, /(?<=[A-Za-z0-9'’")\]])[ \t]+\.(?=[A-Za-z])/g, () => '. ', counts, 'punctuation');
  t = sub(t, /(?<=[A-Za-z0-9'’")\]])[ \t]+\.(?!\.)/g, () => '.', counts, 'punctuation');
  t = sub(t, /,{2,}/g, () => ',', counts, 'punctuation');
  t = sub(t, /([!?])\1{2,}/g, (_m, p) => `${p}${p}`, counts, 'punctuation');
  t = sub(t, /\.{4,}/g, () => '...', counts, 'punctuation');
  t = sub(t, /([a-z])\.([A-Z][a-z])/g, (_m, a, b) => `${a}. ${b}`, counts, 'punctuation');
  t = sub(t, /([a-z0-9"”’')])([!?])(?=[A-Za-z])/g, (_m, a, p) => `${a}${p} `, counts, 'punctuation');
  t = sub(t, /([A-Za-z]{2}),(?=[A-Za-z])/g, (_m, a) => `${a}, `, counts, 'punctuation');
  t = sub(t, /([A-Za-z]{2});(?=[A-Za-z])/g, (_m, a) => `${a}; `, counts, 'punctuation');
  t = sub(t, /([a-z]{3}):(?=[A-Za-z])/g, (_m, a) => `${a}: `, counts, 'punctuation');
  t = sub(t, /\(\s+/g, () => '(', counts, 'punctuation');
  t = sub(t, /\s+\)/g, () => ')', counts, 'punctuation');
  t = sub(t, /([A-Za-z])\(/g, (_m, a) => `${a} (`, counts, 'punctuation');

  // --- capitals at the start of paragraphs and sentences ---
  t = sub(t, /(^|\n)([ \t]*)([a-z])/g, (_m, nl, sp, c) => `${nl}${sp}${c.toUpperCase()}`, counts, 'capitals');
  t = sub(t, /([A-Za-z0-9'’")\]]{2}[.!?]["”’')]*)(\s+)([a-z])/g, (m, before, sp, c) => {
    const lastWord = (/([A-Za-z.]+)[.!?]["”’')]*$/.exec(before)?.[1] ?? '').toLowerCase().replace(/\.$/, '');
    if (ABBREVIATIONS.has(lastWord) || /^[a-z]$/.test(lastWord)) return m;
    return `${before}${sp}${c.toUpperCase()}`;
  }, counts, 'capitals');

  // --- comma habits ---
  t = sub(t, new RegExp(`(^|[.!?]\\s+|\\n)(${INTRO_WORDS})(\\s+)(?=(?:${SUBJECTS})\\b)`, 'g'), (_m, lead, word, sp) => `${lead}${word},${sp}`, counts, 'commas');
  t = sub(t, new RegExp(`([A-Za-z0-9"”’')]+)(\\s+)but(\\s+)(?=(?:${SUBJECTS})\\b)`, 'g'), (m, a, s1, s2) => (NO_COMMA_BEFORE_BUT.has(a.toLowerCase()) ? m : `${a},${s1}but${s2}`), counts, 'commas');

  // --- end of paragraph ---
  t = t.split('\n').map((line) => {
    const trimmed = line.trimEnd();
    if (trimmed.replace(/\u0001\d+\u0002/g, 'x').length < 24 || /^\s*[-*•\d]+[.)]?\s/.test(trimmed)) return line;
    if (/[A-Za-z0-9]$/.test(trimmed) && /\s/.test(trimmed)) { bump(counts, 'endings'); return `${trimmed}.`; }
    return line;
  }).join('\n');

  const text = sh.restore(t).trim();
  const changes: string[] = [];
  const get = (k: string) => counts.get(k) ?? 0;
  if (get('spelling')) {
    const eg = spelled.slice(0, 3).map(([a, b]) => `${a} → ${b}`).join(', ');
    changes.push(`Fixed ${plural(get('spelling'), 'spelling slip', 'spelling slips')}${eg ? ` (${eg}${spelled.length > 3 ? ', …' : ''})` : ''}`);
  }
  if (get('grammar')) changes.push(`Corrected ${plural(get('grammar'), 'grammar slip', 'grammar slips')}`);
  if (get('apostrophes')) changes.push(`Added ${plural(get('apostrophes'), 'missing apostrophe', 'missing apostrophes')}`);
  if (get('capitals')) changes.push(`Fixed ${plural(get('capitals'), 'capital letter', 'capital letters')}`);
  if (get('punctuation')) changes.push(`Tidied ${plural(get('punctuation'), 'punctuation spot', 'punctuation spots')}`);
  if (get('commas')) changes.push(`Added ${plural(get('commas'), 'comma', 'commas')} where a pause reads naturally`);
  if (get('repeats')) changes.push(`Removed ${plural(get('repeats'), 'repeated word', 'repeated words')}`);
  if (get('articles')) changes.push(`Fixed ${plural(get('articles'), 'a/an', 'a/an')}`);
  if (get('endings')) changes.push(`Closed ${plural(get('endings'), 'paragraph', 'paragraphs')} with a full stop`);
  if (get('spacing')) changes.push('Cleaned up spacing');

  const hints = flowHints(text);
  if (unsure.length) hints.unshift(`Check ${unsure.map((w) => `“${w}”`).join(', ')}: it isn't a word I know and I couldn't tell what you meant, so I left it.`);
  return { text: text === input.trim() ? input : text, changes: text === input.trim() ? [] : changes, hints: hints.slice(0, 4) };
}

/** Advice only. The reviewer's sentences are never rewritten for them. */
export function flowHints(text: string): string[] {
  const hints: string[] = [];
  const sentences = text.replace(/\u0001\d+\u0002/g, 'x').split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  const long = sentences.filter((s) => s.split(/\s+/).length > 45);
  if (long.length) hints.push(`${plural(long.length, 'sentence runs', 'sentences run')} past 45 words; splitting could help it breathe.`);
  let run = 1; let worst = 1; let opener = '';
  for (let i = 1; i < sentences.length; i++) {
    const first = (x: string) => x.split(/\s+/)[0].toLowerCase().replace(/[^a-z']/g, '');
    const a = first(sentences[i]); const b = first(sentences[i - 1]);
    run = a === b ? run + 1 : 1;
    if (run > worst) { worst = run; opener = a; }
  }
  if (worst >= 3) hints.push(`${worst} sentences in a row open with “${opener}”; varying one could smooth the flow.`);
  return hints.slice(0, 3);
}

/** The full pass: loads the word list on first use, then proofreads. Falls back to the quick pass if the list can't load. */
export async function polishReviewDeep(input: string): Promise<PolishResult> {
  try { return polishReview(input, await loadDict()); } catch { return polishReview(input); }
}
