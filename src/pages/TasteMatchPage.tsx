import { useEffect, useState } from 'react';
import { ArrowLeft, Search, Wand2 } from 'lucide-react';
import { RankingSearch, TasteMatchPanel } from '@/components/RankingFinder';
import { loadRankedBooks, bookSlug, type RankedBook } from '@/pages/LiveRankingsPage';

export function TasteMatchPage({ navigate }: { navigate: (path: string) => void }) {
  const [books, setBooks] = useState<RankedBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    loadRankedBooks()
      .then((loaded) => { if (alive) setBooks(loaded); })
      .catch(() => { if (alive) setError(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const openBook = (review: RankedBook['review']) => navigate(`/review/${encodeURIComponent(bookSlug(review))}`);

  return (
    <div className="nl-taste-page container-wide pt-24 pb-20 animate-fade-in">
      <div className="nl-taste-page-inner">
        <button type="button" onClick={() => navigate('/')} className="nl-live-back"><ArrowLeft size={16} aria-hidden="true" /> Back to Home</button>

        <header className="nl-taste-page-hero">
          <span className="nl-taste-page-icon" aria-hidden="true"><Wand2 size={26} /></span>
          <div>
            <span className="nl-live-kicker">NOVELTY LIBRARY · DISCOVERY</span>
            <h1>Taste Match</h1>
            <p>Tell us what you feel like reading, and find published reviews that fit your mood, interests and reading taste.</p>
          </div>
        </header>

        {loading && <div className="nl-live-loading">Loading published reviews…</div>}
        {!loading && error && (
          <div className="nl-live-state">
            <strong>Taste Match couldn't load right now.</strong>
            <span>Please try again in a moment.</span>
            <button type="button" onClick={() => window.location.reload()}>Retry</button>
          </div>
        )}

        {!loading && !error && books.length === 0 && (
          <div className="nl-live-state"><strong>No published reviews yet.</strong><span>Taste Match will appear as books are published.</span></div>
        )}

        {!loading && !error && books.length > 0 && (
          <div className="nl-taste-page-content">
            <TasteMatchPanel books={books} openBook={openBook} />
            <RankingSearch books={books} openBook={openBook} />
          </div>
        )}

        <section className="nl-taste-about" aria-labelledby="nl-taste-about-title">
          <div className="nl-taste-about-icon"><Search size={16} aria-hidden="true" /></div>
          <div>
            <h2 id="nl-taste-about-title">About Taste Match</h2>
            <p>Taste Match looks through published Novelty Library reviews and compares their genres, traits, verdicts, ratings and review text with what you choose. It is a quick way to discover a book that feels right for you.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
