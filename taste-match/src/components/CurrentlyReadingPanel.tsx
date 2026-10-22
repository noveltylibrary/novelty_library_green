import { useRef, useState, type ChangeEvent } from 'react';
import { BookMarked, BookOpen, ImagePlus, Loader2, Lock, Trash2 } from 'lucide-react';
import { prepareImageForUpload, uploadProfileQuestionImage } from '@/lib/imageUpload';
import { CURRENTLY_READING_KEY, packCurrentlyReading, readCurrentlyReading } from '@/lib/currentlyReading';

/** Profile display: the book a reader is on right now, with an optional cover. */
export function CurrentlyReadingPanel({ title, author = '', cover, publishedReviewCount, isPrivate = false }: { title: string; author?: string; cover: string | null; publishedReviewCount?: number; isPrivate?: boolean }) {
  if (!title && !cover) return null;
  return (
    <section className="surface-card nl-cr-panel" aria-label="Currently reading">
      <div className="nl-cr-cover" aria-hidden={!cover}>
        {cover ? <img src={cover} alt={title ? `Cover of ${title}` : 'Book cover'} loading="lazy" /> : <BookOpen className="w-7 h-7" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="nl-cr-headline">
          <p className="nl-cr-eyebrow"><span className="nl-cr-live" aria-hidden="true" /> Currently reading{isPrivate && <span className="nl-cr-private"><Lock className="w-3 h-3" /> Only you</span>}</p>
          {typeof publishedReviewCount === 'number' && <span className="nl-cr-published-count"><BookMarked className="w-3.5 h-3.5" aria-hidden="true" /> <strong>{publishedReviewCount}</strong> published {publishedReviewCount === 1 ? 'review' : 'reviews'}</span>}
        </div>
        <h3 className="nl-cr-title">{title || 'A book'}</h3>
        {author.trim() && <p className="nl-cr-author">by {author.trim()}</p>}
      </div>
    </section>
  );
}

/** Editor: book name + optional cover, saved inside the "Currently Reading" answer. */
export function CurrentlyReadingEditor({ value, userId, onChange }: { value: unknown; userId: string; onChange: (v: unknown) => void }) {
  const { title, author, cover } = readCurrentlyReading(value, true);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true); setError(null);
    try {
      const prepared = await prepareImageForUpload(file, 1200, 1800);
      const up = await uploadProfileQuestionImage(prepared, userId, CURRENTLY_READING_KEY, { maxWidth: 1200, maxHeight: 1800 });
      onChange(packCurrentlyReading(title, up.publicUrl, author));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cover upload failed.');
    } finally { setUploading(false); }
  };

  return (
    <div className="nl-cr-editor">
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={pick} className="hidden" />
      <button type="button" className="nl-cr-drop" onClick={() => inputRef.current?.click()} disabled={uploading} aria-label={cover ? 'Change book cover' : 'Add a book cover (optional)'}>
        {cover ? <img src={cover} alt="Your current book cover" /> : uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <><ImagePlus className="w-6 h-6" /><span>Cover<br />(optional)</span></>}
        {cover && uploading && <span className="nl-cr-busy"><Loader2 className="w-6 h-6 animate-spin" /></span>}
      </button>
      <div className="min-w-0 flex-1 space-y-2">
        <input
          value={title}
          maxLength={120}
          onChange={(e) => onChange(packCurrentlyReading(e.target.value, cover, author))}
          placeholder="Book name — e.g. The Midnight Library"
          className="input-field"
          aria-label="Book you are currently reading"
        />
        <input
          value={author}
          maxLength={100}
          onChange={(e) => onChange(packCurrentlyReading(title, cover, e.target.value))}
          placeholder="Author name — e.g. Matt Haig (optional)"
          className="input-field"
          aria-label="Author of the book you are currently reading"
        />
        <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          <span>Book title and author appear on your public profile.</span>
          {cover && <button type="button" onClick={() => onChange(packCurrentlyReading(title, null, author))} className="inline-flex items-center gap-1 font-semibold" style={{ color: 'var(--color-teal-dark)' }}><Trash2 className="w-3.5 h-3.5" /> Remove cover</button>}
        </div>
        {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
      </div>
    </div>
  );
}
