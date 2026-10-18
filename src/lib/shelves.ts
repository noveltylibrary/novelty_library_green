import type { ProfileQuestion } from '@/lib/profileQuestions';
import { answerText } from '@/components/ProfileQuestionAnswer';

/** "Up Next" and "Someday" reading shelves. Stored as ordinary profile answers (no schema change). */
export const UP_NEXT_KEY = 'q_up_next';
export const SOMEDAY_KEY = 'q_someday';
export const SHELF_MAX_ITEMS = 5;

/**
 * Repairs names saved before the space-typing fix ("CrimeandPunishment", "OrhanPamuk"). Only touches text that has no
 * spaces at all and glued capitals; anything a person typed normally is left alone.
 */
export function humanizeTitle(text: string): string {
  if (!text || /\s/.test(text) || (text.match(/[A-Z]/g) ?? []).length < 2) return text;
  return text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b([A-Z][a-z]{2,}?)(and|of|the|in|to|is|on|at)(?= [A-Z])/g, '$1 $2');
}

export type ShelfItem = { title: string; author: string };
export type ShelfKind = 'up_next' | 'someday';

export const SHELF_META: Record<ShelfKind, { key: string; title: string; hint: string; eyebrow: string }> = {
  up_next: { key: UP_NEXT_KEY, title: 'Up Next', eyebrow: 'On deck', hint: 'Books you will start soon.' },
  someday: { key: SOMEDAY_KEY, title: 'Someday', eyebrow: 'Wish list', hint: 'Books you want to get to eventually.' },
};

export const isShelfKey = (key: string): boolean => key === UP_NEXT_KEY || key === SOMEDAY_KEY;
export const isShelfQuestion = (q: Pick<ProfileQuestion, 'key'>): boolean => isShelfKey(q.key);
export const shelfKindOf = (key: string): ShelfKind | null => (key === UP_NEXT_KEY ? 'up_next' : key === SOMEDAY_KEY ? 'someday' : null);

export function readShelf(value: unknown, keepBlank = false): ShelfItem[] {
  const raw = value && typeof value === 'object' && 'items' in value ? (value as { items?: unknown }).items : null;
  if (!Array.isArray(raw)) return [];
  return raw
    // While editing (keepBlank) the text is kept exactly as typed, otherwise a trailing space is trimmed away on every keystroke and words can never be separated.
    .map((i): ShelfItem => {
      const t = String((i as ShelfItem)?.title ?? '').slice(0, 120);
      const a = String((i as ShelfItem)?.author ?? '').slice(0, 80);
      return keepBlank ? { title: t, author: a } : { title: humanizeTitle(t.trim()), author: humanizeTitle(a.trim()) };
    })
    .filter((i) => keepBlank || i.title)
    .slice(0, SHELF_MAX_ITEMS);
}

/** `value` is a plain-text fallback so every place that prints answers (admin view, card) still reads well. */
export function packShelf(items: ShelfItem[], keepBlank = false): unknown {
  const clean = items.filter((i) => keepBlank || i.title.trim()).slice(0, SHELF_MAX_ITEMS);
  if (!clean.length) return '';
  return { value: clean.map((i) => (i.author ? `${i.title} — ${i.author}` : i.title)).join('; '), items: clean };
}

export const shelfHasContent = (value: unknown): boolean => readShelf(value).length > 0 || (typeof value === 'string' && answerText(value).trim() !== '');

/**
 * The two shelves exist as profile questions only after `sql/shelves_questions_1_136.sql` is run. Until then they are
 * added here (editor only) so an owner can already fill them in; once the real rows exist, nothing is added twice.
 */
export function withShelfQuestions(questions: ProfileQuestion[]): ProfileQuestion[] {
  const has = new Set(questions.map((q) => q.key));
  const base = { section: 'Reading Identity', type: 'long_text' as const, options: [], required: false, public_default: true, show_in_profile_card: false, active: true };
  const extra: ProfileQuestion[] = [];
  if (!has.has(UP_NEXT_KEY)) extra.push({ ...base, section_order: 30, id: 'virtual-up-next', key: UP_NEXT_KEY, question: 'Up Next', sort_order: 900 });
  if (!has.has(SOMEDAY_KEY)) extra.push({ ...base, section_order: 30, id: 'virtual-someday', key: SOMEDAY_KEY, question: 'Someday', sort_order: 910 });
  return extra.length ? [...questions, ...extra] : questions;
}
