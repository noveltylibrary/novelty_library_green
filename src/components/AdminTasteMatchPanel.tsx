import { useMemo, useState } from 'react';
import { TasteMatchIcon } from '@/components/TasteMatchIcon';
import { ArrowDown, ArrowUp, ExternalLink, FlaskConical, Layers, Minus, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { DEFAULT_TF_CONFIG, MOODS, labSearch, type FieldKey, type TfConfig } from '@/lib/rankingSearch';
import { reviewToSearchBook, usePublished } from '@/lib/readerTools';
import { TMAI40_METRICS, getTmaiMetricReadiness } from '@/lib/tmai40Engine';

const FIELD_LABELS: Record<FieldKey, string> = { genre: 'Genre', traits: 'Traits', title: 'Title', author: 'Author', language: 'Language', verdict: 'Verdict' };
const STEPS: { title: string; body: string }[] = [
  { title: 'A reader says what they want', body: 'They pick up to three moods and can add a book they loved, a verdict (Perfection / Go for it / Timepass) and a language. In Live Rankings search they type a few words instead.' },
  { title: 'Every review becomes a list of weighted words', body: 'Each published review is turned into words from its genre, traits, title, author, language, verdict and review text, plus hidden "concept tags" so related genres (psychological thriller, suspense, crime) sit close together.' },
  { title: 'Rare words count for more (TF-IDF)', body: 'A word that appears in only a few reviews says more about a review than a word everyone uses, so it gets a higher weight. Repeating a word helps, but with diminishing returns.' },
  { title: 'The reader\'s wishes get the same treatment', body: 'The choices are turned into one weighted list of words, in exactly the same way, so they can be compared with every review.' },
  { title: 'Cosine similarity ranks the library', body: 'Each review is scored by how closely its word list points in the same direction as the reader\'s (0–100%). The top three are shown, each with the reasons it fits.' },
];
const GLOSSARY: { name: string; text: string }[] = [
  { name: 'Field weights', text: 'How many times a word counts when it appears in that field. Genre and traits are set to 3, so a genre match matters three times more than a mention in the review text.' },
  { name: 'Review text weight / words used', text: 'How much the written review matters, and how many of its first words are read. Raising it makes matches depend more on what the reviewer wrote.' },
  { name: 'Concept tag weight', text: 'How strongly the hidden genre-group tags pull related books together. Higher = more "this is also a thriller-type book" matches.' },
  { name: 'Neighbour weight', text: 'How much a book also counts for genres that sit next to its own (for example suspense next to psychological thriller).' },
  { name: 'Sublinear TF', text: 'On: a word used 4 times counts about 2.4×, not 4×. Off: raw counts, so repeated words dominate.' },
  { name: 'IDF mode', text: 'Smooth (live): a gentle rarity boost. Plain: a stronger boost, words in every review drop to almost zero. Off: all words weigh the same, so common words are not discounted.' },
  { name: 'Minimum similarity', text: 'Reviews scoring below this percentage are not shown.' },
];

/** Admin-only: everything Taste Match does that readers never see. Kept next to the code it describes. */
const BACKSTAGE: { title: string; items: string[] }[] = [
  { title: 'Where it runs and what it touches', items: [
    'Everything runs in the reader’s browser over the published reviews already loaded for the page. Matching never writes to Supabase, never stores a reader’s choices and needs no account.',
    'Only published reviews are searched. Drafts, pending and deleted reviews never appear.',
    'The scores readers see are relative ranking scores for that search, not probabilities or ratings.',
  ] },
  { title: 'Building the wish', items: [
    'The typed description, the words behind each chosen mood (up to three) and the profile of the “book I loved” (its genre, traits, language and verdict) are merged into one wish.',
    'Text is normalised first: accents removed, lower-cased, “&” read as “and”, punctuation dropped. Filler words (the, book, novel, want, looking…) are ignored.',
    'Hard filters apply before scoring: the language must match exactly, the verdict filter (Perfection / Go for it / Timepass) must match, and the loved book itself is never suggested back.',
  ] },
  { title: 'Score 1: word similarity (62% of the final score)', items: [
    'Each review becomes a weighted word list from its title, genre, traits, author, language, verdict and the first 600 words of its text. Genre and traits count most.',
    'Rare words count more than common ones (TF-IDF) and repeats count with diminishing returns. The wish gets the same treatment and each review is scored by cosine similarity.',
    'Hidden concept tags group 22 genres (psychological thriller, suspense, crime, mystery, romance, dark romance, fantasy, mythological, dystopian, memoir, self-help…). Neighbouring groups (for example psychological ↔ suspense ↔ crime) pull each other up a little, so “twisty crime” can surface a psychological thriller.',
  ] },
  { title: 'Score 2: the 40 story-feel metrics (38% of the final score)', items: [
    'Forty dimensions such as pace, writing style, atmosphere, emotional resonance, twist predictability, rereadability, poetic weight and post-read hangover, each with its own weight (genre 1.5 is the heaviest; popularity-style metrics 0.2 the lightest).',
    'Text metrics are matched with an F1 word-overlap between what the wish asks for and the cue words found in the review. Numeric metrics read “high” and “low” cue phrases from the review and from the wish and score by closeness (1 − the gap).',
    'A loved book adds its own metric profile: 70% of a metric’s score comes from the typed wish and 30% from the loved book when both exist.',
    'A metric with no evidence in a review is skipped, not counted against it. Only a direct field that exists but does not match (for example a different genre) counts as a real zero.',
    'If the wish has no words, only the metrics decide. If neither has anything, the fallback is rating-based: 80% NL rating plus 20% R/W rating.',
  ] },
  { title: 'Gates, ties and the reasons shown', items: [
    'Relevance gate: a high rating can never turn an unrelated book into a match. Anything under about 1.5% combined similarity is dropped when there is a wish.',
    'Ties are broken by NL rating, then R/W rating, then title.',
    'Reason chips come from the scores: “Echoes your words” (word similarity ≥ 4%), “Shares the story feel” (any metric ≥ 25%), plus Language and Verdict when those filters are on. “Loved by readers” and “Closest fit on the shelf” are the fallbacks.',
    'Surprise me picks randomly from the top 12 matches; with no wish it picks from Perfection / Go for it reviews (in the chosen language).',
  ] },
  { title: 'Where the engine is used', items: [
    'Taste Match page: top three picks for moods, description, loved book, language and verdict.',
    'Live Rankings free-description search: top five.',
    'Review pages, “More like this”: the same engine seeded only with that review as the loved book, top three.',
    'Separate from the engine: exact-first field search (exact 100, known equivalent 92, phrase 85, contained 80, all words 75, typo-tolerant 60), “Did you mean” and nearest-books fall-backs.',
  ] },
  { title: 'Page extras readers see without knowing how they work', items: [
    '“What is Taste Match SE?” numbers (books, authors, genres, languages) are simple distinct counts over the published reviews loaded on the page. Authors and languages are compared case-insensitively; genres use only the first genre listed before a comma, slash or “&”.',
    'Moods are fixed bundles of words and concept tags (see the Settings lab mood buttons). Up to three can be chosen and they are merged into the wish with the typed description.',
    'Language and verdict chips are hard filters, not scores: a review that fails them is removed before ranking.',
    'The poster shown on each result is the review’s poster, falling back to its cover image; Drive links are converted to direct image links and sent without a referrer.',
    'Opening a result goes to that review; no click, search text or mood choice is recorded anywhere.',
  ] },
  { title: 'Author names on cards (2.18)', items: [
    'On author pages and author cards the surname is the large name, because authors are usually known by it (Dostoyevsky, Doyle, Christie). Given and middle names sit smaller before it.',
    'A leading title (Sir, Madam, Mr, Mrs, Miss, Dr, Lord, Lady, Prof and similar) is shown small and is never used as the surname or for the avatar letter.',
    'Name particles stay with the surname (de la Cruz, van Gogh, Le Guin) and suffixes (Jr., III) stay attached to it. A one-word name is shown large as it is.',
    'Reader and profile cards still use the first name as the large name.',
  ] },
  { title: 'Added in 2.16 – 2.17', items: [
    '“Can’t spell it? Find it anyway” search: reads the typed words against title (weight 3), author (2.5) and review text (1.6, scaled by how rare the word is). Allows 1 typo for words of 4–7 letters and 2 for 8+, accepts word starts, ignores filler, and also compares the whole title for near-spellings. Anything under 22% is dropped; at most three results.',
    'Match profile card: a headline from the chosen moods (or the loved book), plus the most common genres and traits among the top picks, shown as chips. It is only a summary of the choices and the picks; it does not feed back into ranking.',
    'Web help when nothing local matches: the typed words are sent to Open Library (after a 600 ms pause) to find the real title. If that spelling matches one of our reviews it is shown; otherwise the real title is named as not reviewed yet. Needs at least 4 characters.',
    'Author page note: Wikipedia (summary and one-line description) and Open Library (other titles, publication years) are queried from the reader’s browser. The Wikipedia page is accepted only if its title contains the author’s name and the text reads like a writer; otherwise nothing is shown. Results are kept in memory for the visit only.',
    'Those two web lookups send the typed text or the author’s name to Wikipedia / Open Library from the reader’s browser, so those sites see the reader’s IP address. Nothing is sent to Novelty Library’s own servers.',
  ] },
];

const fmt = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(1));

