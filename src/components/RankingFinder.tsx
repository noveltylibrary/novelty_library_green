import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { CoverImg } from '@/components/CoverImg';
import { BookOpen, ChevronDown, Dices, Fingerprint, Search, Target, X } from 'lucide-react';
import { TasteMatchIcon } from '@/components/TasteMatchIcon';
import type { Review } from '@/types/review';
import { VERDICTS, normalizeVerdict, type Verdict } from '@/lib/verdict';
import { rankTmai40 } from '@/lib/tmai40Engine';
import { rememberedSearch } from '@/lib/rememberedSearch';
import { useBookHints } from '@/lib/authorBio';
import {
  FIELD_LABELS, FIELD_PLACEHOLDERS, MOODS, cleanTraits, norm, popularValues, didYouMean, nearestBooks, runSearch,
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
    translatedIn: r.translated_from || null,
    seriesName: r.series_name || null,
    seriesNumber: r.series_number ?? null,
    goodreadsRating: r.goodreads_rating ?? null,
    amazonRating: r.amazon_rating ?? null,
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
        <span className="nl-find-cover"><CoverImg src={cover} /></span>
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
  // The free-description field also invokes TMAI-40, while the structured field keeps its exact-first behaviour.
  const tasteMatches = useMemo(() => norm(deferredMore)
    ? rankTmai40(searchBooks, { description: deferredMore }, 5)
    : [], [searchBooks, deferredMore]);

  const clear = () => { setStrictQ(''); setMoreQ(''); };

  return (
    <section className="nl-find" aria-labelledby="nl-find-title">
      <header className="nl-find-head">
        <span className="nl-find-icon"><Search size={18} aria-hidden="true" /></span>
        <div>
          <span className="nl-live-kicker">SEARCH THE LIBRARY</span>
          <h2 id="nl-find-title">Find your next read</h2>
          <p>Search by a specific detail, then add the feeling or story qualities you want. Your extra description helps find wider matches and reflects the Taste Match idea: matching books to your reading taste, not just a single keyword.</p>
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
        <span>More detail <em>· describe your taste for Taste Match</em></span>
        <input type="text" value={moreQ} onChange={(e) => setMoreQ(e.target.value)} placeholder="Describe the story you want — e.g. a dark, slow-burn mystery with mind games, layered characters, and a haunting atmosphere" autoComplete="off" />
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

      {active && picks.length > 0 && (
        <aside className="nl-taste-dna" aria-label="Your match profile">
          <span className="nl-taste-dna-kicker"><Fingerprint size={14} aria-hidden="true" /> YOUR MATCH PROFILE</span>
          <h3>{profile.headline}</h3>
          {(profile.genres.length > 0 || profile.traits.length > 0) && <p>Leaning towards {profile.genres.length ? profile.genres.join(' and ') : 'a mix of genres'}{profile.traits.length ? `, with ${profile.traits.slice(0, 3).join(', ')} running through it` : ''}.</p>}
          <div className="nl-taste-dna-chips">
            {profile.loved && <span>Because you loved {profile.loved.title}</span>}
            {language && <span>{language}</span>}
            {verdicts.map((v) => <span key={v}>{VERDICTS.find((x) => x.value === v)?.label ?? v}</span>)}
            {profile.traits.map((t) => <span key={t}>{t}</span>)}
          </div>
        </aside>
      )}

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
        {norm(deferredMore) && <ResultGroup
          title="Taste Match suggestions"
          hint="Taste Match SE weighs your description against the clues available in each review and explains why certain books rise to the top. Scores are relative matches, not probabilities."
          matches={tasteMatches}
          byId={byId}
          openBook={openBook}
        />}
      </div>
    </section>
  );
}

