/**
 * Review Helper · Taste Match: foul-language check.
 * Runs on the reviewer's device as they type. It spots swearing, slurs and abuse, including the usual disguises
 * (f*ck, sh1t, a$$, stretched letters, spaced-out letters), while whole-word matching keeps innocent words
 * (class, Scunthorpe, assume, cockpit, button) from being flagged. Nothing is blocked or sent anywhere; the reviewer is told.
 */
export interface FoulHit { found: string; severity: 'strong' | 'mild'; start: number; end: number }

/** Roots; common endings (s, es, ed, ing, er, ers, y, ie, face, head ...) are matched automatically. */
const STRONG = [
  'fuck', 'fck', 'fuk', 'shit', 'bullshit', 'bitch', 'bastard', 'asshole', 'arsehole', 'dickhead', 'cunt', 'twat', 'wanker', 'prick', 'bollocks', 'motherfucker',
  'slut', 'whore', 'piss', 'cock', 'dick', 'pussy', 'jackass', 'dumbass', 'douche', 'douchebag', 'bellend', 'tosser',
  'nigger', 'nigga', 'faggot', 'fag', 'retard', 'tranny', 'chink', 'spic', 'kike', 'paki', 'coon', 'dyke', 'gook', 'wetback',
  'chutiya', 'madarchod', 'bhenchod', 'behenchod', 'bhosdike', 'gaand', 'harami', 'randi', 'lund', 'saala',
];
const MILD = ['damn', 'crap', 'hell', 'ass', 'bloody', 'idiot', 'moron', 'imbecile', 'scum'];
/** Words that look like a root but are fine. */
const SAFE = new Set(['hello', 'shell', 'shellac', 'shitake', 'shiitake', 'assume', 'assumed', 'assure', 'assist', 'assign', 'assess', 'asset', 'assault', 'class', 'classic', 'pass', 'mass', 'bass', 'glass', 'grass', 'brass', 'lass', 'cocktail', 'cockpit', 'cockatoo', 'cockney', 'peacock', 'hancock', 'dickens', 'dickinson', 'moby', 'analysis', 'bitcoin', 'scunthorpe', 'cocoon', 'raccoon', 'tycoon', 'lunds', 'hellenic', 'helluva', 'pissarro', 'spice', 'spicy', 'spicier', 'passion', 'passed', 'sass', 'sassy', 'hassle', 'assam', 'cassandra', 'bassoon', 'massive', 'harass', 'embassy', 'ambassador', 'compass', 'passage', 'tassel', 'lassie', 'gaandiva', 'ashell']);
const SAFE_PREFIX = /^(class|pass|mass|bass|glass|grass|brass|assum|assur|assist|assign|assess|assert|asset|assail|assault|assemb|assimil|associat|assort|passion|passen|passag|passiv|passw|passp|massac|massag|massi|hello|shell|cockt|cockp|cocka|cockn|peac|hanc|dick(?:en|ins)|coon(?:s?kin)|cocoo|racco|tycoo|helm|helic|helio|helpl|hell(?:o|e|i)|pissar|bassi|bassoo|lassi|sassy|hassl|tassel|embass|ambass|compass|harass|cassand|lunds)/;

const ENDINGS = '(?:s|es|ed|ing|er|ers|ery|y|ie|ier|iest|ish|face|head|heads|hole|holes|wit|wits|bag|bags|monkey|ass)?';
const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i', '+': 't', '€': 'e' };

