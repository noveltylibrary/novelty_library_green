import { BookMarked, Plus, Trash2 } from 'lucide-react';
import { SHELF_MAX_ITEMS, SHELF_META, readShelf, packShelf, type ShelfItem, type ShelfKind } from '@/lib/shelves';

/** Profile display: a shelf as a small table (# / Book / Author). */
export function ShelfTable({ kind, value, isPrivate = false }: { kind: ShelfKind; value: unknown; isPrivate?: boolean }) {
  const items = readShelf(value);
  if (!items.length) return null;
  const meta = SHELF_META[kind];
  return (
    <section className="surface-card nl-shelf" aria-label={meta.title}>
      <p className="nl-shelf-eyebrow"><BookMarked className="w-3.5 h-3.5" aria-hidden="true" /> {meta.eyebrow}{isPrivate && <span className="nl-cr-private">Only you</span>}</p>
      <h3 className="nl-shelf-title">{meta.title}</h3>
      <table className="nl-shelf-table">
        <thead><tr><th scope="col">#</th><th scope="col">Book</th><th scope="col">Author</th></tr></thead>
        <tbody>
          {items.map((it, i) => <tr key={`${it.title}-${i}`}><td>{i + 1}</td><td><strong>{it.title}</strong></td><td>{it.author || '—'}</td></tr>)}
        </tbody>
      </table>
    </section>
  );
}

/** Editor: add up to 5 books as table rows. */
export function ShelfEditor({ kind, value, onChange }: { kind: ShelfKind; value: unknown; onChange: (v: unknown) => void }) {
  const meta = SHELF_META[kind];
  const items = readShelf(value, true);
  // Half-typed rows stay while editing; the display side drops rows without a title.
  const set = (next: ShelfItem[]) => onChange(packShelf(next, true));
  const update = (i: number, patch: Partial<ShelfItem>) => set(items.map((it, n) => (n === i ? { ...it, ...patch } : it)));

  return (
    <div className="nl-shelf-editor">
      <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>{meta.hint} Up to {SHELF_MAX_ITEMS} books.</p>
      {items.length > 0 && (
        <table className="nl-shelf-table is-edit">
          <thead><tr><th scope="col">#</th><th scope="col">Book</th><th scope="col">Author</th><th scope="col"><span className="sr-only">Remove</span></th></tr></thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td><input className="input-field" aria-label={`Book ${i + 1} title`} maxLength={120} value={it.title} onChange={(e) => update(i, { title: e.target.value })} placeholder="Book name" /></td>
                <td><input className="input-field" aria-label={`Book ${i + 1} author`} maxLength={80} value={it.author} onChange={(e) => update(i, { author: e.target.value })} placeholder="Author" /></td>
                <td><button type="button" aria-label={`Remove book ${i + 1}`} onClick={() => set(items.filter((_, n) => n !== i))} className="nl-shelf-x"><Trash2 className="w-4 h-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <button type="button" disabled={items.length >= SHELF_MAX_ITEMS} onClick={() => set([...items, { title: '', author: '' }])} className="nl-shelf-add">
        <Plus className="w-4 h-4" /> Add a book
      </button>
    </div>
  );
}
