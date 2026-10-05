import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Eye, EyeOff, FileText, Plus, Save, Trash2, Wand2 } from 'lucide-react';
import { ABOUT_ICONS, ABOUT_LAYOUTS, DEFAULT_ABOUT_SECTIONS, deleteAboutSection, fetchAboutSections, saveAboutSection, seedDefaultAboutSections, type AboutItem, type AboutLayout, type AboutSection } from '@/lib/aboutSections';
import { AboutSectionBlock } from '@/components/AboutSectionsView';
import { useSupportEmail } from '@/lib/siteSettings';

const usesItems = (l: AboutLayout) => ['pillars', 'grid', 'steps', 'faq'].includes(l);
const usesIcons = (l: AboutLayout) => l === 'pillars' || l === 'grid';

export function AdminAboutEditor() {
  const supportEmail = useSupportEmail();
  const [rows, setRows] = useState<AboutSection[]>([]);
  const [usingDefaults, setUsingDefaults] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [layout, setLayout] = useState<AboutLayout>('pillars');
  const [eyebrow, setEyebrow] = useState('');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [body, setBody] = useState('');
  const [items, setItems] = useState<AboutItem[]>([]);
  const [buttonLabel, setButtonLabel] = useState('');
  const [buttonLink, setButtonLink] = useState('');
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState('');

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);

  const fill = (r: AboutSection | null) => {
    setSelectedId(r?.id ?? '');
    setLayout(r?.layout ?? 'pillars'); setEyebrow(r?.eyebrow ?? ''); setTitle(r?.title ?? ''); setSubtitle(r?.subtitle ?? ''); setBody(r?.body ?? '');
    setItems(r?.items ?? []); setButtonLabel(r?.button_label ?? ''); setButtonLink(r?.button_link ?? ''); setActive(r?.active ?? true); setPreview(false);
  };

  const load = async (preferredId?: string) => {
    try {
      const data = await fetchAboutSections(true);
      const list = data.length ? data : DEFAULT_ABOUT_SECTIONS;
      setUsingDefaults(!data.length);
      setRows(list);
      fill(list.find((r) => r.id === preferredId) ?? list[0] ?? null);
    } catch (e) {
      setUsingDefaults(true); setRows(DEFAULT_ABOUT_SECTIONS); fill(DEFAULT_ABOUT_SECTIONS[0]);
      setMessage(e instanceof Error ? `Could not load saved sections (${e.message}). Run the 1.25 SQL migration first.` : 'Could not load saved sections.');
    }
  };
  useEffect(() => { void load(); }, []);

  const draft = (): AboutSection => ({ id: selected?.id ?? 'draft', slug: selected?.slug ?? 'draft', layout, eyebrow, title, subtitle, body, items, button_label: buttonLabel, button_link: buttonLink, sort_order: selected?.sort_order ?? 0, active });

  const run = async (fn: () => Promise<void>, ok: string) => {
    try { setBusy(true); await fn(); setMessage(ok); } catch (e) { setMessage(e instanceof Error ? `Could not complete that: ${e.message}` : 'Something went wrong.'); } finally { setBusy(false); }
  };

  const addSection = () => { fill(null); setTitle('New section'); setMessage('New section ready — fill it in and press Save.'); };

  const save = () => run(async () => {
    if (usingDefaults) throw new Error('Press “Load default sections” first so the built-in content is saved to the database.');
    const sort = selected?.sort_order ?? ((rows.at(-1)?.sort_order ?? 0) + 10);
    const saved = await saveAboutSection({ id: selected?.id, slug: selected?.slug, layout, eyebrow, title, subtitle, body, items, button_label: buttonLabel, button_link: buttonLink, active, sort_order: sort });
    await load(saved.id);
  }, 'Section saved. It is live on the About page.');

  const remove = () => selected && confirm(`Delete “${selected.title}”? It disappears from the About page.`) && run(async () => { await deleteAboutSection(selected.id); await load(); }, 'Section deleted.');

  const move = (index: number, dir: -1 | 1) => run(async () => {
    const a = rows[index], b = rows[index + dir];
    if (!a || !b || usingDefaults) return;
    await saveAboutSection({ ...a, sort_order: b.sort_order });
    await saveAboutSection({ ...b, sort_order: a.sort_order });
    await load(selectedId);
  }, 'Order updated.');

  const seed = () => run(async () => { await seedDefaultAboutSections(); await load(); }, 'Default sections loaded — everything on the About page is now editable.');

  const setItem = (i: number, patch: Partial<AboutItem>) => setItems((list) => list.map((it, n) => (n === i ? { ...it, ...patch } : it)));
  const moveItem = (i: number, dir: -1 | 1) => setItems((list) => { const j = i + dir; if (j < 0 || j >= list.length) return list; const c = [...list]; [c[i], c[j]] = [c[j], c[i]]; return c; });
  const layoutInfo = ABOUT_LAYOUTS.find((l) => l.value === layout);

  return <section className="surface-card p-6 min-w-0">
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div>
        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[.18em] font-semibold" style={{ color: 'var(--color-teal-dark)' }}><FileText className="w-4 h-4" /> About page editor</div>
        <h2 className="font-serif text-2xl sm:text-3xl font-semibold mt-1">Build the About page section by section</h2>
        <p className="text-sm mt-2 max-w-3xl" style={{ color: 'var(--color-text-muted)' }}>Every block on the public About page is a section here: opening, feature cards, benefits, steps, FAQ and the closing banner. Edit, reorder, hide or add your own.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {usingDefaults && <button type="button" className="btn-primary !w-auto" disabled={busy} onClick={() => void seed()}><Wand2 className="w-4 h-4" /> Load default sections</button>}
        <button type="button" className="btn-ghost !w-auto" onClick={addSection}><Plus className="w-4 h-4" /> Add section</button>
      </div>
    </div>

    {usingDefaults && <div className="mb-5 rounded-2xl p-4 text-sm" style={{ background: 'rgba(8,145,178,.08)', border: '1px solid rgba(8,145,178,.2)' }}>The About page is showing its built-in text. Press <strong>Load default sections</strong> once to copy it into editable sections (run <code>sql/2026-10-05_1.25_about_sections.sql</code> in Supabase first).</div>}

    <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-5">
      <aside className="rounded-2xl p-3 h-fit space-y-2" style={{ background: 'var(--color-paper)', border: '1px solid var(--color-border)' }}>
        {rows.map((r, index) => <div key={r.id} className="flex items-stretch gap-1">
          <button type="button" onClick={() => { fill(r); setMessage(''); }} className="flex-1 min-w-0 text-left rounded-xl p-3 transition" style={{ background: r.id === selectedId ? 'rgba(8,145,178,.10)' : 'transparent', border: `1px solid ${r.id === selectedId ? 'rgba(8,145,178,.25)' : 'var(--color-border)'}`, opacity: r.active ? 1 : 0.55 }}>
            <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[.16em] font-bold" style={{ color: 'var(--color-teal-dark)' }}>{String(index + 1).padStart(2, '0')} · {ABOUT_LAYOUTS.find((l) => l.value === r.layout)?.label.split(' (')[0]}{!r.active && <EyeOff className="w-3 h-3" />}</span>
            <span className="block mt-1 text-sm font-semibold truncate" style={{ color: 'var(--color-text)' }}>{r.title}</span>
          </button>
          {!usingDefaults && <div className="flex flex-col justify-center gap-1">
            <button type="button" aria-label="Move up" disabled={busy || index === 0} onClick={() => void move(index, -1)} className="rounded-lg p-1 disabled:opacity-30" style={{ border: '1px solid var(--color-border)' }}><ArrowUp className="w-3.5 h-3.5" /></button>
            <button type="button" aria-label="Move down" disabled={busy || index === rows.length - 1} onClick={() => void move(index, 1)} className="rounded-lg p-1 disabled:opacity-30" style={{ border: '1px solid var(--color-border)' }}><ArrowDown className="w-3.5 h-3.5" /></button>
          </div>}
        </div>)}
      </aside>

      <div className="min-w-0 grid gap-4 content-start">
        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className="label">Section type</label><select value={layout} onChange={(e) => setLayout(e.target.value as AboutLayout)} className="input-field">{ABOUT_LAYOUTS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}</select><p className="text-xs mt-1.5" style={{ color: 'var(--color-text-muted)' }}>{layoutInfo?.hint}</p></div>
          {layout === 'hero' && <div><label className="label">Badge text</label><input value={eyebrow} onChange={(e) => setEyebrow(e.target.value)} className="input-field" placeholder="Our Story" /></div>}
        </div>
        <div><label className="label">Heading</label><input value={title} onChange={(e) => setTitle(e.target.value)} className="input-field" maxLength={200} /></div>
        {layout !== 'hero' && layout !== 'cta' ? <div><label className="label">Sub-heading (optional)</label><input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className="input-field" /></div> : null}
        {(layout === 'hero' || layout === 'cta' || layout === 'text') && <div><label className="label">{layout === 'cta' ? 'Banner text' : 'Paragraph(s)'}</label><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={layout === 'text' ? 8 : 4} maxLength={6000} className="input-field resize-y" /><p className="text-xs mt-1.5" style={{ color: 'var(--color-text-muted)' }}>Leave a blank line between paragraphs.</p></div>}
        {layout === 'cta' && <div className="grid sm:grid-cols-2 gap-4"><div><label className="label">Button text</label><input value={buttonLabel} onChange={(e) => setButtonLabel(e.target.value)} className="input-field" placeholder="Submit Your Review" /></div><div><label className="label">Button link</label><input value={buttonLink} onChange={(e) => setButtonLink(e.target.value)} className="input-field" placeholder="/submit or https://…" /></div></div>}

        {usesItems(layout) && <div>
          <div className="flex items-center justify-between mb-2"><label className="label !mb-0">{layout === 'faq' ? 'Questions' : layout === 'steps' ? 'Steps' : 'Cards'} ({items.length})</label><button type="button" className="btn-ghost !w-auto !py-1.5 text-xs" onClick={() => setItems((l) => [...l, { title: '', desc: '', ...(usesIcons(layout) ? { icon: 'sparkles' } : {}) }])}><Plus className="w-3.5 h-3.5" /> Add {layout === 'faq' ? 'question' : layout === 'steps' ? 'step' : 'card'}</button></div>
          <div className="space-y-3">
            {items.map((it, i) => <div key={i} className="rounded-2xl p-3 grid gap-2" style={{ background: 'var(--color-paper)', border: '1px solid var(--color-border)' }}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold w-5 text-center" style={{ color: 'var(--color-teal-dark)' }}>{i + 1}</span>
                <input value={it.title} onChange={(e) => setItem(i, { title: e.target.value })} className="input-field flex-1 min-w-0" placeholder={layout === 'faq' ? 'Question' : 'Title'} />
                {usesIcons(layout) && <select value={it.icon || 'sparkles'} onChange={(e) => setItem(i, { icon: e.target.value })} className="input-field !w-28 shrink-0" aria-label="Icon">{ABOUT_ICONS.map((n) => <option key={n} value={n}>{n}</option>)}</select>}
                <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => moveItem(i, -1)} className="rounded-lg p-1.5 disabled:opacity-30" style={{ border: '1px solid var(--color-border)' }}><ArrowUp className="w-3.5 h-3.5" /></button>
                <button type="button" aria-label="Move down" disabled={i === items.length - 1} onClick={() => moveItem(i, 1)} className="rounded-lg p-1.5 disabled:opacity-30" style={{ border: '1px solid var(--color-border)' }}><ArrowDown className="w-3.5 h-3.5" /></button>
                <button type="button" aria-label="Remove" onClick={() => setItems((l) => l.filter((_, n) => n !== i))} className="rounded-lg p-1.5 text-red-600" style={{ border: '1px solid var(--color-border)' }}><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              <textarea value={it.desc} onChange={(e) => setItem(i, { desc: e.target.value })} rows={layout === 'grid' || layout === 'steps' ? 2 : 4} className="input-field resize-y" placeholder={layout === 'faq' ? 'Answer' : 'Description'} />
            </div>)}
          </div>
        </div>}

        <label className="flex items-center gap-2 text-sm rounded-xl p-3" style={{ background: 'rgba(8,145,178,.07)' }}><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Show this section on the About page</label>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary !w-auto" disabled={busy} onClick={() => void save()}><Save className="w-4 h-4" />{busy ? 'Working…' : selected && !selected.id.startsWith('default-') ? 'Save changes' : 'Add section'}</button>
            {selected && !usingDefaults && <button type="button" className="btn-ghost !w-auto text-red-600" disabled={busy} onClick={() => void remove()}><Trash2 className="w-4 h-4" /> Delete</button>}
          </div>
          <button type="button" className="btn-ghost !w-auto" onClick={() => setPreview((v) => !v)}><Eye className="w-4 h-4" /> {preview ? 'Hide preview' : 'Preview section'}</button>
        </div>
        {preview && <div className="rounded-3xl p-4 sm:p-6 nl-about-shell" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}><AboutSectionBlock section={draft()} email={supportEmail} navigate={() => undefined} /></div>}
        {message && <div className="inline-flex items-center gap-2 text-sm" style={{ color: /could not|went wrong|press/i.test(message) ? '#dc2626' : 'var(--color-teal-dark)' }}><Check className="w-4 h-4" /> {message}</div>}
      </div>
    </div>
  </section>;
}
