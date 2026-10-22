import { BookOpen, ExternalLink } from 'lucide-react';
import { useAuthorBio } from '@/lib/authorBio';
import { sanitizeUserText } from '@/lib/sanitize';

/** Short "about the author" note from public sources. Renders nothing when no information is found. */
export function AuthorBioBlock({ name, reviewedTitles }: { name: string; reviewedTitles: string[] }) {
  const { bio, loading } = useAuthorBio(name, reviewedTitles);
  if (loading) return <div className="nl-bio nl-bio-loading" aria-hidden="true"><span /><span /><span /></div>;
  if (!bio) return null;
  return (
    <section className="nl-bio" aria-label={`About ${name}`}>
      <span className="nl-bio-kicker"><BookOpen size={14} aria-hidden="true" /> ABOUT THE AUTHOR</span>
      {(bio.description || bio.years) && (
        <p className="nl-bio-era">{[bio.description && sanitizeUserText(bio.description, 120), bio.years && `Published ${bio.years}`].filter(Boolean).join(' · ')}</p>
      )}
      {bio.summary && <p className="nl-bio-text">{sanitizeUserText(bio.summary, 600)}</p>}
      {bio.otherBooks.length > 0 && (
        <p className="nl-bio-more"><b>Also wrote</b> {bio.otherBooks.map((t) => sanitizeUserText(t, 80)).join(' · ')}</p>
      )}
      <small className="nl-bio-src">
        Source: {bio.url ? <a href={bio.url} target="_blank" rel="noopener noreferrer">Wikipedia <ExternalLink size={11} aria-hidden="true" /></a> : null}{bio.url ? ' and ' : ''}<a href="https://openlibrary.org" target="_blank" rel="noopener noreferrer">Open Library <ExternalLink size={11} aria-hidden="true" /></a>
      </small>
    </section>
  );
}