/** Lower-cases, undoes number/symbol swaps, and collapses stretched letters ("fuuuuck" → "fuck"). */
function normaliseToken(raw: string): string {
  let s = raw.toLowerCase().replace(/[0134579@$!+€]/g, (c) => LEET[c] ?? c);
  s = s.replace(/[*#%_.-]+/g, '*').replace(/^\*+|\*+$/g, ''); // masked letters
  s = s.replace(/(.)\1{2,}/g, '$1$1');
  return s;
}
const squash = (s: string) => s.replace(/(.)\1+/g, '$1');

const build = (roots: string[]) => new RegExp(`^(?:${roots.map((r) => squash(r)).join('|')})${ENDINGS}$`);
const STRONG_RE = build(STRONG);
const MILD_RE = build(MILD);
/** A masked word like f*ck / sh*t: one or two star slots standing in for letters. */
const maskedMatches = (tok: string, roots: string[]) => {
  if (!tok.includes('*')) return false;
  const re = new RegExp(`^${tok.split('*').map((p) => p.replace(/[^a-z]/g, '')).join('[a-z]{1,2}')}${ENDINGS}$`);
  return roots.some((r) => r.length >= 4 && r.length <= tok.length + 1 && re.test(r));
};

const TOKEN = /[A-Za-z0-9@$!+*#%][A-Za-z0-9@$!+*#%'’._-]*[A-Za-z0-9@$!+*#%]|[A-Za-z0-9@$!+*#%]/g;
const THREATS = /\b(kill\s+yourself|kys|go\s+die|hope\s+you\s+die|i('|’)ll\s+kill\s+you|you\s+deserve\s+to\s+die)\b/gi;

export function checkFoul(text: string): FoulHit[] {
  const hits: FoulHit[] = [];
  for (const m of text.matchAll(TOKEN)) {
    const raw = m[0];
    const start = m.index ?? 0;
    // ignore URLs / emails / handles
    if (/^(https?|www)/i.test(raw) || raw.includes('@') && /[a-z]@[a-z]/i.test(raw)) continue;
    const letters = raw.replace(/[^A-Za-z]/g, '');
    if (letters.length < 2) continue;
    // all caps shouting of a plain word still counts; short ALL-CAPS acronyms (2-3) are skipped
    const low = raw.toLowerCase().replace(/[’']/g, '');
    if (SAFE.has(low) || SAFE_PREFIX.test(low)) continue;
    if (low === 'dick' && /(moby|philip|k|van|tracy)\s+$/i.test(text.slice(Math.max(0, start - 8), start))) continue; // Moby Dick, Philip K. Dick
    const tok = squash(normaliseToken(raw));
    if (SAFE.has(tok)) continue;
    if (STRONG_RE.test(tok) || maskedMatches(tok, STRONG.map(squash))) hits.push({ found: raw, severity: 'strong', start, end: start + raw.length });
    else if (MILD_RE.test(tok) || (tok.includes('*') && maskedMatches(tok, MILD.map(squash)))) hits.push({ found: raw, severity: 'mild', start, end: start + raw.length });
  }
  // letters spaced out to dodge filters: "f u c k"
  for (const m of text.matchAll(/\b(?:[A-Za-z][ .\-_*]){3,6}[A-Za-z]\b/g)) {
    const joined = squash(normaliseToken(m[0].replace(/[ .\-_*]/g, '')));
    if (STRONG_RE.test(joined)) hits.push({ found: m[0], severity: 'strong', start: m.index ?? 0, end: (m.index ?? 0) + m[0].length });
  }
  for (const m of text.matchAll(THREATS)) hits.push({ found: m[0], severity: 'strong', start: m.index ?? 0, end: (m.index ?? 0) + m[0].length });
  return hits.sort((a, b) => a.start - b.start).filter((h, i, all) => i === 0 || h.start >= all[i - 1].end);
}

/** User-triggered: swaps the middle of each flagged word for stars ("f**k"). */
export function maskFoul(text: string, hits = checkFoul(text)): string {
  let out = ''; let at = 0;
  for (const h of hits) {
    const w = text.slice(h.start, h.end);
    out += text.slice(at, h.start) + (w.length <= 2 ? '*'.repeat(w.length) : w[0] + '*'.repeat(w.length - 2) + w[w.length - 1]);
    at = h.end;
  }
  return out + text.slice(at);
}

export function foulSummary(hits: FoulHit[]): { strong: number; mild: number; words: string[]; mildWords: string[] } {
  const uniq = (sev: FoulHit['severity']) => [...new Set(hits.filter((h) => h.severity === sev).map((h) => h.found.toLowerCase()))].slice(0, 4);
  return { strong: hits.filter((h) => h.severity === 'strong').length, mild: hits.filter((h) => h.severity === 'mild').length, words: uniq('strong'), mildWords: uniq('mild') };
}
