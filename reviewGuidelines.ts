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

const NL_DESCRIPTION = "The cumulative average (out of 10) of the reviewer's R/W rating and all ratings submitted by Novelty Library readers on the respective community review post. It reflects the community's rating of that book and updates as readers rate the post.";

/**
 * Adds the NL Rating explanation right after the Amazon Rating entry, whether the
 * guideline section lists ratings as <li> items or as a table (the live format).
 * Content that already mentions "NL Rating" is returned untouched, so an admin can
 * always write their own wording in the editor.
 */
export function withNlRating(html: string): string {
  if (!html || /NL\s*Rating/i.test(html)) return html;
  const liItem = /<li[^>]*>\s*<strong>\s*Amazon Rating:?\s*<\/strong>[\s\S]*?<\/li>/i;
  if (liItem.test(html)) {
    return html.replace(liItem, (m) => `${m}<li><strong>NL Rating:</strong> ${NL_DESCRIPTION}</li>`);
  }
  const trItem = /<tr[^>]*>(?:(?!<\/tr>)[\s\S])*?Amazon Rating(?:(?!<\/tr>)[\s\S])*?<\/tr>/i;
  if (trItem.test(html)) {
    const cell = 'style="padding: 10px 12px;"';
    const row = `<tr style="border-top: 1px solid var(--novelty-border); background: var(--novelty-subcard-bg);"><td ${cell}><strong class="novelty-highlight">NL Rating</strong></td><td ${cell}>Out of 10 (cumulative average)</td><td ${cell}>The reviewer's R/W plus Novelty Library readers rating the post</td><td ${cell}>${NL_DESCRIPTION}</td></tr>`;
    return html
      .replace(trItem, (m) => `${m}${row}`)
      .replace(/up to three separate scores/i, 'up to four separate scores')
      .replace(/Goodreads or Amazon figures — all three are shown/i, 'Goodreads, Amazon or NL figures — all four are shown');
  }
  return html;
}
