import { supabase } from '@/lib/supabase';

export type ProfileQuestionType = 'short_text' | 'long_text' | 'number' | 'year' | 'url' | 'select' | 'select_single' | 'select_multiple' | 'image_upload';
export type ProfileQuestion = {
  id: string;
  section: string;
  question: string;
  placeholder?: string;
  key: string;
  type: ProfileQuestionType;
  options: string[];
  allow_other?: boolean;
  image_count?: number;
  image_max_mb?: number;
  image_max_width?: number;
  image_max_height?: number;
  required: boolean;
  public_default: boolean;
  show_in_profile_card: boolean;
  profile_card_mode?: 'tag' | 'tag_no_question' | 'answer' | 'answer_no_question';
  max_selections?: number | null;
  alphabetical_sort?: boolean;
  sort_order: number;
  active: boolean;
  section_order?: number;
};

export type ProfileQuestionSection = {
  id: string;
  name: string;
  header?: string;
  description?: string;
  sort_order: number;
  active: boolean;
};

export const DEFAULT_PROFILE_SECTIONS = ['Personal Details', 'Book Journey', 'Reading Identity', 'Custom'] as const;
/** Backwards-compatible alias used by older UI code. */
export const PROFILE_SECTIONS = DEFAULT_PROFILE_SECTIONS;

