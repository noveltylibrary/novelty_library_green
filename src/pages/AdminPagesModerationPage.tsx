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
  isLegacyProfileFieldKey,
  type ProfileQuestion,
  type ProfileQuestionType,
  type ProfileQuestionSection,
} from '@/lib/profileQuestions';
import { convertReadingJourneyToQuestions } from '@/lib/profileReadingMigration';
import { CORE_FIELDS, coreActive, coreDefaultSection, coreFieldsInSection, coreSection, fetchCoreOverrides, saveCoreOverride, resetCoreOverride, fetchCoreFieldOrder, saveCoreFieldPlacement, type CoreFieldKey, type CoreOverrides, type CoreFieldOrder, type CoreSectionKey } from '@/lib/profileCoreFields';
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
  const [coreSectionDraft, setCoreSectionDraft] = useState<CoreSectionKey>('reader_identity');
  const [converting, setConverting] = useState(false);
  const [dragField, setDragField] = useState<CoreFieldKey | null>(null);
  const [fieldPreview, setFieldPreview] = useState<Record<CoreSectionKey, CoreFieldKey[]> | null>(null);
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
  // Once converted, the old built-in reading section is replaced by a normal question section of the same name.
  const readingConverted = sectionLayout.some(x => x.key === 'reading_journey' && x.converted === true);
  const [dragQ, setDragQ] = useState<string | null>(null);
  const [dragSec, setDragSec] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const [secPreview, setSecPreview] = useState<string[] | null>(null);
  const [qPreview, setQPreview] = useState<ProfileQuestion[] | null>(null);
  // The 'profile_questions' layout entry only holds the heading shown above the section tiles
  // (it is not a tile), so it is edited separately and never takes part in ordering.
  const hubItem = useMemo(() => allSectionLayout.find(x => x.key === 'profile_questions') || null, [allSectionLayout]);
  const sortableSections = useMemo(() => allSectionLayout.filter(x => x.key !== 'profile_questions' && !(x.key === 'reading_journey' && readingConverted)), [allSectionLayout, readingConverted]);
  const shownSections = useMemo(() => {
    if (!secPreview) return sortableSections;
    const byKey = new Map(sortableSections.map(x => [x.key, x]));
    return secPreview.map(k => byKey.get(k)).filter((x): x is ProfileSectionLayoutItem => !!x);
  }, [secPreview, sortableSections]);
  const questionGroups = useMemo(() => {
    const byOrder = (a: ProfileQuestion, b: ProfileQuestion) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0);
    const source = qPreview ?? questions;
    const groups = orderedSections.map(sec => ({ name: sec.name, header: sec.header || sec.name, active: sec.active, items: source.filter(q => q.section === sec.name).sort(byOrder) }));
    const known = new Set(orderedSections.map(x => x.name));
    [...new Set(source.filter(q => !known.has(q.section)).map(q => q.section))].forEach(name => groups.push({ name, header: `${name} (no section)`, active: false, items: source.filter(q => q.section === name).sort(byOrder) }));
    return groups;
  }, [orderedSections, questions, qPreview]);
  const activeSections = useMemo(() => orderedSections.filter(s => s.active), [orderedSections]);
  // Built-in fields grouped by the built-in section they currently live in (drag preview wins while dragging).
  const coreLists = useMemo<Record<CoreSectionKey, CoreFieldKey[]>>(() => fieldPreview ?? {
    reader_identity: coreFieldsInSection(coreOverrides, coreFieldOrder, 'reader_identity').map(f => f.key),
    reading_journey: coreFieldsInSection(coreOverrides, coreFieldOrder, 'reading_journey').map(f => f.key),
  }, [fieldPreview, coreOverrides, coreFieldOrder]);

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
    setCoreSectionDraft(coreSection(coreOverrides, key));
    requestAnimationFrame(() => editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  };

  const saveCore = async () => {
    if (!editingCore) return;
    if (!coreLabelDraft.trim()) { setMsg('Enter a field label first.'); return; }
    try {
      setQuestionSaving(true);
      setCoreOverrides(await saveCoreOverride(editingCore, { label: coreLabelDraft.trim(), placeholder: corePlaceholderDraft, defaultVisible: coreVisibleDraft, active: coreActiveDraft, section: coreSectionDraft === coreDefaultSection(editingCore) ? undefined : coreSectionDraft }));
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
        // Answers are stored under the question key, so an edit must never change it.
        key: editing?.key,
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
    const target = questions.find(x => x.id === id);
    if (!confirm(target && isLegacyProfileFieldKey(target.key) ? 'Remove this reading question? It disappears from readers\' profiles and cards; the answers already saved stay in their profiles.' : 'Remove this profile question?')) return;
    try {
      await deleteProfileQuestion(id);
      setQuestions(v => v.filter(x => x.id !== id));
      setMsg('Question removed.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not remove question.');
    }
  };

  // Moves question `id` into `sectionName`, taking the slot of `targetId` (or going to the end).
  // Dragging downwards lands it after the target, upwards before it, so it always replaces the one it is dragged onto.
  const moveInList = (base: ProfileQuestion[], id: string, sectionName: string, targetId: string | null): ProfileQuestion[] => {
    const moving = base.find(q => q.id === id);
    if (!moving) return base;
    const byOrder = (x: ProfileQuestion, y: ProfileQuestion) => (Number(x.sort_order) || 0) - (Number(y.sort_order) || 0);
    const names = questionGroups.map(g => g.name);
    const lists = new Map<string, ProfileQuestion[]>(names.map(n => [n, base.filter(q => q.section === n).sort(byOrder)]));
    const src = lists.get(moving.section) ?? [];
    const oi = src.findIndex(q => q.id === id);
    lists.set(moving.section, src.filter(q => q.id !== id));
    const tgt = lists.get(sectionName) ?? [];
    let idx = tgt.length;
    if (targetId) {
      const found = tgt.findIndex(q => q.id === targetId);
      if (found >= 0) {
        idx = found;
        if (moving.section === sectionName && oi >= 0 && oi < src.findIndex(q => q.id === targetId)) idx += 1;
      }
    }
    tgt.splice(idx, 0, { ...moving, section: sectionName });
    lists.set(sectionName, tgt);
    return names.flatMap(n => lists.get(n) ?? []).map((q, i) => ({ ...q, sort_order: i }));
  };

  const previewQuestion = (sectionName: string, targetId: string | null) => {
    if (!dragQ || dragQ === targetId) return;
    setQPreview(moveInList(qPreview ?? questions, dragQ, sectionName, targetId));
  };

  const persistQuestions = async (next: ProfileQuestion[], id: string) => {
    const before = questions.find(q => q.id === id);
    const after = next.find(q => q.id === id);
    if (!before || !after) return;
    const previous = questions;
    setQuestions(next);
    try {
      if (before.section !== after.section) await saveProfileQuestion({ ...before, section: after.section });
      await reorderProfileQuestions(next.map(q => q.id));
      setMsg(before.section !== after.section ? `Moved to “${after.section}” and order saved.` : 'Question order saved.');
      await loadProfileBuilder();
    } catch (e) {
      setQuestions(previous);
      setMsg(e instanceof Error ? e.message : 'Could not reorder questions.');
    }
  };

  const commitQuestions = async () => {
    const next = qPreview; const id = dragQ;
    setQPreview(null); setDragQ(null); setOverKey(null);
    if (next && id) await persistQuestions(next, id);
  };

  const cancelQuestionDrag = () => { setQPreview(null); setDragQ(null); setOverKey(null); };

  const move = async (q: ProfileQuestion, direction: -1 | 1) => {
    const group = questionGroups.find(g => g.name === q.section);
    const target = group?.items[(group?.items.findIndex(x => x.id === q.id) ?? 0) + direction];
    if (!group || !target) return;
    await persistQuestions(moveInList(questions, q.id, q.section, target.id), q.id);
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

  const previewSection = (targetKey: string) => {
    const from = dragSec;
    if (!from || from === targetKey || from === 'reader_identity' || targetKey === 'reader_identity') return;
    const keys = [...(secPreview ?? sortableSections.map(x => x.key))];
    const fi = keys.indexOf(from); const ti = keys.indexOf(targetKey);
    if (fi < 0 || ti < 0) return;
    keys.splice(fi, 1);
    keys.splice(ti, 0, from); // takes the slot of the section it is dragged onto
    setSecPreview(keys);
  };

  const commitSections = async () => {
    const keys = secPreview;
    setSecPreview(null); setDragSec(null); setOverKey(null);
    if (!keys) return;
    const byKey = new Map(sortableSections.map(x => [x.key, x]));
    const next = keys.map(k => byKey.get(k)).filter((x): x is ProfileSectionLayoutItem => !!x);
    if (next.map(x => x.key).join('|') === sortableSections.map(x => x.key).join('|')) return;
    await persistSectionOrder(next);
  };

  const moveSection = async (index: number, direction: -1 | 1) => {
    const next = [...sortableSections];
    const target = index + direction;
    if (target < 1 || index < 1 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    await persistSectionOrder(next);
  };

  const persistSectionOrder = async (next: ProfileSectionLayoutItem[]) => {
    const renumbered = next.map((item, i) => ({ ...item, order: i * 10 + 10 }));
    // Show the new order straight away so the tiles do not snap back while saving.
    setSections(cur => cur.map(sec => { const hit = renumbered.find(x => x.key === `custom:${sec.id}`); return hit ? { ...sec, sort_order: hit.order } : sec; }));
    setSectionLayout(cur => cur.map(item => { const hit = renumbered.find(x => x.key === item.key); return hit ? { ...item, order: hit.order } : item; }));
    try {
      // Built-in sections keep their order in the layout; question sections keep it in
      // profile_question_sections.sort_order (which also re-syncs their questions).
      const builtIns = [...renumbered.filter(x => !String(x.key).startsWith('custom:')), ...(hubItem ? [hubItem] : []), ...sectionLayout.filter(x => x.key === 'reading_journey' && readingConverted)];
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
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not save section order.');
      await loadProfileBuilder();
    }
  };

  const reloadCoreFields = async () => {
    try { const [o, ord] = await Promise.all([fetchCoreOverrides(), fetchCoreFieldOrder()]); setCoreOverrides(o); setCoreFieldOrder(ord); } catch { /* keep what is on screen */ }
  };

  // Saves a new built-in field placement (section + order). Shows the result immediately and rolls back on failure.
  const persistCoreLists = async (next: Record<CoreSectionKey, CoreFieldKey[]>, key: CoreFieldKey) => {
    const sec: CoreSectionKey = next.reader_identity.includes(key) ? 'reader_identity' : 'reading_journey';
    const order: CoreFieldOrder = {};
    [...next.reader_identity, ...next.reading_journey].forEach((k, i) => { order[k] = i; });
    const prevOverrides = coreOverrides; const prevOrder = coreFieldOrder;
    setCoreFieldOrder(order);
    setCoreOverrides({ ...coreOverrides, [key]: { ...(coreOverrides[key] ?? {}), section: sec === coreDefaultSection(key) ? undefined : sec } });
    try {
      const saved = await saveCoreFieldPlacement(key, sec, order);
      setCoreOverrides(saved.overrides); setCoreFieldOrder(saved.order);
      setMsg(sec !== coreSection(prevOverrides, key) ? 'Built-in field moved to its new section.' : 'Built-in field order saved.');
    } catch (e) {
      setCoreOverrides(prevOverrides); setCoreFieldOrder(prevOrder);
      setMsg(e instanceof Error ? e.message : 'Could not save built-in field order.');
    }
  };

  const moveCoreField = async (key: CoreFieldKey, direction: -1 | 1) => {
    const sec = coreSection(coreOverrides, key);
    const list = [...coreLists[sec]];
    const index = list.indexOf(key);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    await persistCoreLists({ ...coreLists, [sec]: list }, key);
  };

  // Dragging downwards lands after the target, upwards before it (same rule as questions and sections).
  const previewField = (sec: CoreSectionKey, targetKey: CoreFieldKey | null) => {
    if (!dragField || dragField === targetKey) return;
    const base = fieldPreview ?? coreLists;
    const next: Record<CoreSectionKey, CoreFieldKey[]> = {
      reader_identity: base.reader_identity.filter(k => k !== dragField),
      reading_journey: base.reading_journey.filter(k => k !== dragField),
    };
    const list = next[sec];
    let idx = list.length;
    if (targetKey) {
      const found = list.indexOf(targetKey);
      if (found >= 0) {
        idx = found;
        const from = base[sec].indexOf(dragField);
        if (from >= 0 && from < base[sec].indexOf(targetKey)) idx += 1;
      }
    }
    list.splice(idx, 0, dragField);
    setFieldPreview(next);
  };

  const commitFields = async () => {
    const next = fieldPreview; const key = dragField;
    setFieldPreview(null); setDragField(null);
    if (!next || !key) return;
    const same = (['reader_identity', 'reading_journey'] as const).every(sec => next[sec].join('|') === coreLists[sec].join('|'));
    if (same) return;
    await persistCoreLists(next, key);
  };

  const cancelFieldDrag = () => { setFieldPreview(null); setDragField(null); };

  const toggleCoreActive = async (key: CoreFieldKey) => {
    try {
      const o = coreOverrides[key] ?? {};
      setCoreOverrides(await saveCoreOverride(key, { ...o, active: o.active === false }));
      setMsg(o.active === false ? 'Built-in field is shown on the profile again.' : 'Built-in field hidden from the profile.');
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Could not update built-in field.'); }
  };

  const convertReading = async () => {
    if (!confirm('Create a "Reading Journey" section with these six built-in questions as normal questions? Readers keep every answer they already entered.')) return;
    try {
      setConverting(true);
      const result = await convertReadingJourneyToQuestions();
      await loadProfileBuilder();
      setMsg(`Reading Journey is now a normal section${result.questionsCreated ? ` with ${result.questionsCreated} question${result.questionsCreated === 1 ? '' : 's'}` : ''}. You can edit, reorder, move or hide them like any other question.`);
    } catch (e) {
      setMsg(e instanceof Error ? `Could not convert Reading Journey: ${e.message}` : 'Could not convert Reading Journey.');
    } finally { setConverting(false); }
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
          {hubItem && <button type="button" className="btn-ghost !w-auto text-xs mb-3" onClick={() => openBuiltInSection(hubItem)}><Pencil className="w-3.5 h-3.5" /> Edit profile page heading &amp; description</button>}
          <div className="flex flex-col gap-2 max-w-2xl" role="list" aria-label="Profile sections, top to bottom" onDragOver={e => { if (dragSec) e.preventDefault(); }} onDrop={e => { e.preventDefault(); void commitSections(); }}>
            {shownSections.map((item, index) => {
              const builtIn = item.key === 'reader_identity' || item.key === 'profile_questions' || item.key === 'reading_journey';
              const custom = !builtIn ? orderedSections.find(s => item.key === `custom:${s.id}`) : null;
              const locked = item.key === 'reader_identity';
              const dragging = dragSec === item.key;
              return <div key={item.key} draggable={!locked} onDragStart={e => { setDragSec(item.key); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', item.key); }} onDragEnter={() => previewSection(item.key)} onDragOver={e => { if (dragSec) e.preventDefault(); }} onDrop={e => { e.preventDefault(); void commitSections(); }} onDragEnd={() => { setSecPreview(null); setDragSec(null); setOverKey(null); }} className={`rounded-2xl px-3 py-3 flex items-center gap-2 transition-all duration-150 ${locked ? 'shadow-sm' : 'cursor-grab active:cursor-grabbing hover:shadow-md'}`} style={{ background: 'var(--color-background)', border: dragging ? '2px solid var(--color-cyan-dark)' : '1px solid var(--color-border)', boxShadow: dragging ? '0 14px 30px rgba(0,80,95,.28)' : undefined, transform: dragging ? 'scale(1.025)' : undefined, position: 'relative', zIndex: dragging ? 5 : 0 }}>

                {locked ? <Lock className="w-4 h-4 shrink-0" style={{ color: 'var(--color-teal-dark)' }} aria-label="Locked at the top" /> : <GripVertical className="w-4 h-4 shrink-0" style={{ color: 'var(--color-text-muted)' }} aria-hidden="true" />}
                <div className="flex flex-col"><button type="button" disabled={locked || index<=1} onClick={()=>void moveSection(index,-1)} className="p-1 rounded disabled:opacity-30" title="Move section up"><ChevronUp className="w-4 h-4"/></button><button type="button" disabled={locked || index===shownSections.length-1} onClick={()=>void moveSection(index,1)} className="p-1 rounded disabled:opacity-30" title="Move section down"><ChevronDown className="w-4 h-4"/></button></div>
                <div role="button" tabIndex={0} onClick={() => custom ? openRenameSection(custom) : openBuiltInSection(item)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (custom) openRenameSection(custom); else openBuiltInSection(item); } }} className="min-w-0 flex-1 text-left cursor-pointer" title="Click to edit this section"><p className="font-semibold text-sm truncate">{item.header || item.key}</p><p className="text-[11px] mt-1 line-clamp-2" style={{ color: 'var(--color-text-muted)' }}>{item.description || 'No helper text set.'}</p><p className="text-[10px] uppercase tracking-wider mt-1" style={{ color: 'var(--color-text-muted)' }}>{locked ? 'Locked at the top' : builtIn ? 'Built-in section' : 'Custom section'} · Order {index+1} · {item.active ? 'Visible' : 'Hidden'}</p></div>
                {custom ? <button type="button" className="p-2 rounded-lg" title={`Edit ${custom.name}`} aria-label={`Edit ${custom.name}`} onClick={() => openRenameSection(custom)}><Pencil className="w-3.5 h-3.5" /></button> : <button type="button" className="p-2 rounded-lg" title="Edit built-in section heading and text" aria-label="Edit built-in section" onClick={() => openBuiltInSection(item)}><Pencil className="w-3.5 h-3.5" /></button>}
              </div>;
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-6 xl:items-start">
          <div className="space-y-3 min-w-0 nl-admin-col" tabIndex={-1} aria-label="Questions list">
            <div className="rounded-2xl p-4" style={{ background: 'var(--color-paper)', border: '1px solid var(--color-border)' }}>
              <p className="text-sm font-semibold">Built-in profile fields</p>
              <p className="text-xs mt-1 mb-3" style={{ color: 'var(--color-text-muted)' }}>These ship with every profile and work like any other section: drag a field to reorder it or drop it into the other section, use Edit to change its label, placeholder, section and default visibility, or hide it. Name and Email are locked.</p>
              {!readingConverted && <div className="rounded-2xl p-4 mb-4 flex flex-wrap items-center justify-between gap-3" style={{ background: 'linear-gradient(135deg,rgba(0,151,178,.09),rgba(53,211,217,.12))', border: '1px solid var(--color-border)' }}><div className="min-w-0 flex-1" style={{ minWidth: 220 }}><p className="text-sm font-semibold">Turn the built-in Reading Journey into a normal section</p><p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Creates a “Reading Journey” section and replaces the six built-in reading questions with ordinary questions of the same names, so they can be edited, dragged and moved like every other question. Readers keep their existing answers. Identity stays as it is.</p></div><button type="button" className="btn-primary !w-auto" disabled={converting} onClick={() => void convertReading()}>{converting ? 'Converting…' : 'Convert to a section'}</button></div>}
              <div className="space-y-4">
                {(['reader_identity', 'reading_journey'] as CoreSectionKey[]).filter(k => !(k === 'reading_journey' && readingConverted)).map(sectionKey => {
                  const sectionItem = allSectionLayout.find(x => x.key === sectionKey);
                  const keys = coreLists[sectionKey];
                  const lockedFields = sectionKey === 'reader_identity' ? CORE_FIELDS.filter(f => f.locked) : [];
                  const dragFromHere = !!dragField && keys.includes(dragField);
                  return <section key={sectionKey} onDragOver={e => { if (dragField) e.preventDefault(); }} onDragEnter={() => { if (dragField && !keys.includes(dragField)) previewField(sectionKey, null); }} onDrop={e => { e.preventDefault(); void commitFields(); }} className="rounded-2xl p-3 min-w-0" style={{ background: 'var(--color-background)', border: dragFromHere ? '1px solid var(--color-cyan-dark)' : '1px solid var(--color-border)' }}>
                    <div className="flex items-center justify-between gap-2 mb-2 px-1"><p className="text-xs uppercase tracking-wider font-bold truncate" style={{ color: 'var(--color-teal-dark)' }}>{sectionItem?.header || (sectionKey === 'reading_journey' ? 'Your reading life' : 'Build your reader identity')}</p><span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Built-in section · {keys.length + lockedFields.length} field{keys.length + lockedFields.length === 1 ? '' : 's'}</span></div>
                    <div className="space-y-2">
                      {lockedFields.map(f => <div key={f.key} className="rounded-xl p-3 flex items-center gap-2" style={{ background: 'var(--color-paper)', border: '1px solid var(--color-border)' }}><Lock className="w-4 h-4 shrink-0" style={{ color: 'var(--color-text-muted)' }} aria-hidden="true" /><div className="min-w-0 flex-1"><p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--color-teal-dark)' }}>{f.type}</p><p className="font-semibold text-sm truncate">{f.label}</p><p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Built-in · locked at the top</p></div><span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: 'var(--color-text-muted)' }}>Locked</span></div>)}
                      {keys.length === 0 && <div className="rounded-xl py-6 text-center text-xs" style={{ border: '1px dashed var(--color-border)', color: 'var(--color-text-muted)' }}>Drop a built-in field here</div>}
                      {keys.map((key, i) => {
                        const f = CORE_FIELDS.find(x => x.key === key)!;
                        const shown = coreActive(coreOverrides, key);
                        const dragging = dragField === key;
                        return <div key={key} draggable onDragStart={e => { e.stopPropagation(); setDragField(key); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', key); }} onDragEnter={e => { e.stopPropagation(); previewField(sectionKey, key); }} onDragOver={e => { if (dragField) { e.preventDefault(); e.stopPropagation(); } }} onDrop={e => { e.preventDefault(); e.stopPropagation(); void commitFields(); }} onDragEnd={cancelFieldDrag} className="rounded-xl p-3 flex items-center gap-2 cursor-grab active:cursor-grabbing transition-all duration-150" style={{ background: 'var(--color-paper)', border: dragging ? '2px solid var(--color-cyan-dark)' : '1px solid var(--color-border)', boxShadow: dragging ? '0 14px 30px rgba(0,80,95,.28)' : undefined, transform: dragging ? 'scale(1.02)' : undefined, position: 'relative', zIndex: dragging ? 5 : 0, opacity: shown ? 1 : 0.65 }}>
                          <GripVertical className="w-4 h-4 shrink-0" style={{ color: 'var(--color-text-muted)' }} aria-hidden="true" />
                          <div className="flex flex-col"><button type="button" disabled={i === 0} onClick={() => void moveCoreField(key, -1)} className="p-1 rounded disabled:opacity-30" title="Move field up" aria-label={`Move ${coreOverrides[key]?.label || f.label} up`}><ChevronUp className="w-4 h-4" /></button><button type="button" disabled={i === keys.length - 1} onClick={() => void moveCoreField(key, 1)} className="p-1 rounded disabled:opacity-30" title="Move field down" aria-label={`Move ${coreOverrides[key]?.label || f.label} down`}><ChevronDown className="w-4 h-4" /></button></div>
                          <div className="min-w-0 flex-1"><p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--color-teal-dark)' }}>{f.type}</p><p className="font-semibold text-sm truncate">{coreOverrides[key]?.label || f.label}</p><p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Built-in · {shown ? 'shown on profile' : 'HIDDEN from profile'} · {(coreOverrides[key]?.defaultVisible ?? f.defaultVisible) ? 'public by default' : 'private by default'}</p></div>
                          <button type="button" onClick={() => void toggleCoreActive(key)} className="p-2 rounded-lg" title={shown ? 'Hide from profile' : 'Show on profile'} aria-label={shown ? `Hide ${coreOverrides[key]?.label || f.label}` : `Show ${coreOverrides[key]?.label || f.label}`}><Eye className="w-4 h-4" style={{ opacity: shown ? 1 : 0.35 }} /></button>
                          <button type="button" onClick={() => editCore(key)} className="btn-ghost !w-auto !px-3 text-xs">Edit</button>
                        </div>;
                      })}
                    </div>
                  </section>;
                })}
              </div>
            </div>
            {questions.length === 0 ? <div className="py-10 text-center" style={{ color: 'var(--color-text-muted)' }}>No profile questions yet.</div> : <>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Drag a question by its card to reorder it, or drop it into another section column to move it there.</p>
              <div className="flex flex-col gap-4">
                {questionGroups.map(group => <section key={group.name} onDragOver={e => { if (dragQ) e.preventDefault(); }} onDragEnter={() => { const cur = (qPreview ?? questions).find(q => q.id === dragQ)?.section; if (dragQ && cur !== group.name) previewQuestion(group.name, null); }} onDrop={e => { e.preventDefault(); void commitQuestions(); }} className="rounded-2xl p-3 space-y-2 min-w-0" style={{ background: 'var(--color-background)', border: dragQ && (qPreview ?? questions).find(q => q.id === dragQ)?.section === group.name ? '1px solid var(--color-cyan-dark)' : '1px solid var(--color-border)' }}>
                  <div className="flex items-center justify-between gap-2 px-1"><p className="text-xs uppercase tracking-wider font-bold truncate" style={{ color: 'var(--color-teal-dark)' }}>{group.header}</p><span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{group.items.length} question{group.items.length === 1 ? '' : 's'}{group.active ? '' : ' · hidden'}</span></div>
                  {group.items.length === 0 && <div className="rounded-xl py-6 text-center text-xs" style={{ border: '1px dashed var(--color-border)', color: 'var(--color-text-muted)' }}>Drop a question here</div>}
                  {group.items.map((q, i) => <div key={q.id} data-qcard draggable onDragStart={e => { e.stopPropagation(); setDragQ(q.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', q.id); }} onDragEnter={e => { e.stopPropagation(); previewQuestion(group.name, q.id); }} onDragOver={e => { if (dragQ) { e.preventDefault(); e.stopPropagation(); } }} onDrop={e => { e.preventDefault(); e.stopPropagation(); void commitQuestions(); }} onDragEnd={cancelQuestionDrag} className="rounded-2xl p-3 cursor-grab active:cursor-grabbing transition-all duration-150" style={{ background: 'var(--color-paper)', border: dragQ === q.id ? '2px solid var(--color-cyan-dark)' : '1px solid var(--color-border)', boxShadow: dragQ === q.id ? '0 14px 30px rgba(0,80,95,.28)' : undefined, transform: dragQ === q.id ? 'scale(1.02)' : undefined, position: 'relative', zIndex: dragQ === q.id ? 5 : 0 }}>
              <div className="flex gap-3">
                <GripVertical className="w-4 h-4 mt-1" style={{ color: 'var(--color-text-muted)' }} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full" style={{ background: 'rgba(8,145,178,.09)', color: 'var(--color-teal-dark)' }}>{q.section}</span>
                    <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{questionTypeLabel(q.type)}</span>
                    {isLegacyProfileFieldKey(q.key) && <span className="text-[10px] font-semibold" style={{ color: 'var(--color-text-muted)' }} title="The answer is stored in the reader's profile record, so existing answers are kept">Linked to profile data</span>}
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
              <div><label className="label">Section</label><select value={coreSectionDraft} onChange={e => setCoreSectionDraft(e.target.value as CoreSectionKey)} className="input-field"><option value="reader_identity">{allSectionLayout.find(x => x.key === 'reader_identity')?.header || 'Build your reader identity'}</option>{!readingConverted && <option value="reading_journey">{allSectionLayout.find(x => x.key === 'reading_journey')?.header || 'Your reading life'}</option>}</select><p className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>Choose which built-in section readers see this field in. You can also drag the field between sections.</p></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={coreActiveDraft} onChange={e => setCoreActiveDraft(e.target.checked)} /> Show this field on the reader&apos;s profile page</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={coreVisibleDraft} onChange={e => setCoreVisibleDraft(e.target.checked)} /> Visible by default (readers can still change it with their eye control)</label>
              <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>The answer type ({def.type}) is fixed for built-in fields because it is tied to the reader&apos;s saved profile data. Default visibility applies to readers who haven&apos;t saved a visibility choice yet.</p>
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
