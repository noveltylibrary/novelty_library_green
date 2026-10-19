import { useDeferredValue, useMemo, useState } from 'react';
import { BookOpen, ChevronDown, Dices, Search, Sparkles, Wand2, X } from 'lucide-react';
import type { Review } from '@/types/review';
import { VERDICTS, normalizeVerdict, type Verdict } from '@/lib/verdict';
import {
  FIELD_LABELS, FIELD_PLACEHOLDERS, MOODS, cleanTraits, norm, popularValues, didYouMean, nearestBooks, runSearch, tasteMatch,
  type Match, type SearchBook, type SearchField,
} from '@/lib/rankingSearch';

export type FinderBook = { review: Review; nlRating: number | null };

export function toSearchBook(item: FinderBook): SearchBook {
  const r = item.review;
  return {
    id: r.id,
    title: r.title || '',
    author: r.author || '',
    genre: r.genre || '',
    language: r.language || '',
    traits: cleanTraits(r.traits),
    verdict: r.verdict || '',
    text: (r.review_text || '').slice(0, 4000),
    nl: item.nlRating,
    rw: Number.isFinite(r.rw_rating) ? r.rw_rating : 0,
  };
}

interface CommonProps {
  books: FinderBook[];
  openBook: (review: Review) => void;
}

function ResultCard({ match, byId, openBook, badge }: { match: Match; byId: Map<string, FinderBook>; openBook: (r: Review) => void; badge?: string }) {
  const item = byId.get(match.book.id);
  if (!item) return null;
  const { review, nlRating } = item;
  const cover = review.poster_url || review.cover_image_url;
  return (
    <li className="nl-find-result">
      <button type="button" className="nl-find-result-main" onClick={() => openBook(review)} aria-label={`Open review of ${review.title}`}>
        <span className="nl-find-cover">{cover ? <img src={cover} alt="" loading="lazy" /> : <BookOpen aria-hidden="true" />}</span>
        <span className="nl-find-copy">
          <strong>{review.title}</strong>
          <small>{review.author || 'Author unavailable'}</small>
          {(match.reasons.length > 0 || !badge) && (
            <span className="nl-find-why">{!badge && <i className="nl-find-pct">{Math.round(match.score)}% match</i>}{match.reasons.map((r) => <i key={r}>{r}</i>)}</span>
          )}
        </span>
      </button>
      <span className="nl-find-score" aria-label={`NL rating ${nlRating == null ? 'not available' : nlRating.toFixed(1)}`}>
        {badge && <em className={`nl-find-badge${badge === 'Exact' ? ' is-exact' : ''}`}>{badge}</em>}
        <b>{nlRating == null ? '—' : nlRating.toFixed(1)}</b>
        <small>NL</small>
      </span>
    </li>
  );
}

function ResultGroup({ title, hint, matches, byId, openBook, badgeFor }: { title: string; hint: string; matches: Match[]; byId: Map<string, FinderBook>; openBook: (r: Review) => void; badgeFor?: (m: Match) => string | undefined }) {
  const [all, setAll] = useState(false);
  if (!matches.length) return null;
  const shown = all ? matches : matches.slice(0, 5);
  return (
    <div className="nl-find-group">
      <div className="nl-find-group-head"><h3>{title} <span>{matches.length}</span></h3><p>{hint}</p></div>
      <ul className="nl-find-list">{shown.map((m) => <ResultCard key={m.book.id} match={m} byId={byId} openBook={openBook} badge={badgeFor?.(m)} />)}</ul>
      {matches.length > 5 && <button type="button" className="nl-find-more" onClick={() => setAll((v) => !v)}>{all ? 'Show fewer' : `Show all ${matches.length}`}</button>}
    </div>
  );
}