export async function fetchProfileSections(includeInactive = false): Promise<ProfileQuestionSection[]> {
  let q = supabase
    .from('profile_question_sections')
    .select('id,name,header,description,sort_order,active')
    .order('sort_order')
    .order('name');
  if (!includeInactive) q = q.eq('active', true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ProfileQuestionSection[];
}

export async function saveProfileQuestionSection(input: {
  id?: string;
  name: string;
  header?: string;
  description?: string;
  sort_order?: number;
  active?: boolean;
}): Promise<ProfileQuestionSection> {
  const name = input.name.trim();
  if (!name) throw new Error('Section name is required.');

  const payload = {
    name,
    header: input.header?.trim() || name,
    description: input.description?.trim() || '',
    sort_order: input.sort_order ?? 10,
    active: input.active ?? true,
  };

  const { data, error } = await supabase.rpc('admin_save_profile_question_section_v2', {
    p_payload: {
      id: input.id ?? null,
      name,
      header: payload.header,
      description: payload.description,
      sort_order: payload.sort_order,
      active: payload.active,
    },
  });

  if (error) throw error;
  if (!data) throw new Error('Section was not saved.');
  return data as ProfileQuestionSection;
}

const QUESTION_OVERRIDES_SLUG = 'profile-question-overrides';

type QuestionOverrideStore = {
  version: 1;
  questions: ProfileQuestion[];
};

async function fetchQuestionOverrides(): Promise<ProfileQuestion[]> {
  const { data, error } = await supabase
    .from('editable_pages')
    .select('content')
    .eq('slug', QUESTION_OVERRIDES_SLUG)
    .maybeSingle();
  if (error || !data?.content) return [];
  try {
    const parsed = JSON.parse(String(data.content)) as QuestionOverrideStore;
    return Array.isArray(parsed?.questions) ? parsed.questions : [];
  } catch {
    return [];
  }
}

async function saveQuestionOverrides(questions: ProfileQuestion[]): Promise<void> {
  const { error } = await supabase
    .from('editable_pages')
    .upsert({
      slug: QUESTION_OVERRIDES_SLUG,
      title: 'Profile question definitions',
      content: JSON.stringify({ version: 1, questions }),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'slug' });
  if (error) throw error;
}

export async function fetchProfileQuestions(includeInactive = false): Promise<ProfileQuestion[]> {
  const [{ data, error }, overrides] = await Promise.all([
    supabase.from('profile_questions').select('*').order('section_order').order('sort_order'),
    fetchQuestionOverrides(),
  ]);
  if (error && overrides.length === 0) throw error;

  const dbRows = (data ?? []) as ProfileQuestion[];
  const byId = new Map(dbRows.map(q => [String(q.id), q]));
  const byKey = new Map(dbRows.map(q => [String(q.key), q]));
  // The database is authoritative.  Legacy editable_pages overrides may only ADD
  // questions the table does not know about; they must never overwrite a row an
  // admin has edited (stale overrides were hiding admin changes on the profile page).
  for (const override of overrides) {
    if (byId.has(String(override.id)) || byKey.has(String(override.key))) continue;
    byId.set(String(override.id), override);
    byKey.set(String(override.key), override);
  }

  const merged = Array.from(byId.values()).sort((a, b) =>
    (Number(a.section_order) || 0) - (Number(b.section_order) || 0) ||
    (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0)
  );
  return includeInactive ? merged : merged.filter(q => q.active !== false);
}

export async function saveProfileQuestion(input: Partial<ProfileQuestion> & Pick<ProfileQuestion, 'question' | 'type' | 'section'>): Promise<ProfileQuestion> {
  const key = input.key?.trim() || `q_${Date.now().toString(36)}`;
  const sections = await fetchProfileSections(true);
  const matchedSection = sections.find(s => s.name === input.section);
  const sectionOrder = matchedSection?.sort_order ?? 999;
  const normalizedType: ProfileQuestionType = input.type === 'select' ? 'select_single' : input.type;
  const payload: ProfileQuestion = {
    id: input.id || `local-${key}`,
    section: input.section,
    section_order: sectionOrder,
    question: input.question.trim(),
    key,
    type: normalizedType,
    options: input.options ?? [],
    placeholder: input.placeholder?.trim() || undefined,
    allow_other: input.allow_other ?? true,
    image_count: Math.max(1, Math.min(6, Number(input.image_count) || 1)),
    image_max_mb: Math.max(1, Math.min(5, Number(input.image_max_mb) || 5)),
    image_max_width: Math.max(320, Math.min(6000, Number(input.image_max_width) || 1600)),
    image_max_height: Math.max(320, Math.min(6000, Number(input.image_max_height) || 1600)),
    required: input.required ?? false,
    public_default: input.public_default ?? true,
    show_in_profile_card: input.show_in_profile_card ?? true,
    profile_card_mode: input.profile_card_mode ?? 'answer',
    max_selections: input.max_selections == null || Number(input.max_selections) <= 0 ? null : Math.max(1, Math.floor(Number(input.max_selections))),
    alphabetical_sort: input.alphabetical_sort ?? false,
    sort_order: input.sort_order ?? 0,
    active: input.active ?? true,
  };

  // The database RPC is the primary persistence path.  The previous build wrote
  // to editable_pages first; if that table was protected by RLS, the save stopped
  // before the real profile_questions RPC ever ran.  That made Admin edits look
  // successful locally but never reach the profile page.
  let rpcSaved: ProfileQuestion | null = null;
  try {
    const { data, error } = await supabase.rpc('admin_save_profile_question_v2', {
      p_payload: {
        id: input.id ?? null,
        section: payload.section,
        section_order: payload.section_order,
        question: payload.question,
        key: payload.key,
        type: payload.type,
        options: payload.options,
        placeholder: payload.placeholder ?? null,
        allow_other: payload.allow_other,
        image_count: payload.image_count,
        image_max_mb: payload.image_max_mb,
        image_max_width: payload.image_max_width,
        image_max_height: payload.image_max_height,
        required: payload.required,
        public_default: payload.public_default,
        show_in_profile_card: payload.show_in_profile_card,
        profile_card_mode: payload.profile_card_mode,
        max_selections: payload.max_selections,
        alphabetical_sort: payload.alphabetical_sort,
        sort_order: payload.sort_order,
        active: payload.active,
      },
    });
    if (error) throw error;
    if (data) rpcSaved = { ...payload, ...(data as ProfileQuestion) };
  } catch (error) {
    // Editing a question that already lives in the database must not silently fall
    // back to a shadow copy (it would never show on the profile page): report it.
    if (input.id && !String(input.id).startsWith('local-')) {
      throw new Error(error instanceof Error ? error.message : 'Profile question could not be saved.');
    }
    // New questions may continue to the compatibility fallbacks below.
  }

  if (rpcSaved) {
    // Best-effort compatibility mirror.  A failure here must NEVER undo a
    // successful admin RPC save.
    try {
      const current = await fetchQuestionOverrides();
      await saveQuestionOverrides([...current.filter(q => q.id !== rpcSaved!.id && q.key !== rpcSaved!.key), rpcSaved!]);
    } catch { /* editable_pages is optional; RPC remains authoritative */ }
    return rpcSaved;
  }

  // Compatibility fallback for deployments where the admin RPC is unavailable.
  // This path may be protected by RLS, so it is deliberately attempted without
  // making editable_pages the required first step.
  try {
    const row = { ...payload } as Record<string, unknown>;
    const idIsReal = !String(payload.id).startsWith('local-');
    const result = idIsReal
      ? await supabase.from('profile_questions').update(row).eq('id', payload.id).select('*').maybeSingle()
      : await supabase.from('profile_questions').insert(row).select('*').maybeSingle();
    if (!result.error && result.data) return result.data as ProfileQuestion;
  } catch { /* continue */ }

  // Last compatibility path: shared editable_pages configuration.  This keeps
  // the app usable on installations where the legacy table/RPC is absent.
  try {
    const currentOverrides = await fetchQuestionOverrides();
    const next = [...currentOverrides.filter(q => q.id !== payload.id && q.key !== payload.key), payload];
    await saveQuestionOverrides(next);
    return payload;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Profile question could not be saved.');
  }
}
export async function deleteProfileQuestion(id: string): Promise<void> {
  if (!String(id).startsWith('local-')) {
    const { error } = await supabase.from('profile_questions').delete().eq('id', id);
    if (error) throw error;
  }
  try {
    const overrides = await fetchQuestionOverrides();
    if (overrides.some(q => String(q.id) === String(id))) await saveQuestionOverrides(overrides.filter(q => String(q.id) !== String(id)));
  } catch { /* optional legacy mirror */ }
}

export async function reorderProfileQuestions(orderedIds: string[]): Promise<void> {
  for (let i = 0; i < orderedIds.length; i += 1) {
    if (String(orderedIds[i]).startsWith('local-')) continue;
    const { error } = await supabase.from('profile_questions').update({ sort_order: i }).eq('id', orderedIds[i]);
    if (error) throw error;
  }
  try {
    const overrides = await fetchQuestionOverrides();
    const order = new Map(orderedIds.map((id, i) => [String(id), i]));
    if (overrides.some(q => order.has(String(q.id)))) {
      await saveQuestionOverrides(overrides.map(q => order.has(String(q.id)) ? { ...q, sort_order: order.get(String(q.id))! } : q));
    }
  } catch { /* optional legacy mirror */ }
}
