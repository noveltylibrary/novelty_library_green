import { supabase } from '@/lib/supabase';

export type ProfileSectionKey = 'reader_identity' | 'profile_questions' | 'basic_reader' | 'reading_journey' | `custom:${string}`;
export type ProfileSectionLayoutItem = {
  key: ProfileSectionKey;
  order: number;
  active: boolean;
  header?: string;
  description?: string;
  /** reading_journey only: set once its fields were converted into a real question section. */
  converted?: boolean;
};

const SLUG = 'profile-section-layout';

export const BUILT_IN_PROFILE_SECTIONS: ProfileSectionLayoutItem[] = [
  { key: 'reader_identity', order: 10, active: true, header: 'Identity', description: 'Your name, account details and social links.' },
  { key: 'basic_reader', order: 20, active: true, header: 'Basic Reader', description: 'Your core Novelty Library reading activity.' },
  { key: 'profile_questions', order: 30, active: true, header: 'Profile Questions', description: 'Answer the questions shared by Novelty Library.' },
  { key: 'reading_journey', order: 40, active: true, header: 'Your reading life', description: 'Your reading history, favourites and book-related profile details live here.' },
];

export async function fetchProfileSectionLayout(): Promise<ProfileSectionLayoutItem[]> {
  const { data, error } = await supabase.from('editable_pages').select('content').eq('slug', SLUG).maybeSingle();
  if (error || !data?.content) return BUILT_IN_PROFILE_SECTIONS.map(x => ({ ...x }));
  try {
    const parsed = JSON.parse(String(data.content)) as { sections?: ProfileSectionLayoutItem[] };
    const saved = Array.isArray(parsed.sections) ? parsed.sections : [];
    const byKey = new Map(saved.map(x => [x.key, x]));
    const builtIns = BUILT_IN_PROFILE_SECTIONS.map(def => {
      const savedDef = byKey.get(def.key);
      // Preserve genuine admin edits, but migrate the old identity heading to the
      // requested stable section name. The new Basic Reader section is injected
      // automatically for older saved layouts because it has a new built-in key.
      if (def.key === 'reader_identity' && (!savedDef?.header || savedDef.header === 'Build your reader identity')) {
        return { ...def, ...(savedDef || {}), header: 'Identity' };
      }
      return { ...def, ...(savedDef || {}) };
    });
    // Question sections (custom:*) are owned by the profile_question_sections table;
    // copies stored here were stale and overrode the admin's edits, so they are ignored.
    return builtIns.sort((a, b) => a.order - b.order || a.key.localeCompare(b.key));
  } catch {
    return BUILT_IN_PROFILE_SECTIONS.map(x => ({ ...x }));
  }
}

export async function saveProfileSectionLayout(sections: ProfileSectionLayoutItem[]): Promise<ProfileSectionLayoutItem[]> {
  // Only built-in sections live here; the given order values are kept as-is so they
  // share one numeric scale with the question sections' sort_order.
  const normalized = sections.filter(s => !String(s.key).startsWith('custom:'));
  const { error } = await supabase.from('editable_pages').upsert({
    slug: SLUG,
    title: 'Profile section layout',
    content: JSON.stringify({ sections: normalized }),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'slug' });
  if (error) throw error;
  return normalized;
}