/** Admin → Control Settings → Taste Match: what the feature does, and a lab to run the real engine with other settings. */
export function AdminTasteMatchPanel() {
  const published = usePublished();
  const books = useMemo(() => published.map(reviewToSearchBook), [published]);
  const [query, setQuery] = useState('psychological thriller, twisty and dark');
  const [cfg, setCfg] = useState<TfConfig>(DEFAULT_TF_CONFIG);
  const [minScore, setMinScore] = useState(5);
  const [openId, setOpenId] = useState<string | null>(null);

  const readiness = useMemo(() => getTmaiMetricReadiness(books), [books]);
  const changed = JSON.stringify(cfg) !== JSON.stringify(DEFAULT_TF_CONFIG);
  const live = useMemo(() => labSearch(books, query, DEFAULT_TF_CONFIG, minScore, 10), [books, query, minScore]);
  const lab = useMemo(() => labSearch(books, query, cfg, minScore, 10), [books, query, cfg, minScore]);
  const liveRank = useMemo(() => new Map(live.results.map((r, i) => [r.book.id, i + 1])), [live]);

  const setField = (f: FieldKey, v: number) => setCfg((c) => ({ ...c, fieldWeights: { ...c.fieldWeights, [f]: v } }));
  const num = (v: string, min: number, max: number, fallback: number) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback; };

  return (
    <div className="space-y-5">
      <section className="surface-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2"><TasteMatchIcon size={20} style={{ color: 'var(--color-teal-dark)' }} /><h2 className="font-serif text-xl font-semibold">What Taste Match does</h2></div>
            <p className="text-sm mt-1 max-w-3xl" style={{ color: 'var(--color-text-muted)' }}>Taste Match suggests three published reviews that fit what a reader feels like reading, and says why. The TMAI-40 engine powers the dedicated Taste Match page, preference-based “More like this” on review pages, and the free-description suggestions in Live Rankings. Exact-first field search and “Did you mean” remain their own library-search tools. It runs in the reader’s browser over published reviews: no extra server or database change.</p>
          </div>
          <a href="/taste-match" className="btn-ghost !w-auto text-sm"><ExternalLink className="w-4 h-4" /> Open it on the site</a>
        </div>
        <ol className="nl-tmadmin-steps">
          {STEPS.map((s, i) => <li key={s.title}><span>{i + 1}</span><div><strong>{s.title}</strong><p>{s.body}</p></div></li>)}
        </ol>
      </section>

      <section className="surface-card p-5 sm:p-6">
        <div className="flex items-center gap-2"><Layers className="w-5 h-5" style={{ color: 'var(--color-teal-dark)' }} /><h2 className="font-serif text-xl font-semibold">Behind the scenes (admin only)</h2></div>
        <p className="text-sm mt-1 max-w-3xl" style={{ color: 'var(--color-text-muted)' }}>Everything Taste Match does that readers don’t see directly. Readers never see this section or the numbers in it, and the public pages never explain how matching works.</p>
        <div className="nl-tmadmin-dump">
          {BACKSTAGE.map((g, i) => (
            <details key={g.title} open={i === 0}>
              <summary>{g.title}</summary>
              <ul>{g.items.map((t) => <li key={t}>{t}</li>)}</ul>
            </details>
          ))}
          <details>
            <summary>The 40 metrics ({readiness.withCatalogSupport} have evidence in today’s {books.length} reviews · {readiness.metadataOnly} are metadata-only)</summary>
            <div className="overflow-x-auto">
              <table className="nl-shelf-table nl-tmadmin-table">
                <thead><tr><th scope="col">#</th><th scope="col">Metric</th><th scope="col">Weight</th><th scope="col">Reads from</th></tr></thead>
                <tbody>
                  {TMAI40_METRICS.map((m, i) => (
                    <tr key={m.id}>
                      <td>{i + 1}</td>
                      <td>{m.label}</td>
                      <td>{m.weight}</td>
                      <td>{m.metadataOnly ? 'Metadata only (needs a catalog source; skipped for now)' : m.directField ? `The review’s ${m.directField === 'translatedIn' ? 'translation' : m.directField} field, plus wording` : m.kind === 'numeric' ? 'High/low cue phrases in the review wording' : 'Cue phrases in the review wording'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      </section>

      <section className="surface-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><FlaskConical className="w-5 h-5" style={{ color: 'var(--color-teal-dark)' }} /><h2 className="font-serif text-xl font-semibold">Settings lab</h2></div>
            <p className="text-sm mt-1 max-w-3xl" style={{ color: 'var(--color-text-muted)' }}>Runs the real engine on your {books.length} published reviews. Change a setting and compare against the settings the site uses today. <strong>This is a sandbox: nothing here changes what readers see.</strong></p>
          </div>
          <button type="button" className="btn-ghost !w-auto text-sm" onClick={() => { setCfg(DEFAULT_TF_CONFIG); setMinScore(5); }} disabled={!changed && minScore === 5}><RotateCcw className="w-4 h-4" /> Back to live settings</button>
        </div>

        <label className="label mt-5">What a reader wants (type a few words, or tap a mood)</label>
        <input className="input-field" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. romantic and heartbreaking, set in history" aria-label="Taste query" />
        <div className="nl-taste-moods mt-3" role="group" aria-label="Moods">
          {MOODS.map((m) => <button key={m.id} type="button" onClick={() => setQuery(m.words.slice(0, 4).join(' '))} title={m.hint}>{m.label}</button>)}
        </div>

        <div className="nl-tmadmin-grid">
          <fieldset>
            <legend>Field weights</legend>
            {(Object.keys(FIELD_LABELS) as FieldKey[]).map((f) => (
              <label key={f}><span>{FIELD_LABELS[f]}</span><input type="number" step="0.5" min={0} max={8} value={cfg.fieldWeights[f]} onChange={(e) => setField(f, num(e.target.value, 0, 8, cfg.fieldWeights[f]))} className="input-field" /></label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Review text and concepts</legend>
            <label><span>Review text weight</span><input type="number" step="0.25" min={0} max={4} value={cfg.textWeight} onChange={(e) => setCfg({ ...cfg, textWeight: num(e.target.value, 0, 4, cfg.textWeight) })} className="input-field" /></label>
            <label><span>Words of text read</span><input type="number" step="50" min={0} max={1000} value={cfg.textTermLimit} onChange={(e) => setCfg({ ...cfg, textTermLimit: num(e.target.value, 0, 1000, cfg.textTermLimit) })} className="input-field" /></label>
            <label><span>Concept tag weight</span><input type="number" step="0.5" min={0} max={8} value={cfg.conceptWeight} onChange={(e) => setCfg({ ...cfg, conceptWeight: num(e.target.value, 0, 8, cfg.conceptWeight) })} className="input-field" /></label>
            <label><span>Neighbour weight</span><input type="number" step="0.1" min={0} max={3} value={cfg.neighbourWeight} onChange={(e) => setCfg({ ...cfg, neighbourWeight: num(e.target.value, 0, 3, cfg.neighbourWeight) })} className="input-field" /></label>
          </fieldset>
          <fieldset>
            <legend>Scoring</legend>
            <label className="is-check"><input type="checkbox" checked={cfg.sublinear} onChange={(e) => setCfg({ ...cfg, sublinear: e.target.checked })} /><span>Sublinear TF (repeats count less)</span></label>
            <label><span>IDF mode</span>
              <select className="input-field" value={cfg.idf} onChange={(e) => setCfg({ ...cfg, idf: e.target.value as TfConfig['idf'] })}>
                <option value="smooth">Smooth (live)</option><option value="plain">Plain</option><option value="off">Off</option>
              </select></label>
            <label><span>Minimum similarity %</span><input type="number" step="1" min={0} max={90} value={minScore} onChange={(e) => setMinScore(num(e.target.value, 0, 90, minScore))} className="input-field" /></label>
          </fieldset>
        </div>
        <p className="text-xs mt-3" style={{ color: changed ? 'var(--color-teal-dark)' : 'var(--color-text-muted)' }}>{changed ? 'These settings differ from the live site. Arrows show how each review moves compared with the live ranking.' : 'These are the settings the live site uses today.'}</p>
      </section>

      <section className="surface-card p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-3"><Layers className="w-5 h-5" style={{ color: 'var(--color-teal-dark)' }} /><h3 className="font-serif text-lg font-semibold">How the engine read your query</h3></div>
        {lab.queryTerms.length === 0 ? <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{books.length ? 'No words in that query match anything in the library. Try other words.' : 'Loading published reviews…'}</p> : (
          <>
            <p className="text-sm mb-3" style={{ color: 'var(--color-text-muted)' }}>The strongest words (and [concept tags]) in the reader's wish, with their weights after scaling to a length of 1. Library: {lab.reviews} reviews, {lab.vocabularySize} distinct terms.</p>
            <div className="nl-tmadmin-chips">{lab.queryTerms.map((t) => <span key={t.term}>{t.term}<b>{t.weight.toFixed(2)}</b></span>)}</div>
          </>
        )}
      </section>

      <section className="surface-card p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-3"><SlidersHorizontal className="w-5 h-5" style={{ color: 'var(--color-teal-dark)' }} /><h3 className="font-serif text-lg font-semibold">Results</h3></div>
        {lab.results.length === 0 ? <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Nothing reaches {minScore}% similarity. Lower the minimum or change the query.</p> : (
          <div className="overflow-x-auto">
            <table className="nl-shelf-table nl-tmadmin-table">
              <thead><tr><th scope="col">#</th><th scope="col">Review</th><th scope="col">Similarity</th><th scope="col">Live</th><th scope="col">Why (share of the score)</th></tr></thead>
              <tbody>
                {lab.results.map((r, i) => {
                  const was = liveRank.get(r.book.id);
                  const liveScore = live.results.find((x) => x.book.id === r.book.id)?.score;
                  const move = was === undefined ? null : was - (i + 1);
                  return (
                    <tr key={r.book.id} onClick={() => setOpenId(openId === r.book.id ? null : r.book.id)} className="cursor-pointer">
                      <td>{i + 1}</td>
                      <td><strong>{r.book.title}</strong><br /><small style={{ color: 'var(--color-text-muted)' }}>{r.book.author}</small></td>
                      <td><b>{r.score}%</b><span className="nl-tmadmin-bar" style={{ width: `${Math.min(100, r.score)}%` }} /></td>
                      <td>{was === undefined ? <em style={{ color: 'var(--color-text-muted)' }}>new</em> : <span className="nl-tmadmin-move">{move && move > 0 ? <ArrowUp className="w-3.5 h-3.5" style={{ color: '#0a7d4f' }} /> : move && move < 0 ? <ArrowDown className="w-3.5 h-3.5" style={{ color: '#b45309' }} /> : <Minus className="w-3.5 h-3.5" />}#{was} · {liveScore}%</span>}</td>
                      <td><div className="nl-tmadmin-chips is-small">{r.terms.slice(0, openId === r.book.id ? 6 : 3).map((t) => <span key={t.term}>{t.term}<b>{fmt(t.share)}</b></span>)}</div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>Tap a row to see more of the words behind its score. "Live" shows where that review ranks with today's settings.</p>
          </div>
        )}
      </section>

      <section className="surface-card p-5 sm:p-6">
        <h3 className="font-serif text-lg font-semibold mb-3">What each setting means</h3>
        <dl className="nl-tmadmin-gloss">{GLOSSARY.map((g) => <div key={g.name}><dt>{g.name}</dt><dd>{g.text}</dd></div>)}</dl>
      </section>
    </div>
  );
}
