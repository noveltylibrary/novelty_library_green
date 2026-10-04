import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Eye, FileText, Plus, Save, Trash2 } from 'lucide-react';
import DOMPurify from 'dompurify';
import { fetchReviewGuidelineSections, saveReviewGuidelineSection, deleteReviewGuidelineSection, type ReviewGuidelineSection } from '@/lib/reviewGuidelines';
import { GUIDE_CSS } from '@/components/ReviewGuidelinesModal';

export function AdminReviewGuidelinesEditor() {
  const [sections, setSections] = useState<ReviewGuidelineSection[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState('');

  const selected = useMemo(() => sections.find(s => s.id === selectedId) ?? null, [sections, selectedId]);

  const load = async (preferredId?: string) => {
    try {
      const rows = await fetchReviewGuidelineSections(true);
      setSections(rows);
      const nextId = preferredId && rows.some(s => s.id === preferredId) ? preferredId : rows[0]?.id || '';
      setSelectedId(nextId);
      const row = rows.find(s => s.id === nextId);
      setTitle(row?.title || '');
      setContent(row?.content_html || '');
      setActive(row?.active ?? true);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not load guideline sections.');
    }
  };

  useEffect(() => { void load(); }, []);

  const selectSection = (id: string) => {
    const row = sections.find(s => s.id === id);
    setSelectedId(id);
    setTitle(row?.title || '');
    setContent(row?.content_html || '');
    setActive(row?.active ?? true);
    setMessage('');
    setPreview(false);
  };

  const addSection = () => {
    setSelectedId('');
    setTitle('New guide section');
    setContent('<p>Write the content for this section here.</p>');
    setActive(true);
    setPreview(false);
    setMessage('New section ready. Save it to add it to the guide.');
  };

  const save = async () => {
    if (!title.trim()) {
      setMessage('Enter a section name first.');
      return;
    }
    try {
      setSaving(true);
      const sort = selected?.sort_order ?? ((sections.at(-1)?.sort_order ?? 0) + 10);
      const saved = await saveReviewGuidelineSection({
        id: selected?.id,
        slug: selected?.slug,
        title,
        content_html: content,
        active,
        sort_order: sort,
      });
      setMessage('Guide section saved.');
      await load(saved.id);
    } catch (e) {
      setMessage(e instanceof Error ? `Could not save section: ${e.message}` : 'Could not save section.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!selected || !confirm(`Delete “${selected.title}”? This removes the section from the public guide.`)) return;
    try {
      setDeleting(true);
      await deleteReviewGuidelineSection(selected.id);
      setMessage('Guide section deleted.');
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not delete section.');
    } finally {
      setDeleting(false);
    }
  };

  const safePreview = DOMPurify.sanitize(content || '<p>Your section content preview will appear here.</p>', { ADD_ATTR: ['target', 'rel'], FORBID_TAGS: ['script', 'iframe', 'object', 'embed'] });

  return <section className="surface-card p-6">
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div>
        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[.18em] font-semibold" style={{ color: 'var(--color-teal-dark)' }}><FileText className="w-4 h-4" /> Review Guidelines Editor</div>
        <h2 className="font-serif text-2xl sm:text-3xl font-semibold mt-1">Build the guide section by section</h2>
        <p className="text-sm mt-2 max-w-3xl" style={{ color: 'var(--color-text-muted)' }}>Choose a section from the dropdown, rename it, and edit its context. The same saved sections are rendered on the public Review Guidelines page.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary !w-auto" onClick={addSection}><Plus className="w-4 h-4" /> Add section</button>
        {selected && <button type="button" className="btn-ghost !w-auto text-red-600" disabled={deleting} onClick={() => void remove()}><Trash2 className="w-4 h-4" /> {deleting ? 'Deleting…' : 'Delete section'}</button>}
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
      <aside className="rounded-2xl p-4 h-fit" style={{ background: 'var(--color-paper)', border: '1px solid var(--color-border)' }}>
        <label className="label">Guide section</label>
        <div className="relative">
          <select value={selectedId} onChange={e => selectSection(e.target.value)} className="input-field appearance-none pr-10">
            <option value="">New section…</option>
            {[...sections].sort((a,b) => a.sort_order - b.sort_order).map(section => <option key={section.id} value={section.id}>{section.title}</option>)}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--color-text-muted)' }} />
        </div>
        <div className="mt-4 space-y-2">
          {sections.map((section, index) => <button type="button" key={section.id} onClick={() => selectSection(section.id)} className="w-full text-left rounded-xl p-3 transition" style={{ background: section.id === selectedId ? 'rgba(8,145,178,.10)' : 'transparent', border: `1px solid ${section.id === selectedId ? 'rgba(8,145,178,.20)' : 'var(--color-border)'}` }}><span className="text-[10px] uppercase tracking-[.16em] font-bold" style={{ color: 'var(--color-teal-dark)' }}>{String(index + 1).padStart(2,'0')}</span><span className="block mt-1 text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{section.title}</span></button>)}
        </div>
      </aside>

      <div className="min-w-0">
        <div className="grid gap-4">
          <div><label className="label">Section name</label><input value={title} onChange={e => setTitle(e.target.value)} className="input-field" placeholder="AT A GLANCE INFO & CORE RULES" /></div>
          <div><label className="label">Section context / content</label><p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>Use HTML for formatting such as <code>&lt;p&gt;</code>, <code>&lt;strong&gt;</code>, <code>&lt;ul&gt;</code>, links, and the guide's existing card classes. Scripts and embedded frames are removed from the public render.</p><textarea value={content} onChange={e => setContent(e.target.value)} className="input-field min-h-[420px] font-mono text-sm leading-6" placeholder="Write the section context here…" /></div>
          <label className="flex items-center gap-2 text-sm rounded-xl p-3" style={{ background: 'rgba(8,145,178,.07)' }}><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} /> Show this section on the public guide</label>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" className="btn-primary !w-auto" disabled={saving} onClick={() => void save()}><Save className="w-4 h-4" />{saving ? 'Saving…' : selected ? 'Save changes' : 'Add section'}</button>
            <button type="button" className="btn-ghost !w-auto" onClick={() => setPreview(v => !v)}><Eye className="w-4 h-4" /> {preview ? 'Hide preview' : 'Preview section'}</button>
          </div>

          {preview && <div className="rounded-3xl p-3 sm:p-4" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
            <style dangerouslySetInnerHTML={{ __html: GUIDE_CSS }} />
            <div className="novelty-guide-app-shell"><div className="novelty-guide-outer-wrapper"><div className="novelty-guide-wrapper"><details className="novelty-section" open><summary><span>{title || 'Untitled section'}</span><svg className="arrow-icon" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></svg></summary><div className="novelty-content" dangerouslySetInnerHTML={{ __html: safePreview }} /></details></div></div></div>
          </div>}
        </div>
        {message && <div className="mt-4 inline-flex items-center gap-2 text-sm" style={{ color: message.includes('Could not') ? '#dc2626' : 'var(--color-teal-dark)' }}><Check className="w-4 h-4" /> {message}</div>}
      </div>
    </div>
  </section>;
}
