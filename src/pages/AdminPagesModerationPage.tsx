import { useEffect, useMemo, useRef, useState } from 'react';
import { Lock, ArrowLeft, FileText, Save, ExternalLink, Plus, Trash2, ChevronUp, ChevronDown, GripVertical, Eye, ListChecks, LayoutTemplate, Pencil, FolderPlus, X, ImagePlus } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { fetchEditablePage, saveEditablePage, PAGE_DEFAULTS } from '@/lib/adminConfig';
import { AdminReviewGuidelinesEditor } from '@/components/AdminReviewGuidelinesEditor';
import { AdminAboutEditor } from '@/components/AdminAboutEditor';
import {
  fetchProfileQuestions,
  fetchProfileSections,
  saveProfileQuestion,
  saveProfileQuestionSection,
  deleteProfileQuestion,
  reorderProfileQuestions,
  type ProfileQuestion,
  type ProfileQuestionType,
  type ProfileQuestionSection,
} from '@/lib/profileQuestions';
import { CORE_FIELDS, coreActive, fetchCoreOverrides, saveCoreOverride, resetCoreOverride, fetchCoreFieldOrder, saveCoreFieldOrder, type CoreFieldKey, type CoreOverrides, type CoreFieldOrder } from '@/lib/profileCoreFields';
import { BUILT_IN_PROFILE_SECTIONS, fetchProfileSectionLayout, saveProfileSectionLayout, type ProfileSectionLayoutItem } from '@/lib/profileLayout';

const PAGE_KEYS = ['review-guidelines', 'about', 'privacy', 'terms', 'cookies', 'cookie-banner'] as const;
const QUESTION_TYPES: { value: ProfileQuestionType; label: string }[] = [
  { value: 'short_text', label: 'Short answer' },
  { value: 'long_text', label: 'Paragraph' },
  { value: 'number', label: 'Number' },
  { value: 'year', label: 'Year' },
  { value: 'url', label: 'Link / URL' },
  { value: 'select_single', label: 'Dropdown · Single select' },
  { value: 'select_multiple', label: 'Dropdown · Multiple select' },
  { value: 'image_upload', label: 'Image upload' },
];

