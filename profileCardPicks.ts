import type { ProfileQuestion } from '@/lib/profileQuestions';
import { answerText } from '@/components/ProfileQuestionAnswer';

/** The "Advanced Reader" questions live in the section named "Reading Identity" (its heading is "Advanced Reader"). */
export const ADVANCED_READER_SECTION = 'Reading Identity';
export const MAX_CARD_QUESTIONS = 5;
export const MAX_CARD_TAGS = 3;

/** Keys inside profile_answers that the public profile RPC uses to hand the owner's picks to other readers. */
export const PUBLIC_PICKS_QA_KEY = '__card_qa';
export const PUBLIC_PICKS_TAGS_KEY = '__card_tags';

export type CardPicks = { qa: string[]; tags: string[] };

export const isAdvancedQuestion = (q: Pick<ProfileQuestion, 'section'>): boolean => q.section === ADVANCED_READER_SECTION;

const strings = (v: unknown): string[] => (Array.isArray(v) ? v : []).filter((x): x is string => typeof x === 'string' && x.length > 0);

/** Cleans stored picks: strings only, no duplicates, a key can't be both a question and a tag, hard caps applied. */
export function normalizePicks(qa: unknown, tags: unknown): CardPicks {
  const q = [...new Set(strings(qa))].slice(0, MAX_CARD_QUESTIONS);
  const t = [...new Set(strings(tags))].filter((k) => !q.includes(k)).slice(0, MAX_CARD_TAGS);
  return { qa: q, tags: t };
}

const hasAnswer = (q: ProfileQuestion, answers: Record<string, unknown>): boolean => {
  const v = answers[q.key];
  if (v === undefined || v === null) return false;
  return q.type === 'image_upload' ? Array.isArray(v) && v.length > 0 : answerText(v).trim() !== '';
};

const asMode = (q: ProfileQuestion, kind: 'tag' | 'answer'): ProfileQuestion => {
  const hideQuestion = q.profile_card_mode === 'tag_no_question' || q.profile_card_mode === 'answer_no_question';
  return { ...q, profile_card_mode: kind === 'tag' ? (hideQuestion ? 'tag_no_question' : 'tag') : (hideQuestion ? 'answer_no_question' : 'answer') };
};

/**
 * Applies the reader's picks to the profile-card question list.
 * - Questions outside the Advanced Reader section are untouched.
 * - Advanced Reader questions the reader picked are shown as a Q&A (max 5) or a tag (max 3); the rest are hidden.
 * - A reader who never picked anything gets the first 5 answered Q&As / 3 answered tags, so the caps always hold.
 */
export function applyCardPicks(questions: ProfileQuestion[], answers: Record<string, unknown>, picks: CardPicks): ProfileQuestion[] {
  const rest = questions.filter((q) => !isAdvancedQuestion(q));
  const advanced = questions.filter(isAdvancedQuestion);
  const byKey = new Map(advanced.map((q) => [q.key, q]));
  const clean = normalizePicks(picks.qa, picks.tags);
  let shown: ProfileQuestion[];
  if (clean.qa.length || clean.tags.length) {
    shown = [
      ...clean.qa.map((k) => byKey.get(k)).filter((q): q is ProfileQuestion => !!q && hasAnswer(q, answers)).map((q) => asMode(q, 'answer')),
      ...clean.tags.map((k) => byKey.get(k)).filter((q): q is ProfileQuestion => !!q && hasAnswer(q, answers)).map((q) => asMode(q, 'tag')),
    ];
  } else {
    const isTag = (q: ProfileQuestion) => q.profile_card_mode === 'tag' || q.profile_card_mode === 'tag_no_question';
    const answered = advanced.filter((q) => hasAnswer(q, answers));
    shown = [...answered.filter((q) => !isTag(q)).slice(0, MAX_CARD_QUESTIONS), ...answered.filter(isTag).slice(0, MAX_CARD_TAGS)];
  }
  return [...rest, ...shown];
}