/** Taste match: pick moods (and optionally a book you loved) and get three picks with a reason. */
export function TasteMatchPanel({ books, openBook }: CommonProps) {
  const [description, setDescription] = useState('');
  const deferredDescription = useDeferredValue(description);
  const [moods, setMoods] = useState<string[]>([]);
  const [lovedId, setLovedId] = useState('');
  const [language, setLanguage] = useState('');
  const [verdicts, setVerdicts] = useState<Verdict[]>([]);
  const [remembered, setRemembered] = useState('');
  const deferredRemembered = useDeferredValue(remembered);

  // Legacy #/live-rankings#taste links now route here; scroll past the page header to the matcher.
  useEffect(() => {
    if (!window.location.hash.endsWith('#taste')) return;
    const id = window.setTimeout(() => document.getElementById('nl-taste')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 400);
    return () => window.clearTimeout(id);
  }, []);

  const searchBooks = useMemo(() => books.map(toSearchBook), [books]);
  const byId = useMemo(() => new Map(books.map((b) => [b.review.id, b])), [books]);
  const languages = useMemo(() => popularValues(searchBooks, 'language', 12), [searchBooks]);
  const titles = useMemo(() => [...searchBooks].sort((a, b) => a.title.localeCompare(b.title)), [searchBooks]);
  const picks = useMemo(() => rankTmai40(searchBooks, { description: deferredDescription, moods, lovedId, language, verdicts }, 3), [searchBooks, deferredDescription, moods, lovedId, language, verdicts]);
  const rememberedHits = useMemo(() => rememberedSearch(searchBooks, deferredRemembered, 3), [searchBooks, deferredRemembered]);
  // Nothing local? Ask the public web what was probably meant; if that spelling matches one of our reviews, show it.
  const hints = useBookHints(deferredRemembered, !!norm(deferredRemembered) && rememberedHits.length === 0);
  const hintHits = useMemo(() => {
    const seen = new Set<string>(); const out: Match[] = [];
    for (const h of hints) for (const m of rememberedSearch(searchBooks, `${h.title} ${h.author}`, 1)) {
      if (m.score >= 60 && !seen.has(m.book.id)) { seen.add(m.book.id); out.push({ ...m, reasons: [`Looks like “${h.title}”${h.author ? ` by ${h.author}` : ''}`] }); }
    }
    return out.slice(0, 3);
  }, [hints, searchBooks]);
  const notReviewed = useMemo(() => hints.filter((h) => !hintHits.some((m) => norm(m.book.title) === norm(h.title))).slice(0, 2), [hints, hintHits]);
  /** The reader's taste in plain words: their choices plus what the best matches have in common. */
  const profile = useMemo(() => {
    const chosen = moods.map((id) => MOODS.find((m) => m.id === id)?.label).filter((x): x is string => !!x);
    const loved = searchBooks.find((b) => b.id === lovedId);
    const count = (values: string[]) => { const m = new Map<string, number>(); values.forEach((v) => { const k = v.trim(); if (k) m.set(k, (m.get(k) ?? 0) + 1); }); return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k); };
    const genres = count(picks.map((p) => (p.book.genre || '').split(/[,/&]/)[0])).slice(0, 2);
    const traits = count(picks.flatMap((p) => cleanTraits(p.book.traits).split(',').map((t) => t.trim().toLowerCase()))).slice(0, 4);
    const headline = chosen.length ? chosen.join(' · ') : loved ? `Readers of ${loved.title}` : 'Your taste, in your words';
    return { chosen, loved, genres, traits, headline };
  }, [moods, lovedId, picks, searchBooks]);
  const active = !!description.trim() || moods.length > 0 || !!lovedId || !!language || verdicts.length > 0;
  const verdictCounts = useMemo(() => {
    const c: Record<Verdict, number> = { perfection: 0, go_for_it: 0, timepass: 0 };
    searchBooks.forEach((b) => { const v = normalizeVerdict(b.verdict); if (v) c[v] += 1; });
    return c;
  }, [searchBooks]);
  /** Random pick: from the current matches when something is chosen, else from the strongest verdicts. */
  const surprise = () => {
    let pool = active ? rankTmai40(searchBooks, { description, moods, lovedId, language, verdicts }, 12).map((m) => m.book) : [];
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
        <span className="nl-find-icon nl-taste-icon"><TasteMatchIcon size={30} animate /></span>
        <div>
          <span className="nl-live-kicker">TASTE MATCH SE · PERSONAL DISCOVERY</span>
          <h2 id="nl-taste-title">Find a read that matches your taste</h2>
          <p>Describe the book you want, choose up to three moods, or add a book you loved. Our matching reads the feel of every published review and brings the closest ones to you.</p>
        </div>
      </header>

      <div className="nl-find-field nl-find-wide nl-taste-remember">
        <label htmlFor="nl-taste-remember-input"><span>Can&rsquo;t spell it? Find it anyway <em>· half-remembered titles, typos, details</em></span></label>
        <span className="nl-taste-remember-box"><Search size={16} aria-hidden="true" /><input id="nl-taste-remember-input" type="search" value={remembered} onChange={(e) => setRemembered(e.target.value)} maxLength={200} placeholder="e.g. harry poter, or “that book with the octopus”" autoComplete="off" spellCheck={false} /></span>
        {norm(deferredRemembered) && (
          (rememberedHits.length === 0 && hintHits.length === 0)
            ? <p className="nl-find-hint">No review sounds like that yet.{notReviewed.length > 0 ? ` You may mean ${notReviewed.map((h) => `“${h.title}”${h.author ? ` by ${h.author}` : ''}${h.year ? ` (${h.year})` : ''}`).join(' or ')}, which hasn't been reviewed here yet.` : ' Try a different detail: a character, a place, the author, or a word from the title.'}</p>
            : <ul className="nl-find-list">
                {(rememberedHits.length ? rememberedHits : hintHits).map((m) => {
                  const item = byId.get(m.book.id);
                  if (!item) return null;
                  return (
                    <li key={m.book.id} className="nl-find-result">
                      <button type="button" className="nl-find-result-main" onClick={() => openBook(item.review)} aria-label={`Open review of ${item.review.title}`}>
                        <span className="nl-find-cover"><CoverImg src={item.review.poster_url || item.review.cover_image_url} /></span>
                        <span className="nl-find-copy"><strong>{item.review.title}</strong><small>{item.review.author || 'Author unavailable'}</small><span className="nl-taste-why"><Search size={13} aria-hidden="true" /> {m.reasons.join(' · ')}</span></span>
                      </button>
                      <span className="nl-find-score"><b>{item.nlRating == null ? '—' : item.nlRating.toFixed(1)}</b><small>NL</small></span>
                    </li>
                  );
                })}
              </ul>
        )}
      </div>

      <label className="nl-find-field nl-find-wide nl-taste-description">
        <span>Describe your ideal read <em>· natural language</em></span>
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} maxLength={500} placeholder="e.g. A dense, haunting psychological thriller with philosophical ideas, political twists and an unsettling atmosphere" />
      </label>

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
        {!active && <p className="nl-find-hint">Describe your ideal read, choose a mood, pick a book you loved, or filter by language or verdict to see your matches.</p>}
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
                        <span className="nl-find-cover"><CoverImg src={cover} /></span>
                        <span className="nl-find-copy">
                          <strong>{item.review.title}</strong>
                          <small>{item.review.author || 'Author unavailable'}</small>
                          <span className="nl-taste-why"><Target size={13} aria-hidden="true" /> {m.score > 0 && <><b className="nl-find-pct">{Math.round(m.score)}% match</b> · </>}<b>{m.score > 0 ? 'Why it fits you:' : 'Why it is here:'}</b> {m.reasons.join(' · ')}</span>
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
    </section>
  );
}
