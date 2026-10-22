import { fetchCoreFieldOrder, fetchCoreOverrides, CORE_FIELDS, type CoreFieldKey } from '@/lib/profileCoreFields';
import { BUILT_IN_PROFILE_SECTIONS, fetchProfileSectionLayout, saveProfileSectionLayout } from '@/lib/profileLayout';
import {
  READING_JOURNEY_SECTION_NAME,
  fetchProfileQuestions,
  fetchProfileSections,
  saveProfileQuestion,
  saveProfileQuestionSection,
  type LegacyProfileFieldKey,
  type ProfileQuestionType,
} from '@/lib/profileQuestions';

const READING_FIELDS: { key: LegacyProfileFieldKey & CoreFieldKey; type: ProfileQuestionType }[] = [
  { key: 'reading_since', type: 'year' },
  { key: 'books_read_this_month', type: 'number' },
  { key: 'total_books_read', type: 'number' },
  { key: 'favorite_book', type: 'short_text' },
  { key: 'favorite_author', type: 'short_text' },
  { key: 'favorite_genre', type: 'short_text' },
];

export type ReadingMigrationResult = { sectionCreated: boolean; questionsCreated: number };

/**
 * One-time, idempotent conversion of the built-in "Reading Journey" fields into a real question section with
 * the same name. Admin edits made to the built-in fields (label, placeholder, default visibility, hidden, order)
 * are carried over. Safe to run again: existing section/questions are reused, nothing is duplicated.
 */
export async function convertReadingJourneyToQuestions(): Promise<ReadingMigrationResult> {
  const [layout, overrides, order, sections, questions] = await Promise.all([
    fetchProfileSectionLayout(),
    fetchCoreOverrides(),
    fetchCoreFieldOrder(),
    fetchProfileSections(true),
    fetchProfileQuestions(true),
  ]);
  const reading = layout.find(x => x.key === 'reading_journey') ?? BUILT_IN_PROFILE_SECTIONS.find(x => x.key === 'reading_journey')!;

  let section = sections.find(s => s.name === READING_JOURNEY_SECTION_NAME);
  let sectionCreated = false;
  if (!section) {
    section = await saveProfileQuestionSection({
      name: READING_JOURNEY_SECTION_NAME,
      header: reading.header,
      description: reading.description,
      sort_order: reading.order,
      active: reading.active !== false,
    });
    sectionCreated = true;
  }

  const have = new Set(questions.map(q => q.key));
  const pos = (k: CoreFieldKey) => order[k] ?? CORE_FIELDS.findIndex(f => f.key === k);
  const todo = [...READING_FIELDS].sort((a, b) => pos(a.key) - pos(b.key));
  let questionsCreated = 0;
  for (let i = 0; i < todo.length; i += 1) {
    const { key, type } = todo[i];
    if (have.has(key)) continue;
    const def = CORE_FIELDS.find(f => f.key === key)!;
    const o = overrides[key] ?? {};
    await saveProfileQuestion({
      key,
      section: section.name,
      question: o.label || def.label,
      placeholder: o.placeholder ?? def.placeholder,
      type,
      options: [],
      required: false,
      public_default: o.defaultVisible ?? def.defaultVisible,
      show_in_profile_card: true,
      profile_card_mode: 'answer',
      sort_order: i,
      active: o.active !== false,
    });
    questionsCreated += 1;
  }

  // Last step: retire the built-in tile. Done only after every question exists.
  await saveProfileSectionLayout(layout.map(x => x.key === 'reading_journey' ? { ...x, active: false, converted: true } : x));
  return { sectionCreated, questionsCreated };
}
