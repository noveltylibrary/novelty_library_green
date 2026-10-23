/**
 * Taste Match AI — 40-metric, browser-native ranking engine.
 *
 * The live app's public review schema currently stores core book metadata and a
 * reviewer-written description, not dedicated values for all 40 metrics. This
 * engine therefore uses explicit metricValues when supplied, direct catalog
 * fields where available, and conservative text cues where reasonable. Metrics
 * with no evidence are omitted from that candidate's metric denominator rather
 * than invented or treated as a negative match.
 */
import type { Match, SearchBook } from '@/lib/rankingSearch';
import { MOODS, norm } from '@/lib/rankingSearch';

export type TmaiMetricId =
  | 'traits' | 'genre' | 'language' | 'pace' | 'writing_style' | 'world_building'
  | 'character_complexity' | 'spice_level' | 'pov' | 'ending_type' | 'timeline_format'
  | 'book_popularity_bias' | 'user_recommendations' | 'hard_hitter_concept' | 'translated_in'
  | 'intelligible_resonance' | 'emotional_resonance' | 'exposition_score' | 'dialogue_score'
  | 'regional_frequency_mapping_score' | 'atmosphere' | 'twist_predictibility' | 'ppp_angle'
  | 'plot_structure' | 'storytelling' | 'nuanced_writing_input' | 'nuanced_wording_style'
  | 'proofread_demand' | 'rereadability_index' | 'pqi' | 'per_capita_sales'
  | 'author_popularity_bias' | 'ssr' | 'sensory_immersion_index' | 'velocity_shift'
  | 'narrative_draft_probe_score' | 'poetic_weight' | 'post_read_hangover_index'
  | 'avt_optimization' | 'directors_seat';

export interface TmaiMetricSpec {
  id: TmaiMetricId;
  label: string;
  weight: number;
  kind: 'text' | 'numeric';
  /** A reliable source field, when the current public review schema has one. */
  directField?: 'traits' | 'genre' | 'language' | 'translatedIn' | 'verdict';
  cues?: string[];
  highCues?: string[];
  lowCues?: string[];
  /** Metrics with no defensible signal in current review records are metadata-only. */
  metadataOnly?: boolean;
}

