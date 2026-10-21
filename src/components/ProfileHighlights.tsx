import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronLeft, ChevronRight, Clock3, ImagePlus, Plus, Trash2, X, Camera, Archive } from 'lucide-react';
import { deleteHighlight, fetchArchive, fetchHighlights, MAX_HIGHLIGHTS, MAX_HIGHLIGHT_ITEMS, removeHighlightItem, saveToHighlight, setHighlightCover, STORY_RETENTION_NOTE, type ArchiveStory, type Highlight } from '@/lib/social';
import { sanitizeUserText } from '@/lib/sanitize';
import { useOverlayHistory } from '@/lib/overlayHistory';

const SLIDE_MS = 5000;
const fmtDay = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); };

/** Instagram-style highlights row. Shown under the followers bar; the owner can add, edit and delete. */
export function ProfileHighlights({ userId, isOwn }: { userId: string; isOwn: boolean }) {
  const [list, setList] = useState<Highlight[] | null>(null);
  const [viewer, setViewer] = useState<{ h: number; i: number } | null>(null);
  const [picker, setPicker] = useState<{ target?: string } | null>(null);
  const [coverFor, setCoverFor] = useState<string | null>(null);

  const load = useCallback(() => { fetchHighlights(userId).then(setList).catch(() => setList([])); }, [userId]);
  useEffect(() => { load(); }, [load]);

  if (list === null) return null;
  if (!list.length && !isOwn) return null;
  const canAdd = isOwn && list.length < MAX_HIGHLIGHTS;

  return (
    <section className="nl-hl" aria-label="Story highlights">
      <div className="nl-hl-head"><div><span className="nl-hl-eyebrow"><Camera aria-hidden="true" /> STORIES</span><h2>Highlights</h2></div>{list.length > 4 && <span className="nl-hl-scroll-hint">Swipe to see more</span>}</div>
      <div className="nl-hl-row">
        {list.map((h, idx) => (
          <button key={h.id} type="button" className="nl-hl-item" onClick={() => h.items.length ? setViewer({ h: idx, i: 0 }) : isOwn && setPicker({ target: h.id })} aria-label={`Open highlight ${h.title}`}>
            <span className="nl-hl-ring"><span className="nl-hl-cover">{(h.cover_url || h.items[0]) ? <img src={h.cover_url || h.items[0].image_url} alt="" loading="lazy" /> : <ImagePlus aria-hidden="true" />}</span></span>
            <span className="nl-hl-title">{sanitizeUserText(h.title, 24)}</span>
          </button>
        ))}
        {canAdd && (
          <button type="button" className="nl-hl-item nl-hl-new" onClick={() => setPicker({})} aria-haspopup="dialog">
            <span className="nl-hl-ring"><span className="nl-hl-cover"><Plus aria-hidden="true" /></span></span>
            <span className="nl-hl-title">New</span>
          </button>
        )}
      </div>
      {isOwn && <p className="nl-hl-note"><Clock3 aria-hidden="true" /> {STORY_RETENTION_NOTE}</p>}
      {viewer && list[viewer.h] && <HighlightViewer list={list} pos={viewer} setPos={setViewer} isOwn={isOwn} onChanged={load} onAdd={(id) => { setViewer(null); setPicker({ target: id }); }} onCover={(id) => { setViewer(null); setCoverFor(id); }} />}
      {coverFor && list.find((x) => x.id === coverFor) && <CoverPicker userId={userId} highlight={list.find((x) => x.id === coverFor)!} onClose={() => setCoverFor(null)} onSaved={load} />}
      {picker && <HighlightPicker userId={userId} targetId={picker.target} onClose={() => setPicker(null)} onSaved={load} />}
    </section>
  );
}

