/**
 * Review Helper · Taste Match: word-level proofreading.
 * Finds misspelt and half-typed words with a bundled English word list and fixes the ones it is sure about.
 * Names, slang, repeated coinages, ALL-CAPS and links are never touched; unsure words are only flagged as tips.
 * The word list is a separate chunk that loads only when the reviewer presses Polish.
 */
export type Dict = Set<string>;

let dictPromise: Promise<Dict> | null = null;
export function loadDict(): Promise<Dict> {
  dictPromise ??= import('./data/dictEn').then((m) => {
    const alpha = '0123456789abcdefghijklmnopqrstuvwxyz';
    const set: Dict = new Set();
    let prev = '';
    for (const tok of m.default.split(' ')) {
      const w = prev.slice(0, alpha.indexOf(tok[0])) + tok.slice(1);
      set.add(w);
      prev = w;
    }
    return set;
  }).catch((e) => { dictPromise = null; throw e; });
  return dictPromise;
}

/** Everyday words (and review vocabulary) that win ties between equally close candidates. */
const COMMON = new Set(('the be to of and a in that have it for not on with he as you do at this but his by from they we say her she or an will my one all would there their what so up out if about who get which go me when make can like time no just him know take people into year your good some could them see other than then now look only come its over think also back after use two how our work first well way even new want because any these give day most us is was are were been has had did said each tell does set three need large must big high such follow act why ask men change went light kind off always read write story book books novel author character characters plot ending beginning chapter pages page world life love read reading reader readers recommend recommended really very much more less little long short great better best worse worst story stories writing written prose pacing slow fast fun sad funny dark heavy feel felt feeling emotional beautiful beautifully brilliant boring predictable twist twists world-building worldbuilding series sequel review rating stars star loved liked hated enjoy enjoyed enjoyable interesting believe because definitely definitely separate receive friend friends through thought though enough without between before after again against another around being during every first found great little might never often place right small still under while years young').split(/\s+/));

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const KEY = new Map<string, [number, number]>();
ROWS.forEach((r, y) => [...r].forEach((c, x) => KEY.set(c, [x + (y === 1 ? 0.5 : y === 2 ? 1 : 0), y])));
const near = (a: string, b: string) => { const p = KEY.get(a), q = KEY.get(b); return !!p && !!q && Math.abs(p[0] - q[0]) <= 1.01 && Math.abs(p[1] - q[1]) <= 1; };

/** Hand-checked slang / reader-speak that is not in a dictionary. */
const ALLOW = new Set(('lowkey highkey goated gripping unputdownable booktok bookstagram bookish tbr dnf arc arcs wlw mlm nsfw sfw ya fanfic fanfiction enemies-to-lovers romcom romcoms rom-com whodunit whodunnit manga manhwa webtoon audiobook audiobooks ebook ebooks kindle goodreads netgalley litrpg grimdark cozy cosy trope tropes worldbuilding spoilers spoilery spoiler-free infodump infodumps podcast youtube netflix hbo reddit okay yeah nope yep gonna wanna gotta kinda sorta lemme dunno ain ngl imo imho fyi btw iirc tbh smh lol lmao omg wtf').split(/\s+/));

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';
function edits1(w: string): string[] {
  const out: string[] = [];
  for (let i = 0; i <= w.length; i++) {
    const l = w.slice(0, i), r = w.slice(i);
    if (r) out.push(l + r.slice(1));
    if (r.length > 1) out.push(l + r[1] + r[0] + r.slice(2));
    for (const c of LETTERS) { if (r) out.push(l + c + r.slice(1)); out.push(l + c + r); }
  }
  return out;
}

interface Cand { word: string; dist: number; score: number }
function suggest(low: string, dict: Dict): Cand | 'unsure' | null {
  const seen = new Map<string, number>();
  for (const e of edits1(low)) if (dict.has(e) && e !== low) seen.set(e, 1);
  if (!seen.size && low.length >= 7 && low.length <= 14) {
    for (const e of edits1(low)) for (const f of edits1(e)) if (dict.has(f) && f !== low && !seen.has(f)) seen.set(f, 2);
  }
  if (low.length < 6) for (const k of [...seen.keys()]) if (k.length < low.length) seen.delete(k); // short fragments: never just drop letters
  if (!seen.size) return null;
  const cands: Cand[] = [...seen].map(([word, dist]) => {
    let s = -dist * 10;
    if (COMMON.has(word)) s += 6;
    if (word[0] === low[0]) s += 3;
    if (word.length === low.length) { // transposition or neighbouring-key slip
      const diff: number[] = [];
      for (let i = 0; i < word.length; i++) if (word[i] !== low[i]) diff.push(i);
      if (diff.length === 2 && diff[1] === diff[0] + 1 && word[diff[0]] === low[diff[1]] && word[diff[1]] === low[diff[0]]) s += 4;
      else if (diff.length === 1 && near(word[diff[0]], low[diff[0]])) s += 3;
    }
    if (word.length > low.length && word.startsWith(low)) s += 2; // half-typed ending
    if (word.includes("'")) s -= 8;
    s -= Math.abs(word.length - low.length) * 0.5;
    return { word, dist, score: s };
  }).sort((a, b) => b.score - a.score);
  if (cands.length > 1 && cands[0].score - cands[1].score < 2) return 'unsure';
  return cands[0];
}