/** Search the library: row 1 = exact-first search on one field, row 2 = free words matched more widely. */
export function RankingSearch({ books, openBook }: CommonProps) {
  const [field, setField] = useState<SearchField>('genre');
  const [strictQ, setStrictQ] = useState('');
  const [moreQ, setMoreQ] = useState('');
  const deferredStrict = useDeferredValue(strictQ);
  const deferredMore = useDeferredValue(moreQ);

  const searchBooks = useMemo(() => books.map(toSearchBook), [books]);
  const byId = useMemo(() => new Map(books.map((b) => [b.review.id, b])), [books]);
  const quick = useMemo(() => popularValues(searchBooks, field, 6), [searchBooks, field]);
  const outcome = useMemo(() => runSearch(searchBooks, field, deferredStrict, deferredMore), [searchBooks, field, deferredStrict, deferredMore]);
  const active = !!norm(strictQ) || !!norm(moreQ);
  const nothing = active && outcome.direct.length === 0 && outcome.related.length === 0;
  const suggestions = useMemo(() => (norm(deferredStrict) && !outcome.direct.some((m) => m.exact) ? didYouMean(searchBooks, field, deferredStrict) : []), [outcome, searchBooks, field, deferredStrict]);
  const nearest = useMemo(() => (nothing ? nearestBooks(searchBooks, deferredStrict, deferredMore) : null), [nothing, searchBooks, deferredStrict, deferredMore]);

  const clear = () => { setStrictQ(''); setMoreQ(''); };

  return (
    <section className="nl-find" aria-labelledby="nl-find-title">
      <header className="nl-find-head">
        <span className="nl-find-icon"><Search size={18} aria-hidden="true" /></span>
        <div>
          <span className="nl-live-kicker">SEARCH THE LIBRARY</span>
          <h2 id="nl-find-title">Find your next read</h2>
          <p>Row 1 looks for the exact word first. Row 2 reads your own words and brings back wider, related picks.</p>
        </div>
      </header>

      <div className="nl-find-row">
        <label className="nl-find-field">
          <span>Search by</span>
          <span className="nl-find-select">
            <select value={field} onChange={(e) => setField(e.target.value as SearchField)} aria-label="Search by">
              {(Object.keys(FIELD_LABELS) as SearchField[]).map((f) => <option key={f} value={f}>{FIELD_LABELS[f]}</option>)}
            </select>
            <ChevronDown size={16} aria-hidden="true" />
          </span>
        </label>
        <label className="nl-find-field">
          <span>{FIELD_LABELS[field]} <em>· exact match first</em></span>
          <input type="text" value={strictQ} onChange={(e) => setStrictQ(e.target.value)} placeholder={FIELD_PLACEHOLDERS[field]} autoComplete="off" spellCheck={false} />
        </label>
      </div>

      <label className="nl-find-field nl-find-wide">
        <span>More detail <em>· wider keyword match</em></span>
        <input type="text" value={moreQ} onChange={(e) => setMoreQ(e.target.value)} placeholder="Tell us more about your search — e.g. dark, mind games, detective" autoComplete="off" />
      </label>

      <div className="nl-find-tools">
        {quick.length > 0 && (
          <div className="nl-find-quick" aria-label={`Popular ${FIELD_LABELS[field].toLowerCase()} searches`}>
            <span>Try:</span>
            {quick.map((q) => <button key={q} type="button" onClick={() => setStrictQ(q)} className={norm(q) === norm(strictQ) ? 'is-on' : ''}>{q}</button>)}
          </div>
        )}
        {active && <button type="button" className="nl-find-clear" onClick={clear}><X size={14} aria-hidden="true" /> Clear</button>}
      </div>

      <div className="nl-find-results" aria-live="polite">
        {!active && <p className="nl-find-hint">Start typing above. Results appear as you type, with the reason each book matched.</p>}
        {nothing && <p className="nl-find-hint">No exact match for that yet.</p>}
        {suggestions.length > 0 && (
          <p className="nl-find-hint nl-find-dym">Did you mean{' '}
            {suggestions.map((sug, i) => <span key={sug}>{i > 0 && ', '}<button type="button" onClick={() => setStrictQ(sug)}>{sug}</button></span>)}?
          </p>
        )}
        {nothing && nearest && (
          <ResultGroup
            title={nearest.fallback ? 'Readers love these' : 'Closest we have'}
            hint={nearest.fallback ? 'Nothing is close to your words, so here are top-rated picks.' : 'The nearest books to what you typed.'}
            matches={nearest.matches}
            byId={byId}
            openBook={openBook}
            badgeFor={nearest.fallback ? () => 'Top rated' : undefined}
          />
        )}
        <ResultGroup
          title="Direct matches"
          hint={`Exact ${FIELD_LABELS[field].toLowerCase()} first, then close ones.`}
          matches={outcome.direct}
          byId={byId}
          openBook={openBook}
          badgeFor={(m) => (m.exact ? 'Exact' : 'Close')}
        />
        <ResultGroup
          title={outcome.mode === 'description' ? 'Matches for your words' : 'Related picks'}
          hint={outcome.mode === 'description' ? 'Best keyword matches across title, author, genre and traits.' : 'Wider variants: related genres and nearby words.'}
          matches={outcome.related}
          byId={byId}
          openBook={openBook}
        />
      </div>
    </section>
  );
}