/** Canonical 40 dimensions from Taste Match AI Fields.docx, in document order. */
export const TMAI40_METRICS: readonly TmaiMetricSpec[] = [
  { id: 'traits', label: 'Traits', kind: 'text', weight: 1.0, directField: 'traits', cues: ['dark', 'gritty', 'cozy', 'hopeful', 'tragic', 'mind bending', 'emotional', 'suspenseful', 'thought provoking', 'whimsical'] },
  { id: 'genre', label: 'Genre', kind: 'text', weight: 1.5, directField: 'genre', cues: ['thriller', 'suspense', 'mystery', 'crime', 'romance', 'science fiction', 'sci fi', 'cyberpunk', 'fantasy', 'historical fiction', 'horror', 'literary fiction', 'nonfiction', 'self help', 'dystopian', 'adventure', 'memoir', 'poetry', 'graphic novel', 'manga', 'contemporary fiction'] },
  { id: 'language', label: 'Language', kind: 'text', weight: 0.7, directField: 'language', cues: ['english', 'bengali', 'hindi', 'tamil', 'telugu', 'marathi', 'french', 'german', 'spanish', 'japanese', 'korean', 'translated'] },
  { id: 'pace', label: 'Pace', kind: 'text', weight: 1.2, cues: ['fast paced', 'page turner', 'rapid', 'brisk', 'slow burn', 'slow paced', 'measured', 'leisurely', 'dense', 'plodding', 'propulsive', 'breakneck', 'steady paced'] },
  { id: 'writing_style', label: 'Writing Style', kind: 'text', weight: 1.2, cues: ['lyrical', 'ornate', 'minimalist', 'accessible prose', 'philosophical', 'descriptive', 'crisp', 'spare prose', 'flowery', 'conversational', 'experimental', 'immersive prose', 'witty prose', 'elegant prose'] },
  { id: 'world_building', label: 'World Building', kind: 'text', weight: 1.0, cues: ['world building', 'worldbuilding', 'richly imagined', 'intricate world', 'deep lore', 'detailed setting', 'immersive world', 'universe', 'mythology', 'speculative setting'] },
  { id: 'character_complexity', label: 'Character Complexity', kind: 'text', weight: 1.0, cues: ['complex characters', 'morally grey', 'morally gray', 'multidimensional', 'multi dimensional', 'character driven', 'psychological depth', 'flawed protagonist', 'character development', 'flat characters'] },
  { id: 'spice_level', label: 'Spice Level', kind: 'text', weight: 0.6, cues: ['closed door', 'fade to black', 'open door', 'explicit scenes', 'spicy', 'steamy', 'sensual', 'low spice', 'high spice'] },
  { id: 'pov', label: 'POV', kind: 'text', weight: 0.5, cues: ['first person', 'second person', 'third person', 'multiple pov', 'dual pov', 'omniscient narrator', 'unreliable narrator', 'limited perspective'] },
  { id: 'ending_type', label: 'Ending Type', kind: 'text', weight: 0.7, cues: ['open ending', 'closed ending', 'ambiguous ending', 'bittersweet ending', 'happy ending', 'tragic ending', 'cliffhanger', 'conclusive ending', 'unresolved ending'] },
  { id: 'timeline_format', label: 'Timeline Format', kind: 'text', weight: 0.5, cues: ['nonlinear', 'non linear', 'linear timeline', 'multiple timelines', 'dual timeline', 'flashbacks', 'time jumps', 'chronological', 'fractured timeline'] },
  { id: 'book_popularity_bias', label: 'Book Popularity Bias', kind: 'numeric', weight: 0.2, metadataOnly: true },
  { id: 'user_recommendations', label: 'User Recommendations', kind: 'text', weight: 0.8, directField: 'verdict', cues: ['highly recommended', 'must read', 'recommend', 'recommended', 'go for it', 'perfection', 'readers favourite', 'reader favorite'] },
  { id: 'hard_hitter_concept', label: 'Hard Hitter Concept', kind: 'text', weight: 0.8, cues: ['hard hitting', 'hard-hitting', 'devastating', 'provocative', 'brutal truth', 'unflinching', 'disturbing themes', 'social impact', 'powerful premise'] },
  { id: 'translated_in', label: 'Translated In', kind: 'text', weight: 0.3, directField: 'translatedIn', cues: ['translated', 'translation', 'translated from', 'translated into'] },
  { id: 'intelligible_resonance', label: 'Intelligible Resonance (Cognitive Load)', kind: 'numeric', weight: 1.0, highCues: ['dense', 'philosophical', 'complex', 'intricate', 'multilayered', 'multi layered', 'intellectually demanding', 'conceptually rich', 'layered narrative'], lowCues: ['accessible', 'easy to follow', 'straightforward', 'light read', 'simple prose', 'breezy', 'easy read'] },
  { id: 'emotional_resonance', label: 'Emotional Resonance', kind: 'numeric', weight: 1.2, highCues: ['moving', 'heartbreaking', 'heart warming', 'heartwarming', 'devastating', 'cathartic', 'tender', 'emotionally powerful', 'gut wrenching', 'affecting'], lowCues: ['emotionally detached', 'cold', 'lighthearted', 'light hearted', 'low emotional stakes'] },
  { id: 'exposition_score', label: 'Exposition Score', kind: 'numeric', weight: 0.6, highCues: ['exposition heavy', 'info dump', 'information dense', 'long explanations', 'detailed exposition', 'extensive backstory'], lowCues: ['minimal exposition', 'show dont tell', 'show rather than tell', 'lean exposition', 'little exposition'] },
  { id: 'dialogue_score', label: 'Dialogue Score', kind: 'numeric', weight: 0.7, highCues: ['dialogue driven', 'dialogue heavy', 'witty dialogue', 'sharp dialogue', 'banter', 'natural dialogue', 'conversation driven'], lowCues: ['narration heavy', 'internal monologue', 'little dialogue', 'sparse dialogue'] },
  { id: 'regional_frequency_mapping_score', label: 'Regional Frequency Mapping Score', kind: 'numeric', weight: 0.4, metadataOnly: true },
  { id: 'atmosphere', label: 'Atmosphere', kind: 'text', weight: 1.0, cues: ['dark', 'gritty', 'gothic', 'eerie', 'haunting', 'melancholy', 'hopeful', 'cozy', 'dreamlike', 'claustrophobic', 'atmospheric', 'whimsical', 'bleak', 'tense', 'vibrant'] },
  { id: 'twist_predictibility', label: 'Twist Predictibility', kind: 'numeric', weight: 0.8, highCues: ['predictable', 'telegraphed twist', 'obvious twist', 'easy to guess', 'guessable', 'foreseeable'], lowCues: ['unpredictable', 'unexpected twist', 'shocking twist', 'surprising reveal', 'twisty', 'subverts expectations', 'unforeseeable'] },
  { id: 'ppp_angle', label: 'PPP Angle (Philosophy, Psychology, Political)', kind: 'text', weight: 0.8, cues: ['philosophy', 'philosophical', 'psychology', 'psychological', 'political', 'politics', 'power structures', 'ethical dilemma', 'existential', 'social commentary', 'ideological'] },
  { id: 'plot_structure', label: 'Plot Structure', kind: 'text', weight: 0.9, cues: ['nonlinear', 'non linear', 'layered plot', 'intricate plot', 'episodic', 'linear plot', 'interwoven plots', 'fragmented narrative', 'tight plotting', 'plot driven', 'character driven'] },
  { id: 'storytelling', label: 'Storytelling', kind: 'text', weight: 1.0, cues: ['immersive storytelling', 'compelling narrative', 'oral storytelling', 'unreliable narrator', 'intimate narration', 'cinematic storytelling', 'reflective storytelling', 'fast paced storytelling'] },
  { id: 'nuanced_writing_input', label: 'Nuanced Writing Input', kind: 'text', weight: 0.8, cues: ['nuanced', 'subtle', 'layered meaning', 'ambiguous', 'understated', 'complex themes', 'moral ambiguity', 'subtext'] },
  { id: 'nuanced_wording_style', label: 'Nuanced Wording Style', kind: 'text', weight: 0.9, cues: ['precise diction', 'metaphorical', 'metaphor rich', 'poetic language', 'ornate wording', 'subtle wording', 'figurative language', 'rich vocabulary', 'wordplay', 'elevated prose'] },
  { id: 'proofread_demand', label: 'Proofread Demand', kind: 'numeric', weight: 0.3, highCues: ['typos', 'grammatical errors', 'poorly edited', 'needs proofreading', 'editing issues', 'copyediting needed'], lowCues: ['well edited', 'well-edited', 'polished prose', 'clean copy', 'proofread carefully', 'few errors'] },
  { id: 'rereadability_index', label: 'Rereadability Index', kind: 'numeric', weight: 0.8, highCues: ['rereadable', 're readable', 'reread', 're read', 'multiple readings', 'rewards rereading', 'layers on rereading', 'worth revisiting'], lowCues: ['one time read', 'one-time read', 'forgettable', 'not worth rereading'] },
  { id: 'pqi', label: 'PQI (Production Quality Index)', kind: 'numeric', weight: 0.5, metadataOnly: true },
  { id: 'per_capita_sales', label: 'Per Capita Sales', kind: 'numeric', weight: 0.2, metadataOnly: true },
  { id: 'author_popularity_bias', label: 'Author Popularity Bias', kind: 'numeric', weight: 0.2, metadataOnly: true },
  { id: 'ssr', label: 'Shonen Seinen Regime (SSR)', kind: 'text', weight: 0.4, cues: ['shonen', 'shounen', 'seinen', 'shojo', 'shoujo', 'josei', 'kodomomuke', 'manga demographic'] },
  { id: 'sensory_immersion_index', label: 'Sensory Immersion Index', kind: 'numeric', weight: 0.8, highCues: ['sensory detail', 'sensory rich', 'vivid imagery', 'immersive', 'visceral', 'texture', 'scent', 'soundscape', 'tactile', 'evocative setting'], lowCues: ['flat descriptions', 'sparse description', 'little sensory detail', 'abstract rather than sensory'] },
  { id: 'velocity_shift', label: 'Velocity Shift', kind: 'numeric', weight: 0.5, highCues: ['pacing shifts', 'shifts pace', 'accelerates', 'builds momentum', 'changes gears', 'escalating pace', 'alternates fast and slow'], lowCues: ['steady pace', 'even paced', 'uniform pace', 'little variation in pace'] },
  { id: 'narrative_draft_probe_score', label: 'Narrative Draft Probe Score', kind: 'numeric', weight: 0.4, metadataOnly: true },
  { id: 'poetic_weight', label: 'Poetic Weight', kind: 'numeric', weight: 0.7, highCues: ['poetic', 'lyrical', 'metaphorical', 'imagery rich', 'rhythmic prose', 'beautiful language', 'poetic prose'], lowCues: ['plain prose', 'utilitarian prose', 'unadorned prose', 'plainspoken', 'minimalist prose'] },
  { id: 'post_read_hangover_index', label: 'Post-Read Hangover Index', kind: 'numeric', weight: 0.9, highCues: ['haunting', 'lingering', 'devastating', 'empty', 'cathartic', 'unsettling', 'stays with you', 'emotional aftermath', 'hard to forget'], lowCues: ['fleeting', 'light read', 'easy to move on', 'quickly forgotten', 'forgettable'] },
  { id: 'avt_optimization', label: 'AVT Optimization (Audio, Visual, Text)', kind: 'numeric', weight: 0.3, highCues: ['cinematic', 'audio rich', 'audiobook friendly', 'strong narration', 'visually vivid', 'adaptation ready', 'screenplay like'], lowCues: ['text only experience', 'difficult to visualize', 'limited sensory cues'] },
  { id: 'directors_seat', label: "Director's Seat", kind: 'text', weight: 0.5, cues: ['cinematic', 'visual storytelling', 'scene staging', 'camera like', 'screenplay like', 'strong scene composition', 'director friendly'] },
] as const;

