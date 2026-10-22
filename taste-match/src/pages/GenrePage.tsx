import { useMemo } from 'react';
import { CoverImg } from '@/components/CoverImg';
import { ArrowLeft, BookOpen, Library } from 'lucide-react';
import type { Review } from '@/types/review';
import { reviewPath, usePublished } from '@/lib/readerTools';
import { VerdictBanner } from '@/components/VerdictBanner';
import { normalizeVerdict } from '@/lib/verdict';
import { sanitizeUserText } from '@/lib/sanitize';

export const genreKey = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export const genrePath = (name: string): string => `/genre/${encodeURIComponent(name.trim())}`;
/** "Self-Help/ Non-Fiction" belongs to both "self help" and "non fiction"; a plain genre is its own single key. */
const keysOf = (genre: string): string[] => [...new Set([genreKey(genre), ...genre.split(/[,;/|]+/).map(genreKey)].filter(Boolean))];

type GenreInfo = { key: string; label: string; count: number };

/** Genre page (`/genre/Thriller`): an automatic intro from real numbers, every review in that genre, and other genres to browse. */
export function GenrePage({ genre, navigate }: { genre: string; navigate: (path: string) => void }) {
  const all = usePublished();
  const key = genreKey(genre);

  const genres = useMemo<GenreInfo[]>(() => {
    const m = new Map<string, { count: number; spellings: Map<string, number> }>();
    for (const r of all) {
      const parts = (r.genre || '').split(/[,;/|]+/).map((p) => p.trim()).filter(Boolean);
      for (const p of new Set([...(parts.length > 1 ? parts : []), (r.genre || '').trim()].filter(Boolean))) {
        const k = genreKey(p);
        if (!k) continue;
        const e = m.get(k) ?? { count: 0, spellings: new Map() };
        e.count += 1;
        e.spellings.set(p, (e.spellings.get(p) ?? 0) + 1);
        m.set(k, e);
      }
    }
    return [...m.entries()].map(([k, e]) => ({ key: k, count: e.count, label: [...e.spellings.entries()].sort((a, b) => b[1] - a[1])[0][0] })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [all]);

  const books = useMemo<Review[]>(() => (key ? all.filter((r) => keysOf(r.genre || '').includes(key)).sort((a, b) => (b.rw_rating || 0) - (a.rw_rating || 0)) : []), [all, key]);
  const label = genres.find((g) => g.key === key)?.label || genre;

  const intro = useMemo(() => {
    if (!books.length) return '';
    const authors = new Set(books.map((b) => (b.author || '').trim().toLowerCase()).filter(Boolean)).size;
    const langs = [...new Set(books.map((b) => (b.language || '').trim()).filter(Boolean))];
    const avg = books.reduce((n, b) => n + (Number.isFinite(b.rw_rating) ? b.rw_rating : 0), 0) / books.length;
    const v = { perfection: 0, go_for_it: 0, timepass: 0 };
    books.forEach((b) => { const x = normalizeVerdict(b.verdict); if (x) v[x] += 1; });
    const top = books[0];
    const bits = [
      `${books.length} ${label} review${books.length === 1 ? '' : 's'} by readers on Novelty Library${authors > 1 ? `, covering ${authors} authors` : ''}${langs.length ? ` in ${langs.slice(0, 3).join(', ')}` : ''}.`,
      `The average reviewer score is ${avg.toFixed(1)} out of 10.`,
      v.perfection || v.go_for_it ? `${[v.perfection ? `${v.perfection} marked Perfection` : '', v.go_for_it ? `${v.go_for_it} marked Go for it` : ''].filter(Boolean).join(' and ')}.` : '',
      top ? `Highest rated: ${top.title} by ${top.author} (${Number.isFinite(top.rw_rating) ? top.rw_rating.toFixed(1) : '—'}/10).` : '',
    ];
    return bits.filter(Boolean).join(' ');
  }, [books, label]);

  const others = genres.filter((g) => g.key !== key).slice(0, 18);

  return (
    <div className="pt-24 pb-20 container-prose animate-fade-in">
      <button type="button" onClick={() => { if (window.history.length > 1) window.history.back(); else navigate('/reviews'); }} className="nl-qv-link inline-flex items-center gap-1.5 mb-6"><ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back</button>
      <header className="nl-author-head">
        <span className="nl-author-icon"><Library aria-hidden="true" /></span>
        <div>
          <span className="nl-live-kicker">GENRE</span>
          <h1 className="font-serif text-3xl md:text-4xl font-semibold" style={{ color: 'var(--color-text)' }}>{key ? sanitizeUserText(label, 80) : 'Browse by genre'}</h1>
          {intro && <p className="mt-2 text-sm leading-relaxed max-w-2xl" style={{ color: 'var(--color-text-muted)' }}>{intro}</p>}
          {!key && <p className="mt-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>Pick a genre to see every review in it.</p>}
        </div>
      </header>

      {key && all.length > 0 && books.length === 0 && <p className="nl-find-hint">No published reviews in this genre yet. Try one of the genres below.</p>}
      <ul className="nl-find-list">
        {books.map((r) => {
          const cover = r.poster_url || r.cover_image_url;
          return (
            <li key={r.id} className="nl-find-result">
              <button type="button" className="nl-find-result-main" onClick={() => navigate(reviewPath(r))} aria-label={`Open review of ${r.title}`}>
                <span className="nl-find-cover"><CoverImg src={cover} /></span>
                <span className="nl-find-copy">
                  <strong>{sanitizeUserText(r.title, 120)}</strong>
                  <small>{sanitizeUserText(r.author, 80)}{r.language ? ` · ${sanitizeUserText(r.language, 30)}` : ''}</small>
                  {r.verdict && <span className="nl-find-why"><VerdictBanner verdict={r.verdict} size="compact" /></span>}
                </span>
              </button>
              <span className="nl-find-score"><b>{Number.isFinite(r.rw_rating) ? r.rw_rating.toFixed(1) : '—'}</b><small>R/W</small></span>
            </li>
          );
        })}
      </ul>

      {others.length > 0 && (
        <section className="nl-genre-more" aria-label="Other genres">
          <h2 className="font-serif text-xl font-semibold" style={{ color: 'var(--color-text)' }}>{key ? 'Other genres' : 'All genres'}</h2>
          <div className="nl-genre-chips">
            {(key ? others : genres).map((g) => <button key={g.key} type="button" onClick={() => navigate(genrePath(g.label))}>{sanitizeUserText(g.label, 40)} <small>{g.count}</small></button>)}
          </div>
        </section>
      )}
    </div>
  );
}
