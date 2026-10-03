import { supabase } from '@/lib/supabase';

export type FinanceCategory = 'b2b' | 'b2c';

export interface FinanceModule {
  id: string;
  category: FinanceCategory;
  name: string;
  description: string | null;
  dashboard_url: string;
  active: boolean;
  sort_order: number;
}

export interface EditablePage {
  slug: string;
  title: string;
  content: string;
  updated_at: string | null;
}

export const PAGE_DEFAULTS: Record<string, { title: string; content: string }> = {
  about: {
    title: 'About Novelty Library',
    content: `Novelty Library exists so indie readers have a clean, permanent digital shelf that doesn't rely on random social feeds.

About Novelty Library

What mission do we serve?
Novelty Library Reviews is built specifically so honest reviewers and indie readers have a clean, permanent digital shelf that doesn't rely on random social feeds. We want to help more authors and reviewers find their voice in a publicity-driven world.

What's new on the platform?
The Submit Book Reviews form includes live progress, preview, Quick Search and Fill, saved drafts, a short editing window after submitting, and an Instagram-story poster workflow.

Tired of the mediocre?
Novelty Library brings together book reviews, recommendations, must-reads, and literary critiques for every kind of reader.`,
  },
  privacy: {
    title: 'Privacy Policy & Data Governance Notice',
    content: `Last updated: September 2026

Applicable Law: This Privacy Policy is intended to operate in accordance with applicable laws of India.

1. Information We Collect
When you create an account, log in, or submit a review on Novelty Library, we collect account and reviewer information needed for authentication, spam prevention, and attribution.

2. Age & Children’s Privacy
Novelty Library is designed for readers aged 13 and above. We do not knowingly solicit personal information from children under 13 without guardian consent.

3. How We Use Your Information
Account authentication, security tokens, and profile data are securely processed through our service providers. Published review attribution may include the profile details a reviewer has chosen to make public.

4. No Sale or Commercialization of Personal Data
We do not sell, rent, license, or trade your personal information for marketing or advertising purposes.

5. Account Deletion
You may request deletion of your account and personal identifiers by contacting the support address shown on this page. Published review archive rules may require anonymization rather than removal of review content.

6. Grievance Officer & Contact
For privacy inquiries, data deletion requests, or grievances, contact Novelty Library support.

Right to Modify
We may update this notice periodically to reflect platform improvements.`,
  },
  terms: {
    title: 'Terms of Service & Fair Use',
    content: `Last updated: September 2026

Applicable Law: These Terms are intended to operate in accordance with applicable laws of India.

Scope of these terms
These terms apply to book reviews, reading features, community interactions, and current or future features offered on Novelty Library.

Age Representation & Parental Assent
Novelty Library is designed for readers aged 13 and above. Users must meet the applicable age requirement or access the service with appropriate parental or guardian consent.

Submitting reviews
By submitting a review to Novelty Library, you grant Novelty Library a non-exclusive license to format, edit for presentation, reproduce, and display that submitted review as part of the site and related Novelty Library materials. You retain ownership of your original review.

Book information and fair use
Book titles, cover thumbnails, publisher information, and other book metadata belong to their respective rights holders. Novelty Library uses this material for book identification, review, commentary, and criticism.

Reviewer responsibility
Reviewers are responsible for content they submit and should only submit material they have the right to share.

Copyright Infringement, Intermediary Takedowns & Review Permanence
Rights holders may submit valid takedown requests for third-party material. Review archive rules may preserve assigned review numbers while allowing personal attribution to be anonymized where appropriate.

Right to Modify
We may update these terms periodically to reflect platform improvements.`,
  },
};

export async function fetchFinanceModules(category?: FinanceCategory): Promise<FinanceModule[]> {
  let query = supabase.from('finance_modules').select('*').eq('active', true).order('sort_order', { ascending: true });
  if (category) query = query.eq('category', category);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as FinanceModule[];
}

export async function fetchAllFinanceModules(): Promise<FinanceModule[]> {
  const { data, error } = await supabase.from('finance_modules').select('*').order('category').order('sort_order');
  if (error) throw error;
  return (data ?? []) as FinanceModule[];
}

export async function saveFinanceModule(input: Partial<FinanceModule> & Pick<FinanceModule, 'category' | 'name' | 'dashboard_url'>): Promise<FinanceModule> {
  const payload = {
    category: input.category,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    dashboard_url: input.dashboard_url.trim(),
    active: input.active ?? true,
    sort_order: input.sort_order ?? 0,
  };
  if (input.id) {
    const { data, error } = await supabase.from('finance_modules').update(payload).eq('id', input.id).select('*').single();
    if (error) throw error;
    return data as FinanceModule;
  }
  const { data, error } = await supabase.from('finance_modules').insert(payload).select('*').single();
  if (error) throw error;
  return data as FinanceModule;
}

export async function deleteFinanceModule(id: string): Promise<void> {
  const { error } = await supabase.from('finance_modules').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchEditablePage(slug: string): Promise<EditablePage> {
  const fallback = PAGE_DEFAULTS[slug] || { title: slug, content: '' };
  const { data, error } = await supabase.from('editable_pages').select('*').eq('slug', slug).maybeSingle();
  if (error || !data) return { slug, ...fallback, updated_at: null };
  return data as EditablePage;
}

export async function saveEditablePage(slug: string, title: string, content: string): Promise<EditablePage> {
  const { data, error } = await supabase
    .from('editable_pages')
    .upsert({ slug, title: title.trim(), content, updated_at: new Date().toISOString() }, { onConflict: 'slug' })
    .select('*')
    .single();
  if (error) throw error;
  return data as EditablePage;
}
