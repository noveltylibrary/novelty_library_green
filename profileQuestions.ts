import { supabase } from '@/lib/supabase';

export type ProfileQuestionType = 'short_text' | 'long_text' | 'number' | 'year' | 'url' | 'select';
export type ProfileQuestion = {
  id: string;
  section: string;
  question: string;
  key: string;
  type: ProfileQuestionType;
  options: string[];
  required: boolean;
  public_default: boolean;
  show_in_profile_card: boolean;
  sort_order: number;
  active: boolean;
};

export const PROFILE_SECTIONS = ['Personal Details', 'Book Journey', 'Reading Identity', 'Custom'] as const;

export async function fetchProfileQuestions(includeInactive = false): Promise<ProfileQuestion[]> {
  let q = supabase.from('profile_questions').select('*').order('section_order').order('sort_order');
  if (!includeInactive) q = q.eq('active', true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ProfileQuestion[];
}

export async function saveProfileQuestion(input: Partial<ProfileQuestion> & Pick<ProfileQuestion, 'question' | 'type' | 'section'>): Promise<ProfileQuestion> {
  const key = input.key?.trim() || `q_${Date.now().toString(36)}`;
  const sectionOrder: Record<string, number> = { 'Personal Details': 10, 'Book Journey': 20, 'Reading Identity': 30, Custom: 40 };
  const payload = {
    section: input.section,
    section_order: sectionOrder[input.section] ?? 40,
    question: input.question.trim(),
    key,
    type: input.type,
    options: input.options ?? [],
    required: input.required ?? false,
    public_default: input.public_default ?? true,
    show_in_profile_card: input.show_in_profile_card ?? true,
    sort_order: input.sort_order ?? 0,
    active: input.active ?? true,
  };
  if (input.id) {
    const { data, error } = await supabase.from('profile_questions').update(payload).eq('id', input.id).select('*').single();
    if (error) throw error;
    return data as ProfileQuestion;
  }
  const { data, error } = await supabase.from('profile_questions').insert(payload).select('*').single();
  if (error) throw error;
  return data as ProfileQuestion;
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