export interface Tmai40Input {
  description?: string;
  moods?: string[];
  lovedId?: string;
  language?: string;
  verdicts?: string[];
}

export interface TmaiMetricMatch {
  id: TmaiMetricId;
  label: string;
  score: number;
  weight: number;
}

export interface Tmai40Match extends Match<SearchBook> {
  metricMatches: TmaiMetricMatch[];
  textSimilarity: number;
  metricSimilarity: number;
  metricCoverage: number;
}

const STOP = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'about', 'by', 'me', 'my', 'i', 'is', 'it', 'that', 'this',
  'book', 'books', 'novel', 'novels', 'story', 'stories', 'read', 'reading', 'like', 'want', 'looking', 'something', 'some', 'any',
  'good', 'best', 'show', 'find', 'tell', 'us', 'more', 'where', 'who', 'what', 'are', 'was', 'be', 'set', 'its', 'into', 'from', 'that',
]);

const tokenize = (text: string): string[] =>
  norm(text).split(' ').filter((word) => word.length > 1 && !STOP.has(word));

const phrasePresent = (text: string, phrase: string): boolean => {
  const source = ` ${norm(text)} `;
  const target = ` ${norm(phrase)} `;
  return source.includes(target);
};

const anyPhrase = (text: string, phrases: readonly string[] | undefined): boolean =>
  !!phrases?.some((phrase) => phrasePresent(text, phrase));

