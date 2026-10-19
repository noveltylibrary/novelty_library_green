import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ExternalLink, FlaskConical, Layers, Minus, RotateCcw, Sparkles, Wand2 } from 'lucide-react';
import { DEFAULT_TF_CONFIG, MOODS, labSearch, type FieldKey, type TfConfig } from '@/lib/rankingSearch';
import { reviewToSearchBook, usePublished } from '@/lib/readerTools';

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

const fmt = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(1));

/** Admin → Control Settings → Taste Match: what the feature does, and a lab to run the real engine with other settings. */
export function AdminTasteMatchPanel() {
  const published = usePublished();
  const books = useMemo(() => published.map(reviewToSearchBook), [published]);
  const [query, setQuery] = useState('psychological thriller, twisty and dark');
  const [cfg, setCfg] = useState<TfConfig>(DEFAULT_TF_CONFIG);
  const [minScore, setMinScore] = useState(5);
  const [openId, setOpenId] = useState<string | null>(null);

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
            <div className="flex items-center gap-2"><Wand2 className="w-5 h-5" style={{ color: 'var(--color-teal-dark)' }} /><h2 className="font-serif text-xl font-semibold">What Taste Match does</h2></div>
            <p className="text-sm mt-1 max-w-3xl" style={{ color: 'var(--color-text-muted)' }}>Taste Match suggests three published reviews that fit what a reader feels like reading, and says why. The same engine also powers Live Rankings search, "More like this" on review pages, and "Did you mean" suggestions. It runs in the reader's browser over the published reviews: no extra server, no database change.</p>
          </div>
          <a href="#/taste-match" className="btn-ghost !w-auto text-sm"><ExternalLink className="w-4 h-4" /> Open it on the site</a>
        </div>
        <ol className="nl-tmadmin-steps">
          {STEPS.map((s, i) => <li key={s.title}><span>{i + 1}</span><div><strong>{s.title}</strong><p>{s.body}</p></div></li>)}
        </ol>
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
        <div className="flex items-center gap-2 mb-3"><Sparkles className="w-5 h-5" style={{ color: 'var(--color-teal-dark)' }} /><h3 className="font-serif text-lg font-semibold">Results</h3></div>
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
