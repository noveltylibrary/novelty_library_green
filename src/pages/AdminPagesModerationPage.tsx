import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, FileText, Save, ExternalLink, Plus, Trash2, ChevronUp, ChevronDown, GripVertical, Eye, ListChecks, LayoutTemplate, Pencil, FolderPlus, X, ImagePlus } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { fetchEditablePage, saveEditablePage, PAGE_DEFAULTS } from '@/lib/adminConfig';
import { AdminReviewGuidelinesEditor } from '@/components/AdminReviewGuidelinesEditor';
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

const PAGE_KEYS = ['review-guidelines', 'about', 'privacy', 'terms'] as const;
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
  const [editing, setEditing] = useState<ProfileQuestion | null>(null);
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

  const [sectionEditorOpen, setSectionEditorOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<ProfileQuestionSection | null>(null);
  const [sectionName, setSectionName] = useState('');
  const [sectionSaving, setSectionSaving] = useState(false);

  const orderedSections = useMemo(
    () => [...sections].filter(s => s.active).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    [sections]
  );

  const loadPage = async (slug: typeof PAGE_KEYS[number]) => {
    const page = await fetchEditablePage(slug);
    setTitle(page.title);
    setContent(page.content);
  };

  const loadProfileBuilder = async () => {
    try {
      const [sectionRows, questionRows] = await Promise.all([
        fetchProfileSections(true),
        fetchProfileQuestions(true),
      ]);
      setSections(sectionRows);
      setQuestions(questionRows);
      setSection(current => current || sectionRows[0]?.name || '');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not load profile form builder.');
    }
  };

  useEffect(() => { if (isAdmin) void loadPage(active); }, [isAdmin, active]);
  useEffect(() => { if (isAdmin) void loadProfileBuilder(); }, [isAdmin]);

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

  const resetQuestion = () => {
    setEditing(null);
    setQuestion('');
    setPlaceholder('');
    setSection(orderedSections[0]?.name || '');
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
  };

  const editQuestion = (q: ProfileQuestion) => {
    setAdminView('profile');
    setProfilePreview(false);
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

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= questions.length) return;
    const next = [...questions];
    [next[index], next[target]] = [next[target], next[index]];
    setQuestions(next);
    try {
      await reorderProfileQuestions(next.map(q => q.id));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not reorder questions.');
    }
  };

  const openAddSection = () => {
    setEditingSection(null);
    setSectionName('');
    setSectionEditorOpen(true);
  };

  const openRenameSection = (s: ProfileQuestionSection) => {
    setEditingSection(s);
    setSectionName(s.name);
    setSectionEditorOpen(true);
  };

  const saveSection = async () => {
    if (!sectionName.trim()) {
      setMsg('Enter a section name first.');
      return;
    }
    try {
      setSectionSaving(true);
      const saved = await saveProfileQuestionSection({
        id: editingSection?.id,
        name: sectionName,
        sort_order: editingSection?.sort_order ?? ((orderedSections.at(-1)?.sort_order ?? 0) + 10),
      });
      setSections(current => {
        const next = editingSection
          ? current.map(x => x.id === saved.id ? saved : x)
          : [...current, saved];
        return next.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
      });
      setSection(saved.name);
      setMsg(editingSection ? 'Section renamed. Existing questions were updated to the new name.' : 'Section added.');
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
        <p className="text-sm mt-2" style={{ color: 'var(--color-text-muted)' }}>Edit the four heavy-text pages or manage the reader profile and its question-driven card.</p>
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
            <button className="w-full btn-ghost text-xs" onClick={() => navigate(`/${active}`)}><ExternalLink className="w-3.5 h-3.5" /> Preview page</button>
          </div>
        </aside>

        {active === 'review-guidelines' ? <AdminReviewGuidelinesEditor /> : <section className="surface-card p-6">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div><p className="text-xs uppercase tracking-widest font-semibold" style={{ color: 'var(--color-teal-dark)' }}>Editing</p><h2 className="font-serif text-2xl font-semibold">{title}</h2></div>
            <button className="btn-primary !w-auto" disabled={saving} onClick={save}><Save className="w-4 h-4" />{saving ? 'Saving…' : 'Save Page'}</button>
          </div>
          <div className="space-y-4">
            <div><label className="label">Page title</label><input value={title} onChange={e => setTitle(e.target.value)} className="input-field" /></div>
            <div><label className="label">Page copy</label><textarea value={content} onChange={e => setContent(e.target.value)} className="input-field min-h-[520px] resize-y font-mono text-sm leading-6" /></div>
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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">{questions.filter(q => q.show_in_profile_card !== false).slice(0, 12).map(q => <QuestionCardAppearancePreview key={q.id} type={q.type} question={q.question} options={q.options.filter(Boolean)} allowOther={q.allow_other !== false} imageCount={q.image_count || 1} placeholder={q.placeholder || ''} imageMaxWidth={q.image_max_width || 1600} imageMaxHeight={q.image_max_height || 1600} />)}</div>
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
            <div><p className="text-sm font-semibold">Profile question sections</p><p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>The four current sections are editable. Add as many additional sections as your profile needs.</p></div>
            <button type="button" className="btn-primary !w-auto" onClick={openAddSection}><FolderPlus className="w-4 h-4" /> Add section</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {orderedSections.map((s, index) => <div key={s.id} className="rounded-xl p-3 flex items-center gap-2" style={{ background: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
              <div className="min-w-0 flex-1"><p className="font-semibold text-sm truncate">{s.name}</p><p className="text-[10px] uppercase tracking-wider mt-1" style={{ color: 'var(--color-text-muted)' }}>{index < 4 ? 'Default section' : 'Added section'}</p></div>
              <button type="button" className="p-2 rounded-lg" title={`Rename ${s.name}`} aria-label={`Rename ${s.name}`} onClick={() => openRenameSection(s)}><Pencil className="w-3.5 h-3.5" /></button>
            </div>)}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
          <div className="space-y-3">
            {questions.length === 0 ? <div className="py-10 text-center" style={{ color: 'var(--color-text-muted)' }}>No profile questions yet.</div> : questions.map((q, i) => <div key={q.id} className="rounded-2xl p-4" style={{ background: 'var(--color-paper)', border: '1px solid var(--color-border)' }}>
              <div className="flex gap-3">
                <GripVertical className="w-4 h-4 mt-1" style={{ color: 'var(--color-text-muted)' }} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full" style={{ background: 'rgba(8,145,178,.09)', color: 'var(--color-teal-dark)' }}>{q.section}</span>
                    <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{questionTypeLabel(q.type)}</span>
                    {q.required && <span className="text-[10px] font-bold">Required</span>}
                    {q.show_in_profile_card !== false && <span className="text-[10px] font-bold" style={{ color: 'var(--color-teal-dark)' }}>Profile card</span>}
                  </div>
                  <p className="font-semibold mt-2">{q.question}</p>
                  {q.options.length > 0 && <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Options: {q.options.join(' · ')}</p>}
                  {(q.type === 'select' || q.type === 'select_single' || q.type === 'select_multiple') && <p className="text-xs mt-1" style={{ color: 'var(--color-teal-dark)' }}>{q.type === 'select_multiple' ? 'Multiple answers' : 'Single answer'} · Other: {q.allow_other !== false ? 'Enabled' : 'Removed'}</p>}
                  {q.type === 'image_upload' && <p className="text-xs mt-1" style={{ color: 'var(--color-teal-dark)' }}>Images: {q.image_count || 1} · Max {q.image_max_mb || 5} MB · {q.image_max_width || 1600}×{q.image_max_height || 1600}px</p>}
                  <p className="text-xs mt-2" style={{ color: q.public_default ? 'var(--color-teal-dark)' : 'var(--color-text-muted)' }}><Eye className="inline w-3.5 h-3.5 mr-1" />{q.public_default ? 'Public by default' : 'Private by default'}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="p-2 rounded-lg" title="Move up"><ChevronUp className="w-4 h-4" /></button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === questions.length - 1} className="p-2 rounded-lg" title="Move down"><ChevronDown className="w-4 h-4" /></button>
                  <button type="button" onClick={() => editQuestion(q)} className="btn-ghost !w-auto !px-3 text-xs">Edit</button>
                  <button type="button" onClick={() => removeQuestion(q.id)} className="p-2 rounded-lg" title="Delete"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>)}
          </div>

          <div ref={editorRef} className="rounded-2xl p-5 h-fit lg:sticky lg:top-24" style={{ background: 'linear-gradient(160deg,rgba(8,145,178,.08),rgba(94,234,212,.08))', border: '1px solid var(--color-border)' }}>
            <div className="flex items-center justify-between mb-4"><div><p className="text-xs uppercase tracking-wider font-semibold" style={{ color: 'var(--color-teal-dark)' }}>{editing ? 'Edit question' : 'New question'}</p><h3 className="font-serif text-xl font-semibold">Question editor</h3></div>{editing && <button type="button" className="text-xs underline" onClick={resetQuestion}>Cancel</button>}</div>
            <div className="space-y-3">
              <div><label className="label">Section</label><select value={section} onChange={e => setSection(e.target.value)} className="input-field"><option value="">Choose a section…</option>{orderedSections.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}</select></div>
              <div><label className="label">Question</label><input ref={questionInputRef} value={question} onChange={e => setQuestion(e.target.value)} placeholder="What book changed your life?" className="input-field" /></div>
              {(['short_text','long_text','number','year','url'] as ProfileQuestionType[]).includes(type) && <div>
                <label className="label">Answer placeholder</label>
                <input value={placeholder} onChange={e => setPlaceholder(e.target.value)} placeholder={type === 'long_text' ? 'Write a few lines about your reading life…' : type === 'number' ? 'e.g. 12' : type === 'year' ? 'e.g. 2018' : type === 'url' ? 'https://example.com/your-profile' : 'e.g. The book that changed everything'} className="input-field" />
                <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>Shown inside the answer field to guide users. It disappears once they type an answer.</p>
              </div>}
              <QuestionCardAppearancePreview type={type} question={question} options={options.filter(Boolean)} allowOther={allowOther} imageCount={imageCount} placeholder={placeholder} imageMaxWidth={imageMaxWidth} imageMaxHeight={imageMaxHeight} />
              <div><label className="label">Question type</label><select value={type} onChange={e => setType(e.target.value as ProfileQuestionType)} className="input-field">{QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
              {(type === 'select' || type === 'select_single' || type === 'select_multiple') && <div className="space-y-3">
                <div className="flex items-center justify-between gap-3"><div><label className="label">Dropdown options</label><p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Each option has its own field. Add as many as needed.</p></div><button type="button" className="btn-ghost !w-auto !px-3 text-xs" onClick={() => setOptions(v => [...v, ''])}><Plus className="w-3.5 h-3.5"/> Add option</button></div>
                <div className="space-y-2">{options.map((option, index) => <div key={`opt-${index}`} className="flex items-center gap-2"><span className="w-7 text-center text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>{index + 1}</span><input value={option} onChange={e => setOptions(v => v.map((x, i) => i === index ? e.target.value : x))} placeholder={`Option ${index + 1}`} className="input-field flex-1"/><button type="button" className="p-2 rounded-lg" title="Remove option" aria-label={`Remove option ${index + 1}`} onClick={() => setOptions(v => v.filter((_, i) => i !== index))}><Trash2 className="w-4 h-4"/></button></div>)}</div>
                <div className="flex items-center justify-between rounded-xl p-3" style={{ background: 'rgba(8,145,178,.08)', border: '1px solid var(--color-border)' }}><div><p className="text-sm font-semibold">Other</p><p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Lets users enter their own answer. Present by default until removed.</p></div><button type="button" role="switch" aria-checked={allowOther} onClick={() => setAllowOther(v => !v)} className={`relative h-6 w-11 rounded-full transition ${allowOther ? 'bg-teal-500' : 'bg-slate-300 dark:bg-slate-700'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${allowOther ? 'left-6' : 'left-1'}`} /></button></div>
              </div>}
              {type === 'image_upload' && <div className="space-y-3 rounded-2xl p-4" style={{ background: 'rgba(8,145,178,.08)', border: '1px solid var(--color-border)' }}>
                <div className="flex items-center gap-2"><ImagePlus className="w-4 h-4" style={{ color: 'var(--color-teal-dark)' }}/><p className="text-sm font-semibold">Image answer settings</p></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div><label className="label">Image spaces</label><input type="number" min={1} max={6} value={imageCount} onChange={e => setImageCount(Math.max(1, Math.min(6, Number(e.target.value) || 1)))} className="input-field"/><p className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>How many images users can add.</p></div><div><label className="label">Max size per image (MB)</label><input type="number" min={1} max={5} step={1} value={imageMaxMb} onChange={e => setImageMaxMb(Math.max(1, Math.min(5, Number(e.target.value) || 1)))} className="input-field"/><p className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>Maximum file size per image.</p></div><div><label className="label">Max width (px)</label><input type="number" min={320} max={6000} step={10} value={imageMaxWidth} onChange={e => setImageMaxWidth(Math.max(320, Math.min(6000, Number(e.target.value) || 320)))} className="input-field"/><p className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>Admin-set longest allowed width.</p></div><div><label className="label">Max height (px)</label><input type="number" min={320} max={6000} step={10} value={imageMaxHeight} onChange={e => setImageMaxHeight(Math.max(320, Math.min(6000, Number(e.target.value) || 320)))} className="input-field"/><p className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>Admin-set longest allowed height.</p></div></div>
              </div>}
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={required} onChange={e => setRequired(e.target.checked)} /> Required</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={publicDefault} onChange={e => setPublicDefault(e.target.checked)} /> Visible by default</label>
              <label className="flex items-center gap-2 text-sm rounded-xl p-3" style={{ background: 'rgba(0,151,178,.08)' }}><input type="checkbox" checked={showInCard} onChange={e => setShowInCard(e.target.checked)} /> Show answer on profile card</label>
              <button type="button" className="btn-primary w-full" disabled={questionSaving} onClick={saveQuestion}><Save className="w-4 h-4" />{questionSaving ? (editing ? 'Updating…' : 'Saving…') : (editing ? 'Update question' : 'Add question')}</button>
            </div>
          </div>
        </div>
      </section>

      {sectionEditorOpen && <div className="fixed inset-0 z-[80] grid place-items-center p-4" style={{ background: 'rgba(2,20,26,.52)', backdropFilter: 'blur(6px)' }} onMouseDown={e => { if (e.target === e.currentTarget) setSectionEditorOpen(false); }}>
        <div role="dialog" aria-modal="true" aria-labelledby="section-dialog-title" className="w-full max-w-md rounded-3xl p-6 shadow-2xl" style={{ background: 'var(--color-paper)', border: '1px solid var(--color-border)' }}>
          <div className="flex items-center justify-between gap-3 mb-5"><div><p className="text-xs uppercase tracking-wider font-semibold" style={{ color: 'var(--color-teal-dark)' }}>{editingSection ? 'Rename section' : 'New section'}</p><h3 id="section-dialog-title" className="font-serif text-2xl font-semibold">{editingSection ? `Rename “${editingSection.name}”` : 'Add profile question section'}</h3></div><button type="button" className="p-2 rounded-full" aria-label="Close" onClick={() => setSectionEditorOpen(false)}><X className="w-5 h-5" /></button></div>
          <label className="label">Section name</label><input autoFocus value={sectionName} onChange={e => setSectionName(e.target.value)} placeholder="Reading Habits" className="input-field" onKeyDown={e => { if (e.key === 'Enter') void saveSection(); }} />
          <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>{editingSection ? 'Renaming a section also updates every existing question assigned to it.' : 'The new section will be added after the existing sections.'}</p>
          <div className="flex justify-end gap-2 mt-6"><button type="button" className="btn-ghost !w-auto" onClick={() => setSectionEditorOpen(false)}>Cancel</button><button type="button" className="btn-primary !w-auto" disabled={sectionSaving} onClick={saveSection}>{sectionSaving ? 'Saving…' : editingSection ? 'Rename section' : 'Add section'}</button></div>
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

function QuestionCardAppearancePreview({
  type,
  question,
  options,
  allowOther,
  imageCount,
  placeholder,
  imageMaxWidth,
  imageMaxHeight,
}: {
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
      <p className="text-xs font-bold uppercase tracking-[.12em] text-cyan-200">{title}</p>
      {type === 'image_upload' ? <div className={`mt-3 grid gap-2 ${imageCount > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {Array.from({ length: Math.min(imageCount || 1, 3) }).map((_, i) => <div key={i} className="aspect-square rounded-xl border border-dashed border-cyan-200/30 bg-white/[0.05] grid place-items-center text-[10px] text-white/40">Image {i + 1}</div>)}{imageMaxWidth && imageMaxHeight && <p className="col-span-full text-[10px] text-white/45">Up to {imageMaxWidth} × {imageMaxHeight}px</p>}
      </div> : type === 'select_multiple' ? <div className="mt-3 flex flex-wrap gap-1.5">
        {(multiple.length ? multiple : ['Choice 1', 'Choice 2']).map(v => <span key={v} className="rounded-full bg-cyan-300/15 px-2.5 py-1.5 text-xs font-semibold text-cyan-100">{v}</span>)}
        {allowOther && <span className="rounded-full bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-white/70">Other</span>}
      </div> : type === 'select_single' || type === 'select' ? <div className="mt-3"><span className="inline-flex rounded-full bg-cyan-300/15 px-3 py-1.5 text-sm font-semibold text-cyan-100">{sample}</span>{allowOther && <span className="ml-2 text-xs text-white/50">or Other</span>}</div> : type === 'long_text' ? <p className="mt-2 text-sm leading-6 text-white/80">{textPreview}</p> : <p className="mt-2 font-serif text-xl font-semibold text-white">{textPreview}</p>}
    </div>
  </div>;
}