function directMetricText(book: SearchBook, spec: TmaiMetricSpec): string {
  const explicit = book.metricValues?.[spec.id];
  if (typeof explicit === 'string') return explicit;
  if (typeof explicit === 'number' || explicit === null) return '';
  switch (spec.directField) {
    case 'traits': return book.traits;
    case 'genre': return book.genre;
    case 'language': return book.language;
    case 'translatedIn': return book.translatedIn ?? '';
    case 'verdict': return book.verdict;
    default: return '';
  }
}

function fullBookText(book: SearchBook): string {
  return [book.title, book.author, book.genre, book.language, book.traits, book.verdict,
    book.translatedIn ?? '', book.seriesName ?? '', book.text].filter(Boolean).join(' ');
}

function textMetricProfile(book: SearchBook, spec: TmaiMetricSpec): string {
  const explicit = book.metricValues?.[spec.id];
  const direct = directMetricText(book, spec);
  const text = fullBookText(book);
  const cueHits = (spec.cues ?? []).filter((cue) => phrasePresent(text, cue));
  const explicitText = typeof explicit === 'string' ? explicit : '';
  return [direct, explicitText, ...cueHits].filter(Boolean).join(' ');
}

function numericMetricValue(book: SearchBook, spec: TmaiMetricSpec): number | null {
  const explicit = book.metricValues?.[spec.id];
  if (typeof explicit === 'number' && Number.isFinite(explicit)) return Math.max(0, Math.min(1, explicit));
  if (typeof explicit === 'string' && explicit.trim() !== '' && Number.isFinite(Number(explicit))) {
    return Math.max(0, Math.min(1, Number(explicit)));
  }
  if (spec.metadataOnly) return null;
  const text = fullBookText(book);
  const high = spec.highCues?.filter((cue) => phrasePresent(text, cue)).length ?? 0;
  const low = spec.lowCues?.filter((cue) => phrasePresent(text, cue)).length ?? 0;
  if (high === 0 && low === 0) return null;
  // Conservative lexical estimate. A single cue is weak evidence; multiple cues move the estimate more.
  const total = high + low;
  return Math.max(0, Math.min(1, (high + 0.5) / (total + 1)));
}

