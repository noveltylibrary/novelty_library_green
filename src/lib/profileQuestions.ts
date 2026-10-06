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
    sort_order: input.sort_order ?? 10,
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

export async function fetchProfileQuestions(includeInactive = false): Promise<ProfileQuestion[]> {
  let q = supabase.from('profile_questions').select('*').order('section_order').order('sort_order');
  if (!includeInactive) q = q.eq('active', true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ProfileQuestion[];
}

export async function saveProfileQuestion(input: Partial<ProfileQuestion> & Pick<ProfileQuestion, 'question' | 'type' | 'section'>): Promise<ProfileQuestion> {
  const key = input.key?.trim() || `q_${Date.now().toString(36)}`;
  const sections = await fetchProfileSections(true);
  const matchedSection = sections.find(s => s.name === input.section);
  const sectionOrder = matchedSection?.sort_order ?? 999;
  const normalizedType: ProfileQuestionType = input.type === 'select' ? 'select_single' : input.type;
  const payload = {
    section: input.section,
    section_order: sectionOrder,
    question: input.question.trim(),
    key,
    type: normalizedType,
    options: input.options ?? [],
    placeholder: input.placeholder?.trim() || null,
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
  const { data, error } = await supabase.rpc('admin_save_profile_question_v2', {
    p_payload: {
      id: input.id ?? null,
      section: payload.section,
      section_order: payload.section_order,
      question: payload.question,
      key: payload.key,
      type: payload.type,
      options: payload.options,
      placeholder: payload.placeholder,
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
  if (!data) throw new Error('Profile question was not returned after saving.');
  // Always persist the complete editable definition after the admin RPC. Some
  // deployments still have an older RPC implementation which can return the row
  // without applying newer/changed question fields (question text, options,
  // placeholder, visibility, presentation, sorting, etc.). The direct update is
  // intentionally the source of truth for the current admin editor.
  const savedId = (data as ProfileQuestion).id || input.id;
  if (!savedId) throw new Error('Profile question was saved without an id.');
  const { data: updated, error: updateError } = await supabase
    .from('profile_questions')
    .update({
      section: payload.section,
      section_order: payload.section_order,
      question: payload.question,
      key: payload.key,
      type: payload.type,
      options: payload.options,
      placeholder: payload.placeholder,
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
    })
    .eq('id', savedId)
    .select('*')
    .single();
  if (updateError) throw updateError;
  if (!updated) throw new Error('Profile question could not be refreshed after saving.');
  return updated as ProfileQuestion;
}

export async function deleteProfileQuestion(id: string): Promise<void> {
  const { error } = await supabase.from('profile_questions').delete().eq('id', id);
  if (error) throw error;
}

export async function reorderProfileQuestions(orderedIds: string[]): Promise<void> {
  for (let i = 0; i < orderedIds.length; i += 1) {
    const { error } = await supabase.from('profile_questions').update({ sort_order: i }).eq('id', orderedIds[i]);
    if (error) throw error;
  }
}
