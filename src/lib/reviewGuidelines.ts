import { supabase } from '@/lib/supabase';

export interface ReviewGuidelineSection {
  id: string;
  slug: string;
  title: string;
  content_html: string;
  sort_order: number;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ReviewGuidelineSectionInput {
  id?: string;
  slug?: string;
  title: string;
  content_html: string;
  sort_order?: number;
  active?: boolean;
}

export async function fetchReviewGuidelineSections(includeInactive = false): Promise<ReviewGuidelineSection[]> {
  let query = supabase
    .from('review_guideline_sections')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('title', { ascending: true });
  if (!includeInactive) query = query.eq('active', true);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ReviewGuidelineSection[];
}

export async function saveReviewGuidelineSection(input: ReviewGuidelineSectionInput): Promise<ReviewGuidelineSection> {
  const payload = {
    slug: input.slug || `section-${crypto.randomUUID()}`,
    title: input.title.trim(),
    content_html: input.content_html,
    sort_order: input.sort_order ?? 10,
    active: input.active ?? true,
    updated_at: new Date().toISOString(),
  };

  if (!payload.title) throw new Error('Section title is required.');

  if (input.id) {
    const { data, error } = await supabase
      .from('review_guideline_sections')
      .update(payload)
      .eq('id', input.id)
      .select('*')
      .single();
    if (error) throw error;
    return data as ReviewGuidelineSection;
  }

  const { data, error } = await supabase
    .from('review_guideline_sections')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return data as ReviewGuidelineSection;
}

export async function deleteReviewGuidelineSection(id: string): Promise<void> {
  const { error } = await supabase.from('review_guideline_sections').delete().eq('id', id);
  if (error) throw error;
}