function HighlightViewer({ list, pos, setPos, isOwn, onChanged, onAdd, onCover }: { list: Highlight[]; pos: { h: number; i: number }; setPos: (p: { h: number; i: number } | null) => void; isOwn: boolean; onChanged: () => void; onAdd: (highlightId: string) => void; onCover: (highlightId: string) => void }) {
  const h = list[pos.h];
  const item = h?.items[pos.i];
  const [busy, setBusy] = useState(false);
  useOverlayHistory(true, () => setPos(null));
  const posRef = useRef(pos); posRef.current = pos;

  const next = useCallback(() => {
    const p = posRef.current; const cur = list[p.h];
    if (!cur) { setPos(null); return; }
    if (p.i < cur.items.length - 1) setPos({ h: p.h, i: p.i + 1 });
    else { const nh = list.findIndex((x, n) => n > p.h && x.items.length > 0); setPos(nh >= 0 ? { h: nh, i: 0 } : null); }
  }, [list, setPos]);
  const prev = () => { if (pos.i > 0) setPos({ h: pos.h, i: pos.i - 1 }); else { for (let n = pos.h - 1; n >= 0; n--) if (list[n].items.length) { setPos({ h: n, i: list[n].items.length - 1 }); return; } } };

  useEffect(() => { const t = window.setTimeout(next, SLIDE_MS); return () => window.clearTimeout(t); }, [pos.h, pos.i, next]);
  useEffect(() => {
    const prevOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPos(null); if (e.key === 'ArrowRight') next(); if (e.key === 'ArrowLeft') prev(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prevOverflow; window.removeEventListener('keydown', onKey); };
  }); // eslint-disable-line react-hooks/exhaustive-deps

  if (!h || !item) return null;
  const run = async (fn: () => Promise<void>) => { if (busy) return; setBusy(true); try { await fn(); onChanged(); } catch { /* leave as is */ } finally { setBusy(false); } };

  return createPortal(
    <div className="nl-story-viewer" role="dialog" aria-modal="true" aria-label={`Highlight ${h.title}`} onClick={() => setPos(null)}>
      <div className="nl-story-viewer-card" onClick={(e) => e.stopPropagation()}>
        <div className="nl-hl-bars" aria-hidden="true">{h.items.map((it, n) => <span key={it.id} className={n < pos.i ? 'is-done' : n === pos.i ? 'is-now' : ''}><i key={`${pos.h}-${pos.i}`} /></span>)}</div>
        <button className="nl-story-close" onClick={() => setPos(null)} aria-label="Close highlight"><X className="w-5 h-5" /></button>
        <img src={item.image_url} alt={item.caption || h.title} />
        <button type="button" className="nl-story-nav nl-story-nav-prev" onClick={prev} aria-label="Previous"><ChevronLeft className="w-5 h-5" /></button>
        <button type="button" className="nl-story-nav nl-story-nav-next" onClick={next} aria-label="Next"><ChevronRight className="w-5 h-5" /></button>
        <div className="nl-story-viewer-meta"><strong>{sanitizeUserText(h.title, 24)}</strong>{item.story_created_at && <div className="flex items-center gap-2 mt-1"><Clock3 className="w-3.5 h-3.5" /> {fmtDay(item.story_created_at)}</div>}{item.caption && <p>{sanitizeUserText(item.caption, 240)}</p>}</div>
        {isOwn && (
          <div className="nl-story-actions">
            <button type="button" className="nl-story-action" disabled={busy || h.items.length >= MAX_HIGHLIGHT_ITEMS} onClick={() => onAdd(h.id)}><Plus className="w-4 h-4" /> Add</button>
            <button type="button" className="nl-story-action" disabled={busy} onClick={() => onCover(h.id)}><ImagePlus className="w-4 h-4" /> Cover</button>
            <button type="button" className="nl-story-action" disabled={busy} onClick={() => void run(async () => { await removeHighlightItem(item); setPos(null); })}><Trash2 className="w-4 h-4" /> Remove photo</button>
            <button type="button" className="nl-story-action" disabled={busy} onClick={() => { if (window.confirm(`Delete the highlight "${h.title}" and its photos?`)) void run(async () => { await deleteHighlight(h); setPos(null); }); }}><Trash2 className="w-4 h-4" /> Delete</button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** "From archive": the reader's stories from the last 30 days, to add to a new or existing highlight. */
export function HighlightPicker({ userId, targetId, preselect, onClose, onSaved }: { userId: string; targetId?: string; preselect?: string[]; onClose: () => void; onSaved?: () => void }) {
  const [archive, setArchive] = useState<ArchiveStory[] | null>(null);
  useOverlayHistory(true, onClose);
  const [mine, setMine] = useState<Highlight[]>([]);
  const [target, setTarget] = useState<string>(targetId || 'new');
  const [title, setTitle] = useState('');
  const [sel, setSel] = useState<string[]>(preselect ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchArchive(userId).then((a) => { if (alive) setArchive(a); }).catch(() => { if (alive) { setArchive([]); setError('Could not load your archive.'); } });
    fetchHighlights(userId).then((h) => { if (alive) { setMine(h); if (!targetId && h.length >= MAX_HIGHLIGHTS) setTarget(h[0].id); } }).catch(() => undefined);
    return () => { alive = false; };
  }, [userId, targetId]);
  useEffect(() => {
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [busy, onClose]);

  const current = mine.find((h) => h.id === target);
  const already = new Set((current?.items ?? []).map((i) => i.source_story_id).filter(Boolean) as string[]);
  const room = current ? MAX_HIGHLIGHT_ITEMS - current.items.length : MAX_HIGHLIGHT_ITEMS;
  const toggle = (id: string) => setSel((s) => s.includes(id) ? s.filter((x) => x !== id) : s.length >= room ? s : [...s, id]);
  const chosen = (archive ?? []).filter((s) => sel.includes(s.id) && !already.has(s.id));

  const save = async () => {
    if (busy || !chosen.length) return;
    setBusy(true); setError(null);
    try {
      await saveToHighlight(userId, target === 'new' ? { title } : { id: target }, chosen);
      onSaved?.(); onClose();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save the highlight.'); } finally { setBusy(false); }
  };

  return createPortal(
    <div className="nl-conn-backdrop" onClick={() => !busy && onClose()}>
      <div className="nl-conn-modal nl-hlp" role="dialog" aria-modal="true" aria-label="Add to highlight" onClick={(e) => e.stopPropagation()}>
        <div className="nl-conn-top"><h2 className="nl-hlp-h"><Archive aria-hidden="true" /> From archive</h2><button type="button" className="nl-conn-x" onClick={onClose} disabled={busy} aria-label="Close"><X aria-hidden="true" /></button></div>
        <div className="nl-hlp-body">
          <p className="nl-hl-note"><Clock3 aria-hidden="true" /> {STORY_RETENTION_NOTE}</p>
          <div className="nl-hlp-target">
            <label htmlFor="nl-hlp-sel">Add to</label>
            <select id="nl-hlp-sel" className="input-field" value={target} onChange={(e) => { setTarget(e.target.value); setError(null); }} disabled={busy}>
              <option value="new" disabled={mine.length >= MAX_HIGHLIGHTS}>+ New highlight{mine.length >= MAX_HIGHLIGHTS ? ` (max ${MAX_HIGHLIGHTS})` : ''}</option>
              {mine.map((h) => <option key={h.id} value={h.id}>{sanitizeUserText(h.title, 24)} ({h.items.length})</option>)}
            </select>
            {target === 'new' && <input className="input-field" value={title} onChange={(e) => setTitle(e.target.value.slice(0, 24))} placeholder="Highlight name (e.g. Book hauls)" maxLength={24} disabled={busy} aria-label="Highlight name" />}
          </div>
          {archive === null ? <p className="nl-conn-empty">Loading…</p> : archive.length === 0 ? <p className="nl-conn-empty">No stories in the last 30 days. Share a story first.</p> : (
            <ul className="nl-hlp-grid">
              {archive.map((s) => {
                const isIn = already.has(s.id); const on = sel.includes(s.id) && !isIn;
                return (
                  <li key={s.id}>
                    <button type="button" className={`nl-hlp-cell ${on ? 'is-on' : ''}`} disabled={isIn || busy} onClick={() => toggle(s.id)} aria-pressed={on} aria-label={`Story from ${fmtDay(s.created_at)}${isIn ? ' (already added)' : ''}`}>
                      {s.image_url ? <img src={s.image_url} alt="" loading="lazy" /> : <ImagePlus aria-hidden="true" />}
                      <span className="nl-hlp-date">{fmtDay(s.created_at)}{s.live ? ' · live' : ''}</span>
                      {(on || isIn) && <span className="nl-hlp-tick"><Check aria-hidden="true" /></span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {error && <p className="nl-story-modal-error" role="alert">{error}</p>}
        </div>
        <div className="nl-hlp-foot">
          <span>{chosen.length} selected{room < MAX_HIGHLIGHT_ITEMS ? ` · room for ${room}` : ''}</span>
          <button type="button" className="nl-follow-btn" disabled={busy || !chosen.length || (target === 'new' && !title.trim())} onClick={() => void save()}>{busy ? 'Saving…' : 'Add to highlight'}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}


/** Choose a highlight's cover from the 30-day archive or from the device gallery. */
function CoverPicker({ userId, highlight, onClose, onSaved }: { userId: string; highlight: Highlight; onClose: () => void; onSaved: () => void }) {
  const [archive, setArchive] = useState<ArchiveStory[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useOverlayHistory(true, onClose);
  useEffect(() => {
    let alive = true;
    fetchArchive(userId).then((a) => { if (alive) setArchive(a); }).catch(() => { if (alive) { setArchive([]); setError('Could not load your archive.'); } });
    return () => { alive = false; };
  }, [userId]);
  const apply = async (source: { story: ArchiveStory } | { file: File }) => {
    if (busy) return; setBusy(true); setError(null);
    try { await setHighlightCover(userId, highlight, source); onSaved(); onClose(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not set the cover.'); } finally { setBusy(false); }
  };
  return createPortal(
    <div className="nl-conn-backdrop" onClick={() => !busy && onClose()}>
      <div className="nl-conn-modal nl-hlp" role="dialog" aria-modal="true" aria-label="Choose highlight cover" onClick={(e) => e.stopPropagation()}>
        <div className="nl-conn-top"><h2 className="nl-hlp-h"><ImagePlus aria-hidden="true" /> Cover for {sanitizeUserText(highlight.title, 24)}</h2><button type="button" className="nl-conn-x" onClick={onClose} disabled={busy} aria-label="Close"><X aria-hidden="true" /></button></div>
        <div className="nl-hlp-body">
          <div className="nl-hlp-target">
            <label>From gallery</label>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void apply({ file: f }); }} />
            <button type="button" className="nl-hlp-upload" disabled={busy} onClick={() => fileRef.current?.click()}><ImagePlus aria-hidden="true" /> Choose a photo from your gallery</button>
          </div>
          <div className="nl-hlp-target"><label>From archive</label></div>
          {archive === null ? <p className="nl-conn-empty">Loading…</p> : archive.length === 0 ? <p className="nl-conn-empty">No stories in the last 30 days.</p> : (
            <ul className="nl-hlp-grid">
              {archive.map((s) => (
                <li key={s.id}><button type="button" className="nl-hlp-cell" disabled={busy} onClick={() => void apply({ story: s })} aria-label={`Use story from ${fmtDay(s.created_at)} as cover`}>{s.image_url ? <img src={s.image_url} alt="" loading="lazy" /> : <ImagePlus aria-hidden="true" />}<span className="nl-hlp-date">{fmtDay(s.created_at)}</span></button></li>
              ))}
            </ul>
          )}
          {error && <p className="nl-story-modal-error" role="alert">{error}</p>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