function queryMetricText(query: string, spec: TmaiMetricSpec): string {
  const phrases = spec.kind === 'text' ? (spec.cues ?? []) : [...(spec.highCues ?? []), ...(spec.lowCues ?? [])];
  return phrases.filter((phrase) => phrasePresent(query, phrase)).join(' ');
}

function metricQueryTarget(query: string, spec: TmaiMetricSpec): number | null {
  const explicitPhrases = spec.kind === 'numeric' ? [...(spec.highCues ?? []), ...(spec.lowCues ?? [])] : [];
  if (!explicitPhrases.length) return null;
  const high = anyPhrase(query, spec.highCues);
  const low = anyPhrase(query, spec.lowCues);
  if (!high && !low) return null;
  if (high && low) return 0.5;
  return high ? 0.82 : 0.18;
}

function f1TokenMatch(queryText: string, candidateText: string): number {
  const q = new Set(tokenize(queryText));
  const c = new Set(tokenize(candidateText));
  if (!q.size || !c.size) return 0;
  let overlap = 0;
  q.forEach((token) => { if (c.has(token)) overlap += 1; });
  if (!overlap) {
    // Exact phrase evidence helps for joined terms such as "science fiction" / "sci fi".
    return phrasePresent(candidateText, queryText) ? 1 : 0;
  }
  const precision = overlap / c.size;
  const recall = overlap / q.size;
  return 2 * precision * recall / (precision + recall);
}

function buildTfidf(bookTexts: string[], query: string): number[] {
  const tokenDocs = bookTexts.map((text) => tokenize(text));
  const documentFrequency = new Map<string, number>();
  tokenDocs.forEach((terms) => new Set(terms).forEach((term) => documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1)));
  const n = Math.max(1, tokenDocs.length);
  const idf = (term: string) => Math.log((n + 1) / ((documentFrequency.get(term) ?? 0) + 1)) + 1;
  const vectorize = (terms: string[]) => {
    const counts = new Map<string, number>();
    terms.forEach((term) => counts.set(term, (counts.get(term) ?? 0) + 1));
    const vector = new Map<string, number>();
    counts.forEach((count, term) => vector.set(term, (1 + Math.log(count)) * idf(term)));
    const normValue = Math.sqrt([...vector.values()].reduce((sum, value) => sum + value * value, 0));
    if (normValue > 0) vector.forEach((value, term) => vector.set(term, value / normValue));
    return vector;
  };
  const qVector = vectorize(tokenize(query));
  if (!qVector.size) return tokenDocs.map(() => 0);
  return tokenDocs.map((terms) => {
    const dVector = vectorize(terms);
    let dot = 0;
    qVector.forEach((value, term) => { dot += value * (dVector.get(term) ?? 0); });
    return Math.max(0, Math.min(1, dot));
  });
}