export function AdminPagesModerationPage({ navigate }: { navigate: (path: string) => void }) {
  const { user, isAdmin, loading } = useAuth();
  const [active, setActive] = useState<typeof PAGE_KEYS[number]>('review-guidelines');
  const [adminView, setAdminView] = useState<'editor' | 'profile'>('editor');
  const [profilePreview, setProfilePreview] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const questionInputRef = useRef<HTMLInputElement>(null);
  const [questionSaving, setQuestionSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const [questions, setQuestions] = useState<ProfileQuestion[]>([]);
  const [sections, setSections] = useState<ProfileQuestionSection[]>([]);
  const [sectionLayout, setSectionLayout] = useState<ProfileSectionLayoutItem[]>(BUILT_IN_PROFILE_SECTIONS);
  const [coreFieldOrder, setCoreFieldOrder] = useState<CoreFieldOrder>({});
  const [editing, setEditing] = useState<ProfileQuestion | null>(null);
  const [coreOverrides, setCoreOverrides] = useState<CoreOverrides>({});
  const [editingCore, setEditingCore] = useState<CoreFieldKey | null>(null);
  const [coreLabelDraft, setCoreLabelDraft] = useState('');
  const [corePlaceholderDraft, setCorePlaceholderDraft] = useState('');
  const [coreVisibleDraft, setCoreVisibleDraft] = useState(true);
  const [coreActiveDraft, setCoreActiveDraft] = useState(true);
  const [question, setQuestion] = useState('');
  const [placeholder, setPlaceholder] = useState('');
  const [section, setSection] = useState('');
  const [type, setType] = useState<ProfileQuestionType>('short_text');
  const [options, setOptions] = useState<string[]>([]);
  const [allowOther, setAllowOther] = useState(true);
  const [imageCount, setImageCount] = useState(1);
  const [imageMaxMb, setImageMaxMb] = useState(5);
  const [imageMaxWidth, setImageMaxWidth] = useState(1600);
  const [imageMaxHeight, setImageMaxHeight] = useState(1600);
  const [required, setRequired] = useState(false);
  const [publicDefault, setPublicDefault] = useState(true);
  const [showInCard, setShowInCard] = useState(true);
  const [profileCardMode, setProfileCardMode] = useState<'tag' | 'answer'>('answer');
  const [showQuestionInCard, setShowQuestionInCard] = useState(true);
  const [maxSelections, setMaxSelections] = useState<number | null>(null);
  const [alphabeticalSort, setAlphabeticalSort] = useState(false);

  const [sectionEditorOpen, setSectionEditorOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<ProfileQuestionSection | null>(null);
  const [sectionName, setSectionName] = useState('');
  const [sectionHeader, setSectionHeader] = useState('');
  const [sectionDescription, setSectionDescription] = useState('');
  const [sectionOrder, setSectionOrder] = useState(10);
  const [sectionActive, setSectionActive] = useState(true);
  const [sectionSaving, setSectionSaving] = useState(false);

  const orderedSections = useMemo(() => [...sections].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)), [sections]);
  const allSectionLayout = useMemo(() => {
    const custom = orderedSections.map((s): ProfileSectionLayoutItem => ({ key: `custom:${s.id}` as const, order: s.sort_order, active: s.active, header: s.header || s.name, description: s.description || '' }));
    const built = sectionLayout.filter(s => !String(s.key).startsWith('custom:')).map(s => ({ ...s }));
    // Identity is locked at the top; everything else follows the admin's order.
    return [...built, ...custom].sort((a,b)=>(a.key==='reader_identity'?-1:b.key==='reader_identity'?1:0) || a.order-b.order || a.key.localeCompare(b.key));
  }, [orderedSections, sectionLayout]);
  const [dragQ, setDragQ] = useState<string | null>(null);
  const [dragSec, setDragSec] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const questionGroups = useMemo(() => {
    const byOrder = (a: ProfileQuestion, b: ProfileQuestion) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0);
    const groups = orderedSections.map(sec => ({ name: sec.name, header: sec.header || sec.name, active: sec.active, items: questions.filter(q => q.section === sec.name).sort(byOrder) }));
    const known = new Set(orderedSections.map(x => x.name));
    [...new Set(questions.filter(q => !known.has(q.section)).map(q => q.section))].forEach(name => groups.push({ name, header: `${name} (no section)`, active: false, items: questions.filter(q => q.section === name).sort(byOrder) }));
    return groups;
  }, [orderedSections, questions]);
  const activeSections = useMemo(() => orderedSections.filter(s => s.active), [orderedSections]);

  const loadPage = async (slug: typeof PAGE_KEYS[number]) => {
    const page = await fetchEditablePage(slug);
    setTitle(page.title);
    setContent(page.content);
  };

  const loadProfileBuilder = async () => {
    try {
      const [sectionRows, questionRows, layoutRows, fieldOrder] = await Promise.all([
        fetchProfileSections(true),
        fetchProfileQuestions(true),
        fetchProfileSectionLayout(),
        fetchCoreFieldOrder(),
      ]);
      setSections(sectionRows);
      setQuestions(questionRows);
      setSectionLayout(layoutRows);
      setCoreFieldOrder(fieldOrder);
      setSection(current => current || sectionRows.find(s => s.active)?.name || sectionRows[0]?.name || '');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not load profile form builder.');
    }
  };

  useEffect(() => { if (isAdmin) void loadPage(active); }, [isAdmin, active]);
  useEffect(() => { editorRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }, [editing, editingCore]);
  useEffect(() => { if (isAdmin) void loadProfileBuilder(); }, [isAdmin]);
  useEffect(() => { if (isAdmin) void fetchCoreOverrides().then(setCoreOverrides).catch(() => undefined); }, [isAdmin]);

  if (loading) return <div className="pt-32 container-prose text-center">Loading…</div>;
  if (!user || !isAdmin) return <div className="pt-32 container-prose text-center">Admin access required.</div>;

  const save = async () => {
    try {
      setSaving(true);
      await saveEditablePage(active, title, content);
      setMsg('Page saved.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not save page.');
    } finally {
      setSaving(false);
    }
  };

  const editCore = (key: CoreFieldKey) => {
    const def = CORE_FIELDS.find(f => f.key === key)!;
    if (def.locked) return;
    const o = coreOverrides[key] || {};
    setEditing(null);
    setEditingCore(key);
    setCoreLabelDraft(o.label ?? def.label);
    setCorePlaceholderDraft(o.placeholder ?? def.placeholder);
    setCoreVisibleDraft(o.defaultVisible ?? def.defaultVisible);
    setCoreActiveDraft(o.active !== false);
    requestAnimationFrame(() => editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  };

  const saveCore = async () => {
    if (!editingCore) return;
    if (!coreLabelDraft.trim()) { setMsg('Enter a field label first.'); return; }
    try {
      setQuestionSaving(true);
      setCoreOverrides(await saveCoreOverride(editingCore, { label: coreLabelDraft.trim(), placeholder: corePlaceholderDraft, defaultVisible: coreVisibleDraft, active: coreActiveDraft }));
      setMsg('Built-in field updated.');
      setEditingCore(null);
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Could not save built-in field.'); }
    finally { setQuestionSaving(false); }
  };

  const restoreCore = async () => {
    if (!editingCore) return;
    try { setCoreOverrides(await resetCoreOverride(editingCore)); setMsg('Built-in field restored to default.'); setEditingCore(null); }
    catch (e) { setMsg(e instanceof Error ? e.message : 'Could not restore field.'); }
  };

  const resetQuestion = () => {
    setEditingCore(null);
    setEditing(null);
    setQuestion('');
    setPlaceholder('');
    setSection(activeSections[0]?.name || '');
    setType('short_text');
    setOptions([]);
    setAllowOther(true);
    setImageCount(1);
    setImageMaxMb(5);
    setImageMaxWidth(1600);
    setImageMaxHeight(1600);
    setRequired(false);
    setPublicDefault(true);
    setShowInCard(true);
    setProfileCardMode('answer');
    setShowQuestionInCard(true);
    setMaxSelections(null);
    setAlphabeticalSort(false);
  };

  const editQuestion = (q: ProfileQuestion) => {
    setAdminView('profile');
    setProfilePreview(false);
    setEditingCore(null);
    setEditing(q);
    setQuestion(q.question);
    setPlaceholder(q.placeholder || '');
    setSection(q.section);
    setType(q.type === 'select' ? 'select_single' : q.type);
    setOptions(q.options || []);
    setAllowOther(q.allow_other !== false);
    setImageCount(Math.max(1, Math.min(6, q.image_count || 1)));
    setImageMaxMb(Math.max(1, Math.min(5, q.image_max_mb || 5)));
    setImageMaxWidth(Math.max(320, Math.min(6000, q.image_max_width || 1600)));
    setImageMaxHeight(Math.max(320, Math.min(6000, q.image_max_height || 1600)));
    setRequired(q.required);
    setPublicDefault(q.public_default);
    setShowInCard(q.show_in_profile_card !== false);
    setProfileCardMode(q.profile_card_mode === 'tag' || q.profile_card_mode === 'tag_no_question' ? 'tag' : 'answer');
    setShowQuestionInCard(q.profile_card_mode !== 'answer_no_question' && q.profile_card_mode !== 'tag_no_question');
    setMaxSelections(q.max_selections == null ? null : Math.max(1, Number(q.max_selections) || 1));
    setAlphabeticalSort(!!q.alphabetical_sort);
    requestAnimationFrame(() => questionInputRef.current?.focus({ preventScroll: true }));
  };

  const saveQuestion = async () => {
    if (!question.trim()) {
      setMsg('Enter a question first.');
      return;
    }
    if (!section.trim()) {
      setMsg('Create a section before adding profile questions.');
      return;
    }
    try {
      setQuestionSaving(true);
      const saved = await saveProfileQuestion({
        id: editing?.id,
        question,
        placeholder,
        section,
        type,
        options: options.map(x => x.trim()).filter(Boolean),
        allow_other: (type === 'select' || type === 'select_single' || type === 'select_multiple') ? allowOther : false,
        image_count: type === 'image_upload' ? imageCount : 1,
        image_max_mb: type === 'image_upload' ? imageMaxMb : 5,
        image_max_width: type === 'image_upload' ? imageMaxWidth : 1600,
        image_max_height: type === 'image_upload' ? imageMaxHeight : 1600,
        required,
        public_default: publicDefault,
        show_in_profile_card: showInCard,
        profile_card_mode: cardModeFor(profileCardMode, showQuestionInCard),
        max_selections: type === 'select_multiple' ? maxSelections : null,
        alphabetical_sort: (type === 'select_multiple' || type === 'select_single' || type === 'select') ? alphabeticalSort : false,
        sort_order: editing?.sort_order ?? questions.length,
      });
      setQuestions(v => editing ? v.map(x => x.id === saved.id ? saved : x) : [...v, saved]);
      setMsg('Profile question saved.');
      resetQuestion();
      await loadProfileBuilder();
    } catch (e) {
      setMsg(e instanceof Error ? `Could not save question: ${e.message}` : 'Could not save question.');
    } finally {
      setQuestionSaving(false);
    }
  };

  const removeQuestion = async (id: string) => {
    if (!confirm('Remove this profile question?')) return;
    try {
      await deleteProfileQuestion(id);
      setQuestions(v => v.filter(x => x.id !== id));
      setMsg('Question removed.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not remove question.');
    }
  };

  const dropQuestion = async (sectionName: string, beforeId: string | null) => {
    const id = dragQ; setDragQ(null); setOverKey(null);
    if (!id || id === beforeId) return;
    const moving = questions.find(q => q.id === id);
    if (!moving) return;
    const lists = new Map<string, ProfileQuestion[]>(questionGroups.map(g => [g.name, g.items.filter(q => q.id !== id)]));
    const target = lists.get(sectionName) ?? [];
    const idx = beforeId ? target.findIndex(q => q.id === beforeId) : -1;
    const moved = { ...moving, section: sectionName };
    if (idx < 0) target.push(moved); else target.splice(idx, 0, moved);
    lists.set(sectionName, target);
    const flat = questionGroups.flatMap(g => lists.get(g.name) ?? []);
    const previous = questions;
    setQuestions(flat.map((q, i) => ({ ...q, sort_order: i })));
    try {
      if (moving.section !== sectionName) await saveProfileQuestion({ ...moving, section: sectionName });
      await reorderProfileQuestions(flat.map(q => q.id));
      setMsg(moving.section !== sectionName ? `Moved to “${sectionName}” and order saved.` : 'Question order saved.');
      await loadProfileBuilder();
    } catch (e) {
      setQuestions(previous);
      setMsg(e instanceof Error ? e.message : 'Could not reorder questions.');
    }
  };

  const move = async (q: ProfileQuestion, direction: -1 | 1) => {
    const group = questionGroups.find(g => g.name === q.section);
    if (!group) return;
    const i = group.items.findIndex(x => x.id === q.id);
    const t = group.items[i + direction];
    if (!t) return;
    if (direction === -1) { setDragQ(q.id); await dropQuestion(q.section, t.id); }
    else { const after = group.items[i + 2]; setDragQ(q.id); await dropQuestion(q.section, after ? after.id : null); }
  };

  const openBuiltInSection = (item: ProfileSectionLayoutItem) => {
    setEditingSection({ id: `builtin:${item.key}`, name: item.key, header: item.header, description: item.description, sort_order: item.order, active: item.active });
    setSectionName(item.key);
    setSectionHeader(item.header || item.key);
    setSectionDescription(item.description || '');
    setSectionOrder(item.order);
    setSectionActive(item.active);
    setSectionEditorOpen(true);
  };

  const openAddSection = () => {
    setEditingSection(null);
    setSectionName('');
    setSectionHeader('');
    setSectionDescription('');
    setSectionOrder((orderedSections.at(-1)?.sort_order ?? 0) + 10);
    setSectionActive(true);
    setSectionEditorOpen(true);
  };

  const openRenameSection = (s: ProfileQuestionSection) => {
    setEditingSection(s);
    setSectionName(s.name);
    setSectionHeader(s.header || s.name);
    setSectionDescription(s.description || '');
    setSectionOrder(s.sort_order);
    setSectionActive(s.active !== false);
    setSectionEditorOpen(true);
  };

  const dropSection = async (targetKey: string) => {
    const from = dragSec; setDragSec(null); setOverKey(null);
    if (!from || from === targetKey || from === 'reader_identity' || targetKey === 'reader_identity') return;
    const next = [...allSectionLayout];
    const fi = next.findIndex(x => x.key === from); const ti = next.findIndex(x => x.key === targetKey);
    if (fi < 0 || ti < 0) return;
    const [item] = next.splice(fi, 1);
    next.splice(ti, 0, item);
    await persistSectionOrder(next);
  };

  const moveSection = async (index: number, direction: -1 | 1) => {
    const next = [...allSectionLayout];
    const target = index + direction;
    if (target < 1 || index < 1 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    await persistSectionOrder(next);
  };

  const persistSectionOrder = async (next: ProfileSectionLayoutItem[]) => {
    const renumbered = next.map((item, i) => ({ ...item, order: i * 10 + 10 }));
    try {
      // Built-in sections keep their order in the layout; question sections keep it in
      // profile_question_sections.sort_order (which also re-syncs their questions).
      const builtIns = renumbered.filter(x => !String(x.key).startsWith('custom:'));
      setSectionLayout(await saveProfileSectionLayout(builtIns));
      for (const item of renumbered) {
        if (!String(item.key).startsWith('custom:')) continue;
        const row = sections.find(s => `custom:${s.id}` === item.key);
        if (row && row.sort_order !== item.order) {
          await saveProfileQuestionSection({ id: row.id, name: row.name, header: row.header, description: row.description, sort_order: item.order, active: row.active });
        }
      }
      setSections(await fetchProfileSections(true));
      setQuestions(await fetchProfileQuestions(true));
      setMsg('Profile section order saved.');
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Could not save section order.'); }
  };

  const moveCoreField = async (key: CoreFieldKey, direction: -1 | 1) => {
    const group = CORE_FIELDS.filter(f => {
      const sectionKey = f.section === 'Reading Journey' ? 'reading_journey' : 'reader_identity';
      return sectionKey === (key === 'reading_since' || key === 'books_read_this_month' || key === 'total_books_read' || key === 'favorite_book' || key === 'favorite_author' || key === 'favorite_genre' ? 'reading_journey' : 'reader_identity');
    });
    const sorted = [...group].sort((a,b)=>(coreFieldOrder[a.key] ?? CORE_FIELDS.indexOf(a))-(coreFieldOrder[b.key] ?? CORE_FIELDS.indexOf(b)));
    const index = sorted.findIndex(f => f.key === key);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= sorted.length) return;
    [sorted[index], sorted[target]] = [sorted[target], sorted[index]];
    const next = { ...coreFieldOrder };
    sorted.forEach((f,i)=>{ next[f.key] = i; });
    try { setCoreFieldOrder(await saveCoreFieldOrder(next)); setMsg('Built-in field order saved.'); } catch (e) { setMsg(e instanceof Error ? e.message : 'Could not save built-in field order.'); }
  };

  const saveSection = async () => {
    if (!sectionName.trim()) {
      setMsg('Enter a section name first.');
      return;
    }
    try {
      setSectionSaving(true);
      if (editingSection?.id.startsWith('builtin:')) {
        const key = editingSection.name as ProfileSectionLayoutItem['key'];
        const next = sectionLayout.map(item => item.key === key ? { ...item, header: sectionHeader.trim() || item.header, description: sectionDescription.trim(), active: sectionActive, order: sectionOrder } : item);
        setSectionLayout(await saveProfileSectionLayout(next));
        setMsg('Built-in section settings saved.');
      } else {
        const saved = await saveProfileQuestionSection({
          id: editingSection?.id,
          name: sectionName,
          header: sectionHeader,
          description: sectionDescription,
          sort_order: sectionOrder,
          active: sectionActive,
        });
        setSections(current => {
          const next = editingSection ? current.map(x => x.id === saved.id ? saved : x) : [...current, saved];
          return next.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
        });
        setSection(saved.name);
        await loadProfileBuilder();
        setMsg(editingSection ? 'Section settings saved. Existing questions were updated to the new name.' : 'Section added.');
      }
      setSectionEditorOpen(false);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not save section.');
    } finally {
      setSectionSaving(false);
    }
  };

  return <div className="pt-24 pb-20 container-prose animate-fade-in">
    <div className="max-w-7xl mx-auto">
      <button onClick={() => navigate('/admin')} className="inline-flex items-center gap-1.5 text-sm mb-7" style={{ color: 'var(--color-text-muted)' }}>
        <ArrowLeft className="w-4 h-4" /> Admin Dashboard
      </button>
      <header className="mb-8">
        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[.18em] font-semibold" style={{ color: 'var(--color-teal-dark)' }}>
          <FileText className="w-4 h-4" /> Admin content
        </div>
        <h1 className="font-serif text-4xl font-semibold mt-2">WebApp Pages Moderation</h1>
        <p className="text-sm mt-2" style={{ color: 'var(--color-text-muted)' }}>Edit site pages or fully control the reader profile: section names, reader-facing headers, helper text, order, visibility, built-in fields, questions and profile-card visibility.</p>
        <div className="mt-5 inline-flex flex-wrap gap-2 rounded-2xl p-1.5" style={{ background: 'var(--color-paper)', border: '1px solid var(--color-border)', boxShadow: '0 10px 28px rgba(1,43,54,.08)' }}>
          <button type="button" onClick={() => { setAdminView('editor'); setMsg(''); }} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition" style={{ background: adminView === 'editor' ? 'linear-gradient(135deg,#013a46,#0097b2)' : 'transparent', color: adminView === 'editor' ? 'white' : 'var(--color-text)' }}>
            <Pencil className="w-4 h-4" /> Editor
          </button>
          <button type="button" onClick={() => { setAdminView('profile'); setMsg(''); }} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition" style={{ background: adminView === 'profile' ? 'linear-gradient(135deg,#013a46,#0097b2)' : 'transparent', color: adminView === 'profile' ? 'white' : 'var(--color-text)' }}>
            <LayoutTemplate className="w-4 h-4" /> Profile Page
          </button>
        </div>
      </header>

      {adminView === 'editor' && (
      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
        <aside className="surface-card p-3 h-fit space-y-2">
          {PAGE_KEYS.map(key => <button key={key} onClick={() => { setActive(key); setMsg(''); }} className="w-full text-left rounded-xl p-3" style={{ background: active === key ? 'rgba(0,151,178,.09)' : 'transparent', color: 'var(--color-text)' }}>
            <strong className="block">{PAGE_DEFAULTS[key].title}</strong><span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>/{key}</span>
          </button>)}
          <div className="pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <button className="w-full btn-ghost text-xs" onClick={() => navigate(active === 'cookie-banner' ? '/cookies' : `/${active}`)}><ExternalLink className="w-3.5 h-3.5" /> Preview page</button>
          </div>
        </aside>

        {active === 'review-guidelines' ? <AdminReviewGuidelinesEditor /> : active === 'about' ? <AdminAboutEditor /> : <section className="surface-card p-6">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div><p className="text-xs uppercase tracking-widest font-semibold" style={{ color: 'var(--color-teal-dark)' }}>Editing</p><h2 className="font-serif text-2xl font-semibold">{title}</h2></div>
            <button className="btn-primary !w-auto" disabled={saving} onClick={save}><Save className="w-4 h-4" />{saving ? 'Saving…' : 'Save Page'}</button>
          </div>
          <div className="space-y-4">
            <div><label className="label">Page title</label><input value={title} onChange={e => setTitle(e.target.value)} className="input-field" /></div>
            <div><label className="label">{active === 'cookie-banner' ? 'Banner message (shown in the accept-cookies bar)' : 'Page copy'}</label><textarea value={content} onChange={e => setContent(e.target.value)} className="input-field min-h-[520px] resize-y font-mono text-sm leading-6" /></div>
          </div>
        </section>}
      </div>

      )}

      {adminView === 'profile' && (
        <>
      <section className="surface-card p-6 mt-8">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl grid place-items-center gradient-teal"><LayoutTemplate className="w-5 h-5 text-white" /></div>
          <div><p className="text-xs uppercase tracking-[.18em] font-semibold" style={{ color: 'var(--color-teal-dark)' }}>Profile page moderation</p><h2 className="font-serif text-2xl font-semibold mt-1">Profile Card controls</h2></div>
        </div>
        <p className="text-sm leading-6 max-w-3xl" style={{ color: 'var(--color-text-muted)' }}>Use each reader's privacy controls for personal fields, and use the question editor below to decide whether an answer is eligible to appear on the downloadable/public profile card.</p>
        <div className="mt-5 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3" style={{ background: 'linear-gradient(135deg,rgba(0,151,178,.09),rgba(53,211,217,.12))', border: '1px solid var(--color-border)' }}>
          <div><p className="font-semibold">Questions shown on profile cards</p><p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Toggle this per question in the editor. Existing user privacy settings still win.</p></div>
          <span className="text-sm font-semibold" style={{ color: 'var(--color-teal-dark)' }}>{questions.filter(q => q.show_in_profile_card !== false).length} enabled</span>
        </div>
      </section>

      <section className="surface-card p-6 mt-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <p className="text-xs uppercase tracking-[.18em] font-semibold" style={{ color: 'var(--color-teal-dark)' }}>Admin card view</p>
            <h2 className="font-serif text-2xl font-semibold mt-1">How profile questions will look in the card</h2>
            <p className="text-sm mt-2" style={{ color: 'var(--color-text-muted)' }}>Preview the same question answer treatments the reader card uses. Only questions marked “Show answer on profile card” appear here.</p>
          </div>
          <div className="inline-flex items-center gap-1 rounded-xl p-1" style={{ background: 'var(--color-paper)', border: '1px solid var(--color-border)' }}>
            <button type="button" onClick={() => setProfilePreview(false)} className="rounded-lg px-3 py-2 text-xs font-bold" style={{ background: !profilePreview ? 'rgba(8,145,178,.1)' : 'transparent', color: 'var(--color-text)' }}>Question editor</button>
            <button type="button" onClick={() => setProfilePreview(true)} className="rounded-lg px-3 py-2 text-xs font-bold" style={{ background: profilePreview ? 'linear-gradient(135deg,#013a46,#0097b2)' : 'transparent', color: profilePreview ? 'white' : 'var(--color-text)' }}>Card preview</button>
          </div>
        </div>
        {profilePreview ? <div className="rounded-3xl p-5 sm:p-7" style={{ background: 'linear-gradient(145deg,#012b36,#075985 58%,#22c3d0)', border: '1px solid rgba(255,255,255,.16)', boxShadow: '0 24px 60px rgba(1,43,54,.22)' }}>
          <div className="flex items-start justify-between gap-4 mb-5"><div><span className="text-[10px] uppercase tracking-[.2em] font-bold text-cyan-100/70">Novelty reader card</span><h3 className="font-serif text-2xl font-semibold text-white mt-1">Profile answers</h3></div><span className="rounded-full px-3 py-1 text-[10px] uppercase tracking-wider font-bold bg-white/10 text-cyan-50">Admin preview</span></div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">{questions.filter(q => q.show_in_profile_card !== false).slice(0, 12).map(q => <QuestionCardAppearancePreview key={q.id} profileCardMode={q.profile_card_mode} type={q.type} question={q.question} options={q.options.filter(Boolean)} allowOther={q.allow_other !== false} imageCount={q.image_count || 1} placeholder={q.placeholder || ''} imageMaxWidth={q.image_max_width || 1600} imageMaxHeight={q.image_max_height || 1600} />)}</div>
        </div> : <div className="text-sm py-2" style={{ color: 'var(--color-text-muted)' }}>Use the question list below to edit, reorder, and control card visibility.</div>}
      </section>

      <section className="surface-card p-6 mt-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2"><ListChecks className="w-5 h-5" style={{ color: 'var(--color-cyan-dark)' }} /><p className="text-xs uppercase tracking-[.18em] font-semibold" style={{ color: 'var(--color-teal-dark)' }}>Profile form builder</p></div>
            <h2 className="font-serif text-3xl font-semibold mt-1">Profile Questions</h2>
            <p className="text-sm mt-2" style={{ color: 'var(--color-text-muted)' }}>Create and organize profile questions into editable sections.</p>
          </div>
          <button type="button" className="btn-primary !w-auto" onClick={resetQuestion}><Plus className="w-4 h-4" /> Add question</button>
        </div>

        <div className="rounded-2xl p-4 mb-6" style={{ background: 'var(--color-paper)', border: '1px solid var(--color-border)' }}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div><p className="text-sm font-semibold">Profile question sections</p><p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Every profile-question section is configurable here: internal name, reader-facing heading, text under the heading, order and visibility. Add as many sections as your profile needs.</p></div>
            <button type="button" className="btn-primary !w-auto" onClick={openAddSection}><FolderPlus className="w-4 h-4" /> Add section</button>
          </div>
          <div className="flex flex-col gap-2 max-w-2xl" role="list" aria-label="Profile sections, top to bottom">
            {allSectionLayout.map((item, index) => {
              const builtIn = item.key === 'reader_identity' || item.key === 'profile_questions' || item.key === 'reading_journey';
              const custom = !builtIn ? orderedSections.find(s => item.key === `custom:${s.id}`) : null;
              const locked = item.key === 'reader_identity';
              return <div key={item.key} draggable={!locked} onDragStart={e => { setDragSec(item.key); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', item.key); }} onDragOver={e => { if (dragSec && !locked) { e.preventDefault(); setOverKey(`sec:${item.key}`); } }} onDragLeave={() => setOverKey(k => k === `sec:${item.key}` ? null : k)} onDrop={e => { e.preventDefault(); void dropSection(item.key); }} onDragEnd={() => { setDragSec(null); setOverKey(null); }} className={`rounded-2xl px-3 py-3 flex items-center gap-2 shadow-sm transition hover:shadow-md hover:-translate-y-px ${locked ? '' : 'cursor-grab active:cursor-grabbing'}`} style={{ background: 'var(--color-background)', border: overKey === `sec:${item.key}` ? '2px dashed var(--color-cyan-dark)' : '1px solid var(--color-border)', opacity: dragSec === item.key ? .45 : 1 }}>
                {locked ? <Lock className="w-4 h-4 shrink-0" style={{ color: 'var(--color-teal-dark)' }} aria-label="Locked at the top" /> : <GripVertical className="w-4 h-4 shrink-0" style={{ color: 'var(--color-text-muted)' }} aria-hidden="true" />}
                <div className="flex flex-col"><button type="button" disabled={locked || index<=1} onClick={()=>void moveSection(index,-1)} className="p-1 rounded disabled:opacity-30" title="Move section up"><ChevronUp className="w-4 h-4"/></button><button type="button" disabled={locked || index===allSectionLayout.length-1} onClick={()=>void moveSection(index,1)} className="p-1 rounded disabled:opacity-30" title="Move section down"><ChevronDown className="w-4 h-4"/></button></div>
                <button type="button" onClick={() => custom ? openRenameSection(custom) : openBuiltInSection(item)} className="min-w-0 flex-1 text-left" title="Click to edit this section"><p className="font-semibold text-sm truncate">{item.header || item.key}</p><p className="text-[11px] mt-1 line-clamp-2" style={{ color: 'var(--color-text-muted)' }}>{item.description || 'No helper text set.'}</p><p className="text-[10px] uppercase tracking-wider mt-1" style={{ color: 'var(--color-text-muted)' }}>{locked ? 'Locked at the top' : builtIn ? 'Built-in section' : 'Custom section'} · Order {index+1} · {item.active ? 'Visible' : 'Hidden'}</p></button>
                {custom ? <button type="button" className="p-2 rounded-lg" title={`Edit ${custom.name}`} aria-label={`Edit ${custom.name}`} onClick={() => openRenameSection(custom)}><Pencil className="w-3.5 h-3.5" /></button> : <button type="button" className="p-2 rounded-lg" title="Edit built-in section heading and text" aria-label="Edit built-in section" onClick={() => openBuiltInSection(item)}><Pencil className="w-3.5 h-3.5" /></button>}
              </div>;
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-6 xl:items-start">
          <div className="space-y-3 min-w-0 nl-admin-col" tabIndex={-1} aria-label="Questions list">
            <div className="rounded-2xl p-4" style={{ background: 'var(--color-paper)', border: '1px solid var(--color-border)' }}>
              <p className="text-sm font-semibold">Built-in profile fields</p>
              <p className="text-xs mt-1 mb-3" style={{ color: 'var(--color-text-muted)' }}>These ship with every profile. Edit their label, placeholder and default visibility. Name and Email are locked.</p>
              <div className="space-y-4">
                {(['reader_identity','reading_journey'] as const).map(sectionKey => {
                  const fields = CORE_FIELDS.filter(f => (sectionKey === 'reading_journey' ? f.section === 'Reading Journey' : f.section === 'Identity')).sort((a,b)=>(coreFieldOrder[a.key] ?? CORE_FIELDS.indexOf(a))-(coreFieldOrder[b.key] ?? CORE_FIELDS.indexOf(b)));
                  return <div key={sectionKey} className="rounded-2xl p-3" style={{background:'var(--color-background)',border:'1px solid var(--color-border)'}}><p className="text-xs uppercase tracking-wider font-bold mb-2" style={{color:'var(--color-teal-dark)'}}>{sectionKey === 'reading_journey' ? 'Reading Journey' : 'Build Your Reader Identity'}</p><div className="space-y-2">{fields.map((f,i)=><div key={f.key} className="rounded-xl p-3 flex items-center gap-2" style={{background:'var(--color-paper)',border:'1px solid var(--color-border)'}}><div className="flex flex-col"><button type="button" disabled={i===0} onClick={()=>void moveCoreField(f.key,-1)} className="p-1 rounded disabled:opacity-30" title="Move field up"><ChevronUp className="w-4 h-4"/></button><button type="button" disabled={i===fields.length-1} onClick={()=>void moveCoreField(f.key,1)} className="p-1 rounded disabled:opacity-30" title="Move field down"><ChevronDown className="w-4 h-4"/></button></div><div className="min-w-0 flex-1"><p className="text-[10px] uppercase tracking-wider font-bold" style={{color:'var(--color-teal-dark)'}}>{f.type}</p><p className="font-semibold text-sm truncate">{(coreOverrides[f.key]?.label || f.label)}</p><p className="text-[11px] mt-0.5" style={{color:'var(--color-text-muted)'}}>{f.key === 'name' || f.key === 'email' ? 'Built-in · locked' : `Built-in · ${coreActive(coreOverrides, f.key) ? 'shown on profile' : 'HIDDEN from profile'}`}</p></div>{f.locked ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{color:'var(--color-text-muted)'}}><Lock className="w-3.5 h-3.5"/> Locked</span> : <button type="button" onClick={()=>editCore(f.key)} className="btn-ghost !w-auto !px-3 text-xs">Edit</button>}</div>)}</div></div>;
                })}
              </div>
            </div>
            {questions.length === 0 ? <div className="py-10 text-center" style={{ color: 'var(--color-text-muted)' }}>No profile questions yet.</div> : <>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Drag a question by its card to reorder it, or drop it into another section column to move it there.</p>
              <div className="flex flex-col gap-4">
                {questionGroups.map(group => <section key={group.name} onDragOver={e => { if (dragQ) { e.preventDefault(); setOverKey(`g:${group.name}`); } }} onDrop={e => { e.preventDefault(); void dropQuestion(group.name, null); }} className="rounded-2xl p-3 space-y-2 min-w-0" style={{ background: 'var(--color-background)', border: overKey === `g:${group.name}` ? '2px dashed var(--color-cyan-dark)' : '1px solid var(--color-border)' }}>
                  <div className="flex items-center justify-between gap-2 px-1"><p className="text-xs uppercase tracking-wider font-bold truncate" style={{ color: 'var(--color-teal-dark)' }}>{group.header}</p><span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{group.items.length} question{group.items.length === 1 ? '' : 's'}{group.active ? '' : ' · hidden'}</span></div>
                  {group.items.length === 0 && <div className="rounded-xl py-6 text-center text-xs" style={{ border: '1px dashed var(--color-border)', color: 'var(--color-text-muted)' }}>Drop a question here</div>}
                  {group.items.map((q, i) => <div key={q.id} draggable onDragStart={e => { e.stopPropagation(); setDragQ(q.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', q.id); }} onDragOver={e => { if (dragQ) { e.preventDefault(); e.stopPropagation(); setOverKey(`q:${q.id}`); } }} onDrop={e => { e.preventDefault(); e.stopPropagation(); void dropQuestion(group.name, q.id); }} onDragEnd={() => { setDragQ(null); setOverKey(null); }} className="rounded-2xl p-3 cursor-grab active:cursor-grabbing" style={{ background: 'var(--color-paper)', border: overKey === `q:${q.id}` ? '2px dashed var(--color-cyan-dark)' : '1px solid var(--color-border)', opacity: dragQ === q.id ? .45 : 1 }}>
              <div className="flex gap-3">
                <GripVertical className="w-4 h-4 mt-1" style={{ color: 'var(--color-text-muted)' }} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full" style={{ background: 'rgba(8,145,178,.09)', color: 'var(--color-teal-dark)' }}>{q.section}</span>
                    <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{questionTypeLabel(q.type)}</span>
                    {q.required && <span className="text-[10px] font-bold">Required</span>}
                    {q.show_in_profile_card !== false && <span className="text-[10px] font-bold" style={{ color: 'var(--color-teal-dark)' }}>{q.profile_card_mode === 'answer_no_question' ? 'Answer only' : q.profile_card_mode === 'tag_no_question' ? 'Profile card · Tag (answer only)' : q.profile_card_mode === 'tag' ? 'Profile card · Tag' : 'Profile card · Q + A'}</span>}
                  </div>
                  <p className="font-semibold mt-2">{q.question}</p>
                  {q.options.length > 0 && <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Options: {q.options.join(' · ')}</p>}
                  {(q.type === 'select' || q.type === 'select_single' || q.type === 'select_multiple') && <p className="text-xs mt-1" style={{ color: 'var(--color-teal-dark)' }}>{q.type === 'select_multiple' ? 'Multiple answers' : 'Single answer'} · Other: {q.allow_other !== false ? 'Enabled' : 'Removed'}</p>}
                  {q.type === 'image_upload' && <p className="text-xs mt-1" style={{ color: 'var(--color-teal-dark)' }}>Images: {q.image_count || 1} · Max {q.image_max_mb || 5} MB · {q.image_max_width || 1600}×{q.image_max_height || 1600}px</p>}
                  <p className="text-xs mt-2" style={{ color: q.public_default ? 'var(--color-teal-dark)' : 'var(--color-text-muted)' }}><Eye className="inline w-3.5 h-3.5 mr-1" />{q.public_default ? 'Public by default' : 'Private by default'}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => void move(q, -1)} disabled={i === 0} className="p-2 rounded-lg" title="Move up"><ChevronUp className="w-4 h-4" /></button>
                  <button type="button" onClick={() => void move(q, 1)} disabled={i === group.items.length - 1} className="p-2 rounded-lg" title="Move down"><ChevronDown className="w-4 h-4" /></button>
                  <button type="button" onClick={() => editQuestion(q)} className="btn-ghost !w-auto !px-3 text-xs">Edit</button>
                  <button type="button" onClick={() => removeQuestion(q.id)} className="p-2 rounded-lg" title="Delete"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>)}
                </section>)}
              </div>
            </>}
          </div>

          <div ref={editorRef} className="rounded-2xl p-5 h-fit min-w-0 nl-admin-col" aria-label="Question editor" style={{ background: 'linear-gradient(160deg,rgba(8,145,178,.08),rgba(94,234,212,.08))', border: '1px solid var(--color-border)' }}>
            {editingCore && (() => { const def = CORE_FIELDS.find(f => f.key === editingCore)!; return <div className="space-y-3">
              <div className="flex items-center justify-between mb-1"><div><p className="text-xs uppercase tracking-wider font-semibold" style={{ color: 'var(--color-teal-dark)' }}>Edit built-in field</p><h3 className="font-serif text-xl font-semibold">{def.label}</h3></div><button type="button" className="p-2 rounded-lg" aria-label="Close" onClick={() => setEditingCore(null)}><X className="w-4 h-4" /></button></div>
              <div><label className="label">Field label</label><input value={coreLabelDraft} onChange={e => setCoreLabelDraft(e.target.value)} maxLength={80} className="input-field" /></div>
              <div><label className="label">Placeholder</label><input value={corePlaceholderDraft} onChange={e => setCorePlaceholderDraft(e.target.value)} maxLength={120} className="input-field" /></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={coreActiveDraft} onChange={e => setCoreActiveDraft(e.target.checked)} /> Show this field on the reader&apos;s profile page</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={coreVisibleDraft} onChange={e => setCoreVisibleDraft(e.target.checked)} /> Visible by default (readers can still change it with their eye control)</label>
              <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Section ({def.section}) and answer type ({def.type}) are fixed for built-in fields. Default visibility applies to readers who haven&apos;t saved a visibility choice yet.</p>
              <div className="flex gap-2"><button type="button" className="btn-primary flex-1" disabled={questionSaving} onClick={saveCore}><Save className="w-4 h-4" />{questionSaving ? 'Saving…' : 'Update field'}</button><button type="button" className="btn-ghost !w-auto" onClick={restoreCore}>Restore default</button></div>
            </div>; })()}
            <div className={editingCore ? 'hidden' : ''}>
            <div className="flex items-center justify-between mb-4"><div><p className="text-xs uppercase tracking-wider font-semibold" style={{ color: 'var(--color-teal-dark)' }}>{editing ? 'Edit question' : 'New question'}</p><h3 className="font-serif text-xl font-semibold">Question editor</h3></div>{editing && <button type="button" className="text-xs underline" onClick={resetQuestion}>Cancel</button>}</div>
            <div className="space-y-3">
              <div><label className="label">Section</label><select value={section} onChange={e => setSection(e.target.value)} className="input-field"><option value="">Choose a section…</option>{activeSections.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}</select></div>
              <div><label className="label">Question</label><input ref={questionInputRef} value={question} onChange={e => setQuestion(e.target.value)} placeholder="What book changed your life?" className="input-field" /></div>
              {(['short_text','long_text','number','year','url'] as ProfileQuestionType[]).includes(type) && <div>
                <label className="label">Answer placeholder</label>
                <input value={placeholder} onChange={e => setPlaceholder(e.target.value)} placeholder={type === 'long_text' ? 'Write a few lines about your reading life…' : type === 'number' ? 'e.g. 12' : type === 'year' ? 'e.g. 2018' : type === 'url' ? 'https://example.com/your-profile' : 'e.g. The book that changed everything'} className="input-field" />
                <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>Shown inside the answer field to guide users. It disappears once they type an answer.</p>
              </div>}
              <QuestionCardAppearancePreview profileCardMode={cardModeFor(profileCardMode, showQuestionInCard)} type={type} question={question} options={options.filter(Boolean)} allowOther={allowOther} imageCount={imageCount} placeholder={placeholder} imageMaxWidth={imageMaxWidth} imageMaxHeight={imageMaxHeight} />
              <div><label className="label">Question type</label><select value={type} onChange={e => setType(e.target.value as ProfileQuestionType)} className="input-field">{QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
              {(type === 'select' || type === 'select_single' || type === 'select_multiple') && <div className="space-y-3">
                <div className="flex items-center justify-between gap-3"><div><label className="label">Dropdown options</label><p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Each option has its own field. Add as many as needed.</p></div><div className="flex gap-2"><button type="button" className="btn-ghost !w-auto !px-3 text-xs" onClick={() => setOptions(v => [...v, ''])}><Plus className="w-3.5 h-3.5"/> Add option</button><button type="button" className="btn-ghost !w-auto !px-3 text-xs" onClick={() => setOptions(v => [...v].sort((a,b) => a.localeCompare(b, undefined, { sensitivity: 'base' })))}>A–Z</button></div></div>
                <div className="space-y-2">{options.map((option, index) => <div key={`opt-${index}`} className="flex items-center gap-2"><span className="w-7 text-center text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>{index + 1}</span><input value={option} onChange={e => setOptions(v => v.map((x, i) => i === index ? e.target.value : x))} placeholder={`Option ${index + 1}`} className="input-field flex-1"/><button type="button" className="p-2 rounded-lg" title="Remove option" aria-label={`Remove option ${index + 1}`} onClick={() => setOptions(v => v.filter((_, i) => i !== index))}><Trash2 className="w-4 h-4"/></button></div>)}</div>
                {type === 'select_multiple' && <div className="rounded-xl p-3" style={{ background: 'rgba(8,145,178,.08)', border: '1px solid var(--color-border)' }}><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div><label className="label">Maximum selections</label><select value={maxSelections == null ? 'none' : String(maxSelections)} onChange={e => setMaxSelections(e.target.value === 'none' ? null : Math.max(1, Number(e.target.value) || 1))} className="input-field"><option value="none">No cap</option>{Array.from({length: 20}, (_,i) => <option key={i+1} value={i+1}>{i+1} option{i ? 's' : ''}</option>)}</select><p className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>Controls how many choices a reader may select.</p></div><label className="flex items-center gap-2 text-sm mt-7"><input type="checkbox" checked={alphabeticalSort} onChange={e => setAlphabeticalSort(e.target.checked)} /> Sort answers A–Z</label></div></div>}
                {(type === 'select_single' || type === 'select') && <label className="flex items-center gap-2 text-sm rounded-xl p-3" style={{ background: 'rgba(8,145,178,.08)' }}><input type="checkbox" checked={alphabeticalSort} onChange={e => setAlphabeticalSort(e.target.checked)} /> Sort answer choices A–Z</label>}
                <div className="flex items-center justify-between rounded-xl p-3" style={{ background: 'rgba(8,145,178,.08)', border: '1px solid var(--color-border)' }}><div><p className="text-sm font-semibold">Other</p><p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Lets users enter their own answer. Present by default until removed.</p></div><button type="button" role="switch" aria-checked={allowOther} onClick={() => setAllowOther(v => !v)} className={`relative h-6 w-11 rounded-full transition ${allowOther ? 'bg-teal-500' : 'bg-slate-300 dark:bg-slate-700'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${allowOther ? 'left-6' : 'left-1'}`} /></button></div>
              </div>}
              {type === 'image_upload' && <div className="space-y-3 rounded-2xl p-4" style={{ background: 'rgba(8,145,178,.08)', border: '1px solid var(--color-border)' }}>
                <div className="flex items-center gap-2"><ImagePlus className="w-4 h-4" style={{ color: 'var(--color-teal-dark)' }}/><p className="text-sm font-semibold">Image answer settings</p></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div><label className="label">Image spaces</label><input type="number" min={1} max={6} value={imageCount} onChange={e => setImageCount(Math.max(1, Math.min(6, Number(e.target.value) || 1)))} className="input-field"/><p className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>How many images users can add.</p></div><div><label className="label">Max size per image (MB)</label><input type="number" min={1} max={5} step={1} value={imageMaxMb} onChange={e => setImageMaxMb(Math.max(1, Math.min(5, Number(e.target.value) || 1)))} className="input-field"/><p className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>Maximum file size per image.</p></div><div><label className="label">Max width (px)</label><input type="number" min={320} max={6000} step={10} value={imageMaxWidth} onChange={e => setImageMaxWidth(Math.max(320, Math.min(6000, Number(e.target.value) || 320)))} className="input-field"/><p className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>Admin-set longest allowed width.</p></div><div><label className="label">Max height (px)</label><input type="number" min={320} max={6000} step={10} value={imageMaxHeight} onChange={e => setImageMaxHeight(Math.max(320, Math.min(6000, Number(e.target.value) || 320)))} className="input-field"/><p className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>Admin-set longest allowed height.</p></div></div>
              </div>}
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={required} onChange={e => setRequired(e.target.checked)} /> Required</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={publicDefault} onChange={e => setPublicDefault(e.target.checked)} /> Visible by default</label>
              <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(0,151,178,.08)' }}><p className="text-sm font-semibold">Profile card presentation</p><div className="grid grid-cols-1 sm:grid-cols-2 gap-2"><label className="flex items-center gap-2 text-sm rounded-lg p-2 border"><input type="radio" name="profile-card-mode" checked={profileCardMode === 'tag'} onChange={() => setProfileCardMode('tag')} /> Tag</label><label className="flex items-center gap-2 text-sm rounded-lg p-2 border"><input type="radio" name="profile-card-mode" checked={profileCardMode !== 'tag'} onChange={() => setProfileCardMode('answer')} /> Answer</label></div><label className="flex items-center gap-2 text-sm rounded-lg p-2 border mt-2"><input type="checkbox" checked={showQuestionInCard} onChange={e => setShowQuestionInCard(e.target.checked)} /> <span><strong>Show question</strong> on the profile card (turn off to show only the answer, as a tag or as an answer)</span></label><p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Use this control to show or hide the question label while keeping the saved answer visible. “Show answer on profile card” still controls whether the question is included at all.</p></div>
              <button type="button" className="btn-primary w-full" disabled={questionSaving} onClick={saveQuestion}><Save className="w-4 h-4" />{questionSaving ? (editing ? 'Updating…' : 'Saving…') : (editing ? 'Update question' : 'Add question')}</button>
            </div>
            </div>
          </div>
        </div>
      </section>

      {sectionEditorOpen && <div className="fixed inset-0 z-[80] grid place-items-center p-4" style={{ background: 'rgba(2,20,26,.52)', backdropFilter: 'blur(6px)' }} onMouseDown={e => { if (e.target === e.currentTarget) setSectionEditorOpen(false); }}>
        <div role="dialog" aria-modal="true" aria-labelledby="section-dialog-title" className="w-full max-w-md rounded-3xl p-6 shadow-2xl" style={{ background: 'var(--color-paper)', border: '1px solid var(--color-border)' }}>
          <div className="flex items-center justify-between gap-3 mb-5"><div><p className="text-xs uppercase tracking-wider font-semibold" style={{ color: 'var(--color-teal-dark)' }}>{editingSection ? 'Edit section' : 'New section'}</p><h3 id="section-dialog-title" className="font-serif text-2xl font-semibold">{editingSection ? `Edit “${editingSection.header || editingSection.name}”` : 'Add profile question section'}</h3></div><button type="button" className="p-2 rounded-full" aria-label="Close" onClick={() => setSectionEditorOpen(false)}><X className="w-5 h-5" /></button></div>
          <div className="space-y-4"><div><label className="label">Internal section name</label><input autoFocus value={sectionName} onChange={e => setSectionName(e.target.value)} placeholder="Reading Habits" className="input-field" /></div><div><label className="label">Section header shown to readers</label><input value={sectionHeader} onChange={e => setSectionHeader(e.target.value)} placeholder="Your reading habits" className="input-field" /></div><div><label className="label">Text under the heading</label><textarea value={sectionDescription} onChange={e => setSectionDescription(e.target.value)} placeholder="Tell us a little about this part of your reader identity." rows={3} className="input-field resize-y" /></div><div className="grid grid-cols-2 gap-3"><div><label className="label">Section order</label><input type="number" value={sectionOrder} onChange={e => setSectionOrder(Number(e.target.value) || 0)} className="input-field" /></div><label className="flex items-center gap-2 text-sm mt-7"><input type="checkbox" checked={sectionActive} onChange={e => setSectionActive(e.target.checked)} /> Show section</label></div></div>
          <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>{editingSection?.id.startsWith('builtin:') ? 'Built-in section: heading, helper text, visibility and order are editable. The underlying fields remain built-in.' : editingSection ? 'Changing the internal name also updates every existing question assigned to it. Header and helper text are what readers see.' : 'The new section is immediately available for profile questions.'}</p>
          <div className="flex justify-end gap-2 mt-6"><button type="button" className="btn-ghost !w-auto" onClick={() => setSectionEditorOpen(false)}>Cancel</button><button type="button" className="btn-primary !w-auto" disabled={sectionSaving} onClick={saveSection}>{sectionSaving ? 'Saving…' : editingSection ? 'Save section settings' : 'Add section'}</button></div>
        </div>
      </div>}

        </>
      )}

      {msg && <p className="mt-4 text-sm" style={{ color: 'var(--color-teal-dark)' }}>{msg}</p>}
    </div>
  </div>;
}

function questionTypeLabel(type: ProfileQuestion['type']): string {
  if (type === 'select' || type === 'select_single') return 'Dropdown · Single select';
  if (type === 'select_multiple') return 'Dropdown · Multiple select';
  return QUESTION_TYPES.find(x => x.value === type)?.label || type.replace(/_/g, ' ');
}

const cardModeFor = (kind: 'tag' | 'answer', showQuestion: boolean): NonNullable<ProfileQuestion['profile_card_mode']> => kind === 'tag' ? (showQuestion ? 'tag' : 'tag_no_question') : (showQuestion ? 'answer' : 'answer_no_question');
function QuestionCardAppearancePreview({
  profileCardMode,
  type,
  question,
  options,
  allowOther,
  imageCount,
  placeholder,
  imageMaxWidth,
  imageMaxHeight,
}: {
  profileCardMode?: ProfileQuestion['profile_card_mode'];
  type: ProfileQuestion['type'];
  question: string;
  options: string[];
  allowOther: boolean;
  imageCount: number;
  placeholder: string;
  imageMaxWidth?: number;
  imageMaxHeight?: number;
}) {
  const title = question.trim() || 'Your question will appear here';
  const sample = options[0] || 'Sample answer';
  const multiple = options.slice(0, 2);
  const textPreview = placeholder.trim() || (type === 'long_text' ? 'A short reader note…' : type === 'number' ? (placeholder || '24') : type === 'year' ? (placeholder || '2018') : type === 'url' ? (placeholder || 'example.com') : (placeholder || 'Example answer'));
  return <div className="rounded-2xl border p-4" style={{ background: 'linear-gradient(145deg,rgba(1,43,54,.92),rgba(5,72,82,.74))', borderColor: 'rgba(103,232,249,.18)', boxShadow: '0 10px 28px rgba(0,25,35,.16)' }}>
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[.18em]" style={{ color: '#a5f3fc' }}>Profile card preview</p>
        <p className="text-xs mt-1 text-white/60">This is how the saved answer is intended to appear.</p>
      </div>
      <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-100">Live</span>
    </div>
    <div className="mt-3 rounded-2xl border border-white/10 bg-black/10 p-4">
      {profileCardMode !== 'answer_no_question' && profileCardMode !== 'tag_no_question' && <p className="text-xs font-bold uppercase tracking-[.12em] text-cyan-200">{title}</p>}
      {type === 'image_upload' ? <div className={`mt-3 grid gap-2 ${imageCount > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {Array.from({ length: Math.min(imageCount || 1, 3) }).map((_, i) => <div key={i} className="aspect-square rounded-xl border border-dashed border-cyan-200/30 bg-white/[0.05] grid place-items-center text-[10px] text-white/40">Image {i + 1}</div>)}{imageMaxWidth && imageMaxHeight && <p className="col-span-full text-[10px] text-white/45">Up to {imageMaxWidth} × {imageMaxHeight}px</p>}
      </div> : type === 'select_multiple' ? <div className="mt-3 flex flex-wrap gap-1.5">
        {(multiple.length ? multiple : ['Choice 1', 'Choice 2']).map(v => <span key={v} className="rounded-full bg-cyan-300/15 px-2.5 py-1.5 text-xs font-semibold text-cyan-100">{v}</span>)}
        {allowOther && <span className="rounded-full bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-white/70">Other</span>}
      </div> : type === 'select_single' || type === 'select' ? <div className="mt-3"><span className="inline-flex rounded-full bg-cyan-300/15 px-3 py-1.5 text-sm font-semibold text-cyan-100">{sample}</span>{allowOther && <span className="ml-2 text-xs text-white/50">or Other</span>}</div> : type === 'long_text' ? <p className="mt-2 text-sm leading-6 text-white/80">{textPreview}</p> : <p className="mt-2 font-serif text-xl font-semibold text-white">{textPreview}</p>}
    </div>
  </div>;
}
