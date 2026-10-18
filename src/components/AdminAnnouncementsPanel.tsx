import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { AlertCircle, ArrowDown, ArrowUp, CheckCircle2, FileText, ImagePlus, Link2, Loader2, Megaphone, Save, Trash2 } from 'lucide-react';
import { FeaturedPosters } from '@/components/FeaturedPosters';
import {
  DEFAULT_ANNOUNCEMENTS, MAX_POSTERS, RECOMMENDED_POSTERS, POSTER_WIDTH, POSTER_HEIGHT, POSTER_HTML_EXAMPLE,
  BUILTIN_KEYS, BUILTIN_LABEL, DEFAULT_BUILTINS, blankPoster, cleanBadge, weekRange, cleanPosterLink, POSTER_BADGES, fetchAnnouncements, parsePosterHtml, saveAnnouncements, uploadPosterImage,
  type AnnouncementsConfig, type BuiltinKey, type BuiltinPoster, type Poster,
} from '@/lib/announcements';
import { getErrorMessage } from '@/lib/format';

/** Admin → Announcements: upload the wide featured posters shown on Home, attach links, or paste HTML to import them. */
export function AdminAnnouncementsPanel() {
  const [cfg, setCfg] = useState<AnnouncementsConfig>(DEFAULT_ANNOUNCEMENTS);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [html, setHtml] = useState('');
  const addRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const replaceId = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchAnnouncements().then((c) => { if (alive) setCfg(c); }).catch((e) => { if (alive) setMsg({ kind: 'err', text: getErrorMessage(e, 'Could not load the saved posters.') }); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const edit = (next: AnnouncementsConfig) => { setCfg(next); setDirty(true); setMsg(null); };
  const setPoster = (id: string, patch: Partial<Poster>) => edit({ ...cfg, posters: cfg.posters.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  const move = (i: number, d: -1 | 1) => {
    const j = i + d; if (j < 0 || j >= cfg.posters.length) return;
    const posters = [...cfg.posters]; [posters[i], posters[j]] = [posters[j], posters[i]];
    edit({ ...cfg, posters });
  };
  const setBuiltin = (key: BuiltinKey, patch: Partial<BuiltinPoster>) => edit({ ...cfg, builtins: { ...cfg.builtins, [key]: { ...cfg.builtins[key], ...patch } } });
  const remaining = MAX_POSTERS - cfg.posters.length;

  const addFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = (Array.from(e.target.files ?? []) as File[]).slice(0, Math.max(0, remaining));
    e.target.value = '';
    if (!files.length) return;
    setUploading(true); setMsg(null);
    const added: Poster[] = [];
    try {
      for (const f of files) added.push(blankPoster(await uploadPosterImage(f)));
    } catch (err) {
      setMsg({ kind: 'err', text: getErrorMessage(err, 'Upload failed.') });
    } finally {
      setUploading(false);
      if (added.length) edit({ ...cfg, posters: [...cfg.posters, ...added] });
    }
  };

  const replaceFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; const id = replaceId.current;
    e.target.value = '';
    if (!f || !id) return;
    setUploading(true); setMsg(null);
    try { setPoster(id, { image: await uploadPosterImage(f) }); }
    catch (err) { setMsg({ kind: 'err', text: getErrorMessage(err, 'Upload failed.') }); }
    finally { setUploading(false); }
  };

  const importHtml = () => {
    const parsed = parsePosterHtml(html);
    if (!parsed.length) { setMsg({ kind: 'err', text: 'No poster found. Each poster needs an https image (see the example).' }); return; }
    const existing = new Set(cfg.posters.map((p) => p.image));
    const fresh = parsed.filter((p) => !existing.has(p.image)).slice(0, remaining);
    if (!fresh.length) { setMsg({ kind: 'err', text: remaining <= 0 ? `You already have ${MAX_POSTERS} posters — remove one first.` : 'Those posters are already in the list.' }); return; }
    edit({ ...cfg, posters: [...cfg.posters, ...fresh] });
    setHtml('');
    setMsg({ kind: 'ok', text: `Added ${fresh.length} poster${fresh.length === 1 ? '' : 's'} from the HTML${parsed.length > fresh.length ? ` (${parsed.length - fresh.length} skipped: duplicate or over the ${MAX_POSTERS} limit)` : ''}. Review, then Save.` });
  };

  const save = async () => {
    const badBuiltin = BUILTIN_KEYS.find((k) => cfg.builtins[k].link && !cleanPosterLink(cfg.builtins[k].link));
    if (badBuiltin) { setMsg({ kind: 'err', text: `The link on the ${BUILTIN_LABEL[badBuiltin]} poster must start with https:// (or be an in-app path like /reviews).` }); return; }
    const badDates = [...cfg.posters, ...BUILTIN_KEYS.map((k) => cfg.builtins[k])].find((p) => p.from && p.until && p.until < p.from);
    if (badDates) { setMsg({ kind: 'err', text: 'A poster ends before it starts. Check the From and Until dates.' }); return; }
    const badLink = cfg.posters.find((p) => p.link && !cleanPosterLink(p.link));
    if (badLink) { setMsg({ kind: 'err', text: `The link on "${badLink.title || 'a poster'}" must start with https:// (or be an in-app path like /reviews).` }); return; }
    setSaving(true); setMsg(null);
    try { setCfg(await saveAnnouncements(cfg)); setDirty(false); setMsg({ kind: 'ok', text: 'Saved. The Home page now shows these posters.' }); }
    catch (err) { setMsg({ kind: 'err', text: getErrorMessage(err, 'Could not save.') }); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="surface-card p-6 text-sm" style={{ color: 'var(--color-text-muted)' }}><Loader2 className="w-4 h-4 inline animate-spin mr-2" />Loading announcements…</div>;

  return (
    <div className="space-y-5">
      <input ref={addRef} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={addFiles} className="hidden" />
      <input ref={replaceRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={replaceFile} className="hidden" />

      <section className="surface-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2"><Megaphone className="w-5 h-5" style={{ color: 'var(--color-teal-dark)' }} /><h2 className="font-serif text-xl font-semibold">Featured posters</h2></div>
            <p className="text-sm mt-1 max-w-2xl" style={{ color: 'var(--color-text-muted)' }}>
              Shown on Home between the Submit / Reviews buttons and the shortcut cards. Wide format <strong>{POSTER_WIDTH}×{POSTER_HEIGHT} (16:9)</strong>, JPG/PNG/WebP up to 5 MB. Up to <strong>{MAX_POSTERS}</strong> posters; <strong>{RECOMMENDED_POSTERS}</strong> is recommended.
            </p>
          </div>
          <button type="button" className="btn-primary !w-auto" onClick={save} disabled={saving || !dirty}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
          </button>
        </div>
        {msg && <p className="mt-3 text-sm flex items-start gap-2" role="status" style={{ color: msg.kind === 'ok' ? 'var(--color-cyan-dark)' : '#b91c1c' }}>{msg.kind === 'ok' ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}{msg.text}</p>}

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={cfg.enabled} onChange={(e) => edit({ ...cfg, enabled: e.target.checked })} /> Show on Home</label>
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={cfg.autoplay} onChange={(e) => edit({ ...cfg, autoplay: e.target.checked })} /> Auto-slide</label>
          <div><label className="label">Slide every</label>
            <select className="input-field" value={cfg.intervalSec} onChange={(e) => edit({ ...cfg, intervalSec: Number(e.target.value) })} disabled={!cfg.autoplay}>
              {[4, 6, 8, 10, 15].map((s) => <option key={s} value={s}>{s} seconds</option>)}
            </select></div>
          <div><label className="label">Section heading</label><input className="input-field" maxLength={60} value={cfg.heading} onChange={(e) => edit({ ...cfg, heading: e.target.value })} /></div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {BUILTIN_KEYS.map((key) => {
            const b = cfg.builtins[key];
            const d = DEFAULT_BUILTINS[key];
            return (
              <div key={key} className="rounded-xl p-4 space-y-2.5" style={{ background: 'var(--color-paper)', border: '1px solid var(--color-border)' }}>
                <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={b.enabled} onChange={(e) => setBuiltin(key, { enabled: e.target.checked })} /> Show the built-in <strong>{BUILTIN_LABEL[key]}</strong> poster</label>
                <input className="input-field" maxLength={90} value={b.title} onChange={(e) => setBuiltin(key, { title: e.target.value })} placeholder="Title" aria-label={`${BUILTIN_LABEL[key]} poster title`} disabled={!b.enabled} />
                <input className="input-field" maxLength={160} value={b.caption} onChange={(e) => setBuiltin(key, { caption: e.target.value })} placeholder="Short caption" aria-label={`${BUILTIN_LABEL[key]} poster caption`} disabled={!b.enabled} />
                <div className="relative"><Link2 className="field-icon" /><input className="input-field pl-10" value={b.link} onChange={(e) => setBuiltin(key, { link: e.target.value })} placeholder="Link — https://… or /live-rankings" aria-label={`${BUILTIN_LABEL[key]} poster link`} disabled={!b.enabled} /></div>
                <select className="input-field" value={b.badge} onChange={(e) => setBuiltin(key, { badge: cleanBadge(e.target.value) })} aria-label={`${BUILTIN_LABEL[key]} poster badge`} disabled={!b.enabled}>
                  {POSTER_BADGES.map((x) => <option key={x || 'none'} value={x}>{x ? `Badge: ${x}` : 'No badge'}</option>)}
                </select>
                <DateRange from={b.from} until={b.until} disabled={!b.enabled} onChange={(patch) => setBuiltin(key, patch)} />
                {b.link && !cleanPosterLink(b.link) && <p className="text-xs" style={{ color: '#b91c1c' }}>Link must start with https:// or be an in-app path.</p>}
                <button type="button" className="text-xs font-semibold underline" style={{ color: 'var(--color-teal-dark)' }} onClick={() => setBuiltin(key, { ...d, enabled: b.enabled })}>Reset wording and link to default</button>
              </div>
            );
          })}
          <p className="text-xs lg:col-span-2" style={{ color: 'var(--color-text-muted)' }}>These two posters come first in the strip and do not count toward the {MAX_POSTERS} posters. Leave both dates empty to keep a poster on all the time.</p>
        </div>
      </section>

      <section className="surface-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="font-serif text-lg font-semibold">Posters <span className="text-sm font-normal" style={{ color: 'var(--color-text-muted)' }}>{cfg.posters.length} / {MAX_POSTERS}{cfg.posters.length > RECOMMENDED_POSTERS ? ` · more than the recommended ${RECOMMENDED_POSTERS}` : ''}</span></h3>
          <button type="button" className="btn-primary !w-auto" onClick={() => addRef.current?.click()} disabled={uploading || remaining <= 0}>
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />} Upload posters
          </button>
        </div>

        {cfg.posters.length === 0 && <p className="text-sm py-6 text-center rounded-2xl" style={{ background: 'var(--color-paper)', border: '1px dashed var(--color-border)', color: 'var(--color-text-muted)' }}>No posters yet. Upload wide images, or import them from HTML below.</p>}

        <div className="space-y-3">
          {cfg.posters.map((p, i) => (
            <article key={p.id} className="rounded-2xl p-3 sm:p-4 grid gap-3 sm:grid-cols-[13rem_1fr_auto]" style={{ background: 'var(--color-paper)', border: '1px solid var(--color-border)' }}>
              <button type="button" className="relative block aspect-video rounded-xl overflow-hidden group" onClick={() => { replaceId.current = p.id; replaceRef.current?.click(); }} aria-label="Replace poster image">
                <img src={p.image} alt="" className="w-full h-full object-cover" />
                <span className="absolute inset-0 grid place-items-center text-xs font-bold text-white bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity">Replace image</span>
              </button>
              <div className="min-w-0 space-y-2">
                <input className="input-field" maxLength={90} value={p.title} onChange={(e) => setPoster(p.id, { title: e.target.value })} placeholder="Title — e.g. Reader of the Month" aria-label="Poster title" />
                <input className="input-field" maxLength={160} value={p.caption} onChange={(e) => setPoster(p.id, { caption: e.target.value })} placeholder="Short caption (optional)" aria-label="Poster caption" />
                <div className="relative"><Link2 className="field-icon" /><input className="input-field pl-10" value={p.link} onChange={(e) => setPoster(p.id, { link: e.target.value })} placeholder="Link — https://… or /reviews (optional)" aria-label="Poster link" /></div>
                <select className="input-field" value={p.badge} onChange={(e) => setPoster(p.id, { badge: cleanBadge(e.target.value) })} aria-label="Poster badge">
                  {POSTER_BADGES.map((b) => <option key={b || 'none'} value={b}>{b ? `Badge: ${b}` : 'No badge'}</option>)}
                </select>
                <DateRange from={p.from} until={p.until} onChange={(patch) => setPoster(p.id, patch)} />
                {p.link && !cleanPosterLink(p.link) && <p className="text-xs" style={{ color: '#b91c1c' }}>Link must start with https:// or be an in-app path.</p>}
              </div>
              <div className="flex sm:flex-col items-center gap-1.5">
                <button type="button" className="btn-ghost !px-2.5 !py-2" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move earlier"><ArrowUp className="w-4 h-4" /></button>
                <button type="button" className="btn-ghost !px-2.5 !py-2" onClick={() => move(i, 1)} disabled={i === cfg.posters.length - 1} aria-label="Move later"><ArrowDown className="w-4 h-4" /></button>
                <button type="button" className="btn-ghost !px-2.5 !py-2" style={{ color: '#b91c1c' }} onClick={() => edit({ ...cfg, posters: cfg.posters.filter((x) => x.id !== p.id) })} aria-label="Remove poster"><Trash2 className="w-4 h-4" /></button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="surface-card p-5 sm:p-6">
        <div className="flex items-center gap-2"><FileText className="w-5 h-5" style={{ color: 'var(--color-teal-dark)' }} /><h3 className="font-serif text-lg font-semibold">Import from HTML</h3></div>
        <p className="text-sm mt-1 max-w-3xl" style={{ color: 'var(--color-text-muted)' }}>
          Paste HTML code and it is converted into posters in the fixed format above. Only the https image, title, caption and link are read — scripts and styles in the pasted code are ignored. Plain <code>&lt;a&gt;&lt;img&gt;&lt;/a&gt;</code> and <code>&lt;img&gt;</code> snippets also work.
        </p>
        <pre className="mt-3 p-3 rounded-xl text-xs overflow-x-auto" style={{ background: 'var(--color-paper)', border: '1px solid var(--color-border)' }}>{POSTER_HTML_EXAMPLE}</pre>
        <textarea className="input-field mt-3 min-h-[140px] font-mono text-xs" value={html} onChange={(e) => setHtml(e.target.value)} placeholder="Paste HTML here…" aria-label="HTML to import" spellCheck={false} />
        <button type="button" className="btn-primary !w-auto mt-3" onClick={importHtml} disabled={!html.trim()}><FileText className="w-4 h-4" /> Parse &amp; add posters</button>
      </section>

      <section className="surface-card p-5 sm:p-6">
        <h3 className="font-serif text-lg font-semibold mb-1">Live preview</h3>
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>Exactly how readers will see it today, on desktop and on phones. Posters outside their dates are hidden here too.</p>
        <FeaturedPosters config={cfg} />
      </section>
    </div>
  );
}

/** From / Until pickers. New posters start as a one-week run; clear both dates for "always on". */
function DateRange({ from, until, onChange, disabled = false }: { from: string; until: string; onChange: (patch: { from: string; until: string }) => void; disabled?: boolean }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] items-end">
      <div><label className="label">Show from</label><input type="date" className="input-field" value={from} max={until || undefined} onChange={(e) => onChange({ from: e.target.value, until })} disabled={disabled} /></div>
      <div><label className="label">Show until (inclusive)</label><input type="date" className="input-field" value={until} min={from || undefined} onChange={(e) => onChange({ from, until: e.target.value })} disabled={disabled} /></div>
      <div className="flex gap-2 text-xs font-semibold" style={{ color: 'var(--color-teal-dark)' }}>
        <button type="button" className="underline" disabled={disabled} onClick={() => onChange(weekRange())}>This week</button>
        <button type="button" className="underline" disabled={disabled} onClick={() => onChange({ from: '', until: '' })}>Always</button>
      </div>
    </div>
  );
}