function buildQuery(input: Tmai40Input, books: SearchBook[]): { query: string; loved?: SearchBook } {
  const moodWords = (input.moods ?? []).flatMap((id) => MOODS.find((mood) => mood.id === id)?.words ?? []);
  const loved = books.find((book) => book.id === input.lovedId);
  const lovedProfile = loved ? [loved.genre, loved.traits, loved.language, loved.verdict].filter(Boolean).join(' ') : '';
  return { query: [input.description ?? '', moodWords.join(' '), lovedProfile].filter(Boolean).join(' ').trim(), loved };
}

function isVerdictAllowed(book: SearchBook, verdicts: string[]): boolean {
  return verdicts.length === 0 || verdicts.includes(norm(book.verdict).replace(/ /g, '_')) || verdicts.some((v) => norm(v) === norm(book.verdict));
}

/** Run TMAI-40 against published review records. Scores are relative ranking scores, not probabilities. */
export function rankTmai40(books: SearchBook[], input: Tmai40Input, limit = 3): Tmai40Match[] {
  if (!books.length || limit < 1) return [];
  const { query, loved } = buildQuery(input, books);
  const language = norm(input.language);
  const verdicts = (input.verdicts ?? []).map((v) => norm(v));
  const allText = books.map(fullBookText);
  const textScores = buildTfidf(allText, query);

  const activeMetrics = TMAI40_METRICS.map((spec) => {
    if (spec.kind === 'numeric') {
      const target = metricQueryTarget(query, spec);
      return target == null ? null : { spec, target, queryText: '' };
    }
    const matchedCues = queryMetricText(query, spec);
    if (matchedCues) return { spec, target: null, queryText: matchedCues };
    // Direct values can be matched even when a custom genre/language/trait was not in the built-in cues list.
    if (spec.directField) {
      const directQueryText = query.split(/[,.!?;:]+/).map((part) => part.trim()).filter((part) => {
        const tokens = tokenize(part);
        return tokens.length > 0 && books.some((book) => f1TokenMatch(part, directMetricText(book, spec)) > 0.25);
      }).join(' ');
      if (directQueryText) return { spec, target: null, queryText: directQueryText };
    }
    return null;
  }).filter((x): x is NonNullable<typeof x> => x !== null);

  // When a loved book is supplied, its observed metric profile is another taste signal.
  const lovedMetricProfiles = new Map<TmaiMetricId, string | number>();
  if (loved) {
    for (const spec of TMAI40_METRICS) {
      if (spec.kind === 'text') {
        const value = textMetricProfile(loved, spec);
        if (value.trim()) lovedMetricProfiles.set(spec.id, value);
      } else {
        const value = numericMetricValue(loved, spec);
        if (value != null) lovedMetricProfiles.set(spec.id, value);
      }
    }
  }

  const output: Tmai40Match[] = [];
  books.forEach((book, index) => {
    if (loved && book.id === loved.id) return;
    if (language && norm(book.language) !== language) return;
    if (!isVerdictAllowed(book, verdicts)) return;

    let metricWeighted = 0;
    let metricWeight = 0;
    let observedWeight = 0;
    const metricMatches: TmaiMetricMatch[] = [];
    for (const spec of TMAI40_METRICS) {
      const active = activeMetrics.find((entry) => entry.spec.id === spec.id);
      const lovedValue = lovedMetricProfiles.get(spec.id);
      if (!active && lovedValue == null) continue;
      let score: number | null = null;
      if (spec.kind === 'text') {
        const hasQueryTarget = !!active?.queryText;
        const hasLovedTarget = typeof lovedValue === 'string' && !!lovedValue.trim();
        if (!hasQueryTarget && !hasLovedTarget) continue;
        const candidateText = textMetricProfile(book, spec);
        if (!candidateText.trim()) {
          // A present direct catalog field (e.g. genre) can be a measured non-match; absent inferred metadata is skipped.
          if (spec.directField && directMetricText(book, spec).trim() && hasQueryTarget) score = 0;
          else continue;
        } else {
          const queryScore = hasQueryTarget ? f1TokenMatch(active!.queryText, candidateText) : null;
          const lovedScore = hasLovedTarget ? f1TokenMatch(String(lovedValue), candidateText) : null;
          if (queryScore != null && lovedScore != null) score = queryScore * 0.7 + lovedScore * 0.3;
          else score = queryScore ?? lovedScore ?? 0;
          // Shared descriptor synonyms often have multiword/inflected forms; allow the cue phrase as direct evidence.
          if (score === 0 && hasQueryTarget && anyPhrase(candidateText, active!.queryText.split(' '))) score = 0.75;
        }
      } else {
        const actual = numericMetricValue(book, spec);
        if (actual == null) continue;
        const numericScores: { score: number; weight: number }[] = [];
        if (active?.target != null) numericScores.push({ score: Math.max(0, 1 - Math.abs(actual - active.target)), weight: 0.7 });
        if (typeof lovedValue === 'number') numericScores.push({ score: Math.max(0, 1 - Math.abs(actual - lovedValue)), weight: active?.target != null ? 0.3 : 1 });
        if (!numericScores.length) continue;
        score = numericScores.reduce((sum, part) => sum + part.score * part.weight, 0) / numericScores.reduce((sum, part) => sum + part.weight, 0);
      }
      if (score == null || !Number.isFinite(score)) continue;
      metricWeighted += score * spec.weight;
      metricWeight += spec.weight;
      observedWeight += spec.weight;
      metricMatches.push({ id: spec.id, label: spec.label, score, weight: spec.weight });
    }

    const metricSimilarity = metricWeight > 0 ? metricWeighted / metricWeight : 0;
    const metricCoverage = activeMetrics.length > 0 ? Math.min(1, observedWeight / activeMetrics.reduce((sum, entry) => sum + entry.spec.weight, 0)) : 0;
    const hasQuery = tokenize(query).length > 0;
    let combined = 0;
    if (hasQuery && metricWeight > 0) combined = textScores[index] * 0.62 + metricSimilarity * 0.38;
    else if (hasQuery) combined = textScores[index];
    else if (metricWeight > 0) combined = metricSimilarity;
    else combined = Math.max(0, Math.min(1, ((book.nl ?? book.rw) / 10) * 0.8 + (book.rw / 10) * 0.2));

    // Relevance gate: a high community rating cannot turn a zero-similarity book into a taste match.
    if (hasQuery && combined < 0.015) return;
    metricMatches.sort((a, b) => (b.score * b.weight) - (a.score * a.weight));
    const reasons: string[] = [];
    if (textScores[index] >= 0.04) reasons.push('Echoes your words');
    if (metricMatches.some((metric) => metric.score >= 0.25)) reasons.push('Shares the story feel');
    if (language) reasons.push(`Language: ${book.language}`);
    if (verdicts.length) reasons.push(`Verdict: ${book.verdict}`);
    if (!reasons.length && !hasQuery && !metricWeight) reasons.push('Loved by readers');
    if (!reasons.length) reasons.push('Closest fit on the shelf');

    output.push({
      book,
      score: Math.round(combined * 1000) / 10,
      reasons: [...new Set(reasons)].slice(0, 4),
      metricMatches: metricMatches.filter((metric) => metric.score >= 0.15).slice(0, 8),
      textSimilarity: textScores[index],
      metricSimilarity,
      metricCoverage,
    });
  });

  return output.sort((a, b) => b.score - a.score || (b.book.nl ?? -1) - (a.book.nl ?? -1) || b.book.rw - a.book.rw || a.book.title.localeCompare(b.book.title)).slice(0, limit);
}

/** Describe what is real in the current public catalog versus what still needs structured source data. */
export function getTmaiMetricReadiness(books: SearchBook[]): { total: number; withCatalogSupport: number; metadataOnly: number } {
  const supported = new Set<TmaiMetricId>();
  for (const spec of TMAI40_METRICS) {
    if (spec.metadataOnly) continue;
    if (books.some((book) => {
      if (book.metricValues?.[spec.id] != null) return true;
      if (directMetricText(book, spec).trim()) return true;
      if (spec.kind === 'numeric') return numericMetricValue(book, spec) != null;
      return (spec.cues ?? []).some((cue) => phrasePresent(fullBookText(book), cue));
    })) supported.add(spec.id);
  }
  return { total: TMAI40_METRICS.length, withCatalogSupport: supported.size, metadataOnly: TMAI40_METRICS.filter((spec) => spec.metadataOnly).length };
}
