import { ArrowLeft } from 'lucide-react';

/** The "← Back" link used at the top of author, genre and reviewer pages: previous page, or `fallback` when there is none. */
export function BackButton({ navigate, fallback = '/reviews' }: { navigate: (path: string) => void; fallback?: string }) {
  return (
    <button type="button" onClick={() => { if (window.history.length > 1) window.history.back(); else navigate(fallback); }} className="nl-qv-link inline-flex items-center gap-1.5 mb-4">
      <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back
    </button>
  );
}