/** Taste match: pick moods (and optionally a book you loved) and get three picks with a reason. */
export function TasteMatchPanel({ books, openBook }: CommonProps) {
  const [moods, setMoods] = useState<string[]>([]);
  const [lovedId, setLovedId] = useState('');
  const [language, setLanguage] = useState('');
  const [verdicts, setVerdicts] = useState<Verdict[]>([]);

  const searchBooks = useMemo(() => books.map(toSearchBook), [books]);
  const byId = useMemo(() => new Map(books.map((b) => [b.review.id, b])), [books]);
  const languages = useMemo(() => popularValues(searchBooks, 'language', 12), [searchBooks]);
  const titles = useMemo(() => [...searchBooks].sort((a, b) => a.title.localeCompare(b.title)), [searchBooks]);
  const picks = useMemo(() => tasteMatch(searchBooks, { moods, lovedId, language, verdicts }, 3), [searchBooks, moods, lovedId, language, verdicts]);
  const active = moods.length > 0 || !!lovedId || verdicts.length > 0;
  const verdictCounts = useMemo(() => {
    const c: Record<Verdict, number> = { perfection: 0, go_for_it: 0, timepass: 0 };
    searchBooks.forEach((b) => { const v = normalizeVerdict(b.verdict); if (v) c[v] += 1; });
    return c;
  }, [searchBooks]);
  /** Random pick: from the current matches when something is chosen, else from the strongest verdicts. */
  const surprise = () => {
    let pool = active ? tasteMatch(searchBooks, { moods, lovedId, language, verdicts }, 12).map((m) => m.book) : [];
    if (!pool.length) {
      pool = searchBooks.filter((b) => { const v = normalizeVerdict(b.verdict); return (v === 'perfection' || v === 'go_for_it') && (!language || b.language === language); });
    }
    if (!pool.length) pool = searchBooks;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    const item = pick ? byId.get(pick.id) : null;
    if (item) openBook(item.review);
  };
  const toggleVerdict = (v: Verdict) => setVerdicts((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));

  const toggle = (id: string) => setMoods((cur) => (cur.includes(id) ? cur.filter((m) => m !== id) : cur.length >= 3 ? [...cur.slice(1), id] : [...cur, id]));

  return (
    <section id="nl-taste" className="nl-find nl-taste" aria-labelledby="nl-taste-title">
      <header className="nl-find-head">
        <span className="nl-find-icon nl-taste-icon"><Wand2 size={18} aria-hidden="true" /></span>
        <div>
          <span className="nl-live-kicker">TASTE MATCH</span>
          <h2 id="nl-taste-title">Tonight, you want something…</h2>
          <p>Pick up to three moods. Add a book you loved if you like, and we'll suggest three reads with the reason each one fits.</p>
        </div>
      </header>

      <div className="nl-taste-moods" role="group" aria-label="Moods">
        {MOODS.map((m) => (
          <button key={m.id} type="button" className={moods.includes(m.id) ? 'is-on' : ''} onClick={() => toggle(m.id)} aria-pressed={moods.includes(m.id)} title={m.hint}>{m.label}</button>
        ))}
      </div>

      <div className="nl-taste-verdicts" role="group" aria-label="Reviewer verdict">
        <span className="nl-taste-verdicts-label">Verdict <em>· optional</em></span>
        {VERDICTS.map((v) => (
          <button key={v.value} type="button" className={verdicts.includes(v.value) ? 'is-on' : ''} onClick={() => toggleVerdict(v.value)} aria-pressed={verdicts.includes(v.value)} title={v.blurb} disabled={verdictCounts[v.value] === 0}>
            {v.label} <small>{verdictCounts[v.value]}</small>
          </button>
        ))}
        {verdicts.length > 0 && <button type="button" className="nl-find-clear" onClick={() => setVerdicts([])}>Any verdict</button>}
      </div>

      <div className="nl-find-row">
        <label className="nl-find-field">
          <span>A book you loved <em>· optional</em></span>
          <span className="nl-find-select">
            <select value={lovedId} onChange={(e) => setLovedId(e.target.value)}>
              <option value="">No preference</option>
              {titles.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
            </select>
            <ChevronDown size={16} aria-hidden="true" />
          </span>
        </label>
        <label className="nl-find-field">
          <span>Language <em>· optional</em></span>
          <span className="nl-find-select">
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="">Any language</option>
              {languages.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <ChevronDown size={16} aria-hidden="true" />
          </span>
        </label>
      </div>

      <div className="nl-taste-surprise">
        <button type="button" onClick={surprise} disabled={!books.length}><Dices size={16} aria-hidden="true" /> Surprise me</button>
        <span>{active ? 'Picks one great read that fits your choices.' : 'Picks a Perfection or Go for it review at random.'}</span>
      </div>

      <div className="nl-find-results" aria-live="polite">
        {!active && <p className="nl-find-hint">Choose a mood or a verdict to see your picks.</p>}
        {active && picks.length === 0 && <p className="nl-find-hint">Nothing fits that mix yet. Try another mood, or remove the language or verdict filter.</p>}
        {picks.length > 0 && (
          <ul className="nl-find-list">
            {picks.map((m, i) => (
              <li key={m.book.id} className="nl-find-result nl-taste-pick">
                <span className="nl-taste-rank" aria-hidden="true">{i + 1}</span>
                {(() => {
                  const item = byId.get(m.book.id);
                  if (!item) return null;
                  const cover = item.review.poster_url || item.review.cover_image_url;
                  return (
                    <>
                      <button type="button" className="nl-find-result-main" onClick={() => openBook(item.review)} aria-label={`Open review of ${item.review.title}`}>
                        <span className="nl-find-cover">{cover ? <img src={cover} alt="" loading="lazy" /> : <BookOpen aria-hidden="true" />}</span>
                        <span className="nl-find-copy">
                          <strong>{item.review.title}</strong>
                          <small>{item.review.author || 'Author unavailable'}</small>
                          <span className="nl-taste-why"><Sparkles size={13} aria-hidden="true" /> {m.score > 0 && <><b className="nl-find-pct">{Math.round(m.score)}% match</b> · </>}<b>{m.score > 0 ? 'Why it fits you:' : 'Why it is here:'}</b> {m.reasons.join(' · ')}</span>
                        </span>
                      </button>
                      <span className="nl-find-score"><b>{item.nlRating == null ? '—' : item.nlRating.toFixed(1)}</b><small>NL</small></span>
                    </>
                  );
                })()}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="nl-taste-note">Picks are matched on genre, traits, verdict, ratings and what each review says. Reviews published before verdicts were added are left out while a verdict is chosen.</p>
    </section>
  );
}
