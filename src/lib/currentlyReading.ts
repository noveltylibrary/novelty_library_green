import type { ProfileQuestion, ProfileQuestionSection } from '@/lib/profileQuestions';
import { humanizeTitle } from '@/lib/shelves';
import { answerText } from '@/components/ProfileQuestionAnswer';

/** The "Currently Reading" profile question (admin-created). Matched by key, with the wording as a fallback. */
export const CURRENTLY_READING_KEY = 'q_mux1az58';
export const isCurrentlyReadingQuestion = (q: Pick<ProfileQuestion, 'key' | 'question'>): boolean =>
  q.key === CURRENTLY_READING_KEY || /^\s*currently\s+reading\s*$/i.test(q.question || '');

export type CurrentlyReading = { title: string; author: string; cover: string | null };

/**
 * The answer is still stored under the question's own key (so visitors receive it exactly like before),
 * as plain text when there is no optional metadata and as `{ value, cover?, author? }` when a cover or author is saved.
 * answerText() already understands the object form, so the card, onboarding and admin views keep showing the title.
 */
export function readCurrentlyReading(value: unknown, forEditing = false): CurrentlyReading {
  // The editor needs the text exactly as typed (a trimmed value swallows every space the person types).
  const title = forEditing ? answerText(value) : humanizeTitle(answerText(value).trim());
  const rawAuthor = value && typeof value === 'object' && 'author' in value ? String((value as { author?: unknown }).author ?? '') : '';
  const cover = value && typeof value === 'object' && 'cover' in value ? String((value as { cover?: unknown }).cover ?? '') : '';
  return { title, author: rawAuthor, cover: /^https?:\/\//i.test(cover) ? cover : null };
}

export function packCurrentlyReading(title: string, cover: string | null, author = ''): unknown {
  const cleanAuthor = author.trim();
  // Keep the legacy plain-string shape unless optional metadata needs to be stored.
  return cover || cleanAuthor ? { value: title, ...(cover ? { cover } : {}), ...(cleanAuthor ? { author: cleanAuthor } : {}) } : title;
}

/**
 * UI-only re-tiering: show "Currently Reading" as the FIRST question of the tier just before "Advanced Reader"
 * (Basic Reader) in the profile editor. Nothing is written to the database; the profile card keeps using the
 * original question list.
 */
export function moveCurrentlyReadingToBasic(questions: ProfileQuestion[], sections: ProfileQuestionSection[]): ProfileQuestion[] {
  const ordered = sections.filter((s) => s.active !== false).sort((a, b) => a.sort_order - b.sort_order);
  const advancedIdx = ordered.findIndex((s) => s.name === 'Reading Identity');
  const target = advancedIdx > 0 ? ordered[advancedIdx - 1] : null;
  if (!target) return questions;
  const firstOrder = Math.min(1, ...questions.filter((q) => q.section === target.name && !isCurrentlyReadingQuestion(q)).map((q) => q.sort_order));
  return questions.map((q) => (isCurrentlyReadingQuestion(q) ? { ...q, section: target.name, sort_order: firstOrder - 0.5 } : q));
}