/** Two known words glued together ("alittle", "forthe"). */
function splitGlued(low: string, dict: Dict): string | null {
  if (low.length < 5) return null;
  let best: [string, number] | null = null;
  for (let i = 1; i < low.length; i++) {
    const a = low.slice(0, i), b = low.slice(i);
    if (!(dict.has(a) && dict.has(b))) continue;
    if (!(COMMON.has(a) && COMMON.has(b))) continue;
    if (Math.min(a.length, b.length) < 1 || (a.length < 2 && !['a', 'i'].includes(a))) continue;
    const sc = Math.min(a.length, b.length);
    if (!best || sc > best[1]) best = [`${a} ${b}`, sc];
  }
  return best ? best[0] : null;
}

const applyCase = (orig: string, fixed: string) =>
  orig === orig.toUpperCase() && orig.length > 1 ? fixed.toUpperCase() : orig[0] === orig[0].toUpperCase() ? fixed[0].toUpperCase() + fixed.slice(1) : fixed;

export interface SpellResult { text: string; fixed: Array<[string, string]>; unsure: string[] }

export function correctWords(t: string, dict: Dict): SpellResult {
  const fixed: Array<[string, string]> = [];
  const unsure: string[] = [];
  const re = /(?<![\w\u0001\u0002])[A-Za-z][A-Za-z'’]*[A-Za-z]|(?<![\w\u0001\u0002])[A-Za-z]/g;
  const freq = new Map<string, number>();
  for (const m of t.matchAll(re)) { const k = m[0].toLowerCase(); freq.set(k, (freq.get(k) ?? 0) + 1); }
  const out = t.replace(re, (word, offset: number) => {
    const next = t[offset + word.length];
    if (next === '\u0001' || next === '\u0002' || (next && /[\d_]/.test(next))) return word;
    const low = word.toLowerCase().replace(/’/g, "'");
    if (low.length < 4) return word;
    const stem = low.replace(/'s$/, '');
    if (dict.has(low) || dict.has(stem) || ALLOW.has(low) || ALLOW.has(stem)) return word;
    if (/'/.test(stem)) return word;
    if ((freq.get(word.toLowerCase()) ?? 0) >= 2) return word; // repeated coinage or a name: reviewer meant it
    const before = t.slice(0, offset).replace(/[ \t"“‘(\u0001\u0002\d]+$/, '');
    const startOfSentence = before === '' || /[.!?\n]$/.test(before);
    if (/^[A-Z]/.test(word) && !startOfSentence) return word; // a name in mid-sentence
    const glued = splitGlued(low, dict);
    const s = glued ?? suggest(stem, dict);
    if (s === 'unsure') { if (!unsure.includes(word)) unsure.push(word); return word; }
    if (!s) { if (!unsure.includes(word)) unsure.push(word); return word; }
    const fix = typeof s === 'string' ? s : s.word;
    const res = applyCase(word, low.endsWith("'s") && !fix.endsWith("'s") ? fix + "'s" : fix);
    fixed.push([word, res]);
    return res;
  });
  return { text: out, fixed, unsure: unsure.slice(0, 4) };
}

/** Grammar slips that are safe to fix without understanding the whole sentence. */
const GRAMMAR: Array<[RegExp, (...m: string[]) => string, string]> = [
  [/\b(should|could|would|must|might)\s+of\b/gi, (_m, a) => `${a} have`, 'grammar'],
  [/\b(better|worse|more|less|rather|other|bigger|smaller|faster|slower|darker|longer|shorter|easier|harder|stronger|weaker|higher|lower|older|younger)\s+then\b/gi, (_m, a) => `${a} than`, 'grammar'],
  [/\bto\s+(much|many|late|soon)\b/gi, (_m, a) => `too ${a}`, 'grammar'],
  [/\b(they|we|you)\s+was\b/gi, (_m, a) => `${a} were`, 'grammar'],
  [/\b(he|she|it)\s+don'?t\b/gi, (_m, a) => `${a} doesn't`, 'grammar'],
  [/\bI\s+is\b/g, () => 'I am', 'grammar'],
  [/\b(there|their)\s+own\b/gi, (_m, a) => (a[0] === 'T' ? 'Their own' : 'their own'), 'grammar'],
  [/\b(your)\s+(welcome|going|doing|right|wrong|not|being|so|too)\b/gi, (_m, a, b) => `${a[0] === 'Y' ? 'You' : 'you'}'re ${b}`, 'grammar'],
  [/\b(its)\s+(a|an|been|not|the|so|very|really|just|also|about|going|got|time)\b/gi, (_m, a, b) => `${a[0] === 'I' ? 'It' : 'it'}'s ${b}`, 'grammar'],
  [/\balot\b/gi, (m) => (m[0] === 'A' ? 'A lot' : 'a lot'), 'grammar'],
  [/\bmore\s+better\b/gi, (m) => (m[0] === 'M' ? 'Better' : 'better'), 'grammar'],
  [/\b(a)\s+(couple|few)\s+of\s+of\b/gi, (_m, a, b) => `${a} ${b} of`, 'grammar'],
  [/\b(less)\s+(books|characters|chapters|pages|twists|stories)\b/gi, (_m, a, b) => `${a[0] === 'L' ? 'Fewer' : 'fewer'} ${b}`, 'grammar'],
];
export function fixGrammar(t: string): { text: string; count: number } {
  let count = 0;
  for (const [re, fn] of GRAMMAR) t = t.replace(re, (...a) => { const m = a.slice(0, -2) as string[]; const r = fn(...m); if (r !== m[0]) count++; return r; });
  return { text: t, count };
}
