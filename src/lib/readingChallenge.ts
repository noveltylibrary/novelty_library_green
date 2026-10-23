/**
 * Annual Reading Challenge.
 * Stored inside the reader's own profile answers (profiles.profile_answers.__reading_challenge) like the other reserved
 * `__` keys, so it follows the reader everywhere and is readable on the public profile without any schema change.
 */
export type ChallengeTier = 'casual' | 'bookworm' | 'advanced' | 'custom';
/** `extra` = books the reader added by hand on top of the automatic count (reviews posted later, books read but never reviewed). */
export interface ReadingChallenge { goal: number; tier: ChallengeTier; show: boolean; extra: number }

export const CHALLENGE_KEY = '__reading_challenge';
export const DEFAULT_GOAL = 35;
export const MAX_GOAL = 999;
export const MAX_EXTRA = 999;
export const clampExtra = (n: unknown): number => { const v = Math.floor(Number(n)); return Number.isFinite(v) ? Math.min(MAX_EXTRA, Math.max(0, v)) : 0; };
export const TIER_PRESETS: { tier: Exclude<ChallengeTier, 'custom'>; label: string; goal: number }[] = [
  { tier: 'casual', label: 'Casual', goal: 12 },
  { tier: 'bookworm', label: 'Bookworm', goal: 25 },
  { tier: 'advanced', label: 'Advanced', goal: 50 },
];

export const clampGoal = (n: unknown): number => {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) ? Math.min(MAX_GOAL, Math.max(1, v)) : DEFAULT_GOAL;
};
const isTier = (v: unknown): v is ChallengeTier => v === 'casual' || v === 'bookworm' || v === 'advanced' || v === 'custom';

/** Reads the saved challenge; null when the reader has not set one. Never throws on odd data. */
export function readChallenge(answers: Record<string, unknown> | null | undefined): ReadingChallenge | null {
  const raw = answers?.[CHALLENGE_KEY];
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { goal?: unknown; tier?: unknown; show?: unknown; extra?: unknown };
  const goal = clampGoal(r.goal);
  const preset = TIER_PRESETS.find((p) => p.goal === goal);
  const tier = isTier(r.tier) ? r.tier : preset?.tier ?? 'custom';
  return { goal, tier: tier !== 'custom' && TIER_PRESETS.find((p) => p.tier === tier)?.goal !== goal ? 'custom' : tier, show: r.show !== false, extra: clampExtra(r.extra) };
}

export function packChallenge(c: ReadingChallenge): ReadingChallenge {
  const goal = clampGoal(c.goal);
  const preset = TIER_PRESETS.find((p) => p.goal === goal);
  return { goal, tier: c.tier === 'custom' ? 'custom' : preset?.tier ?? 'custom', show: c.show !== false, extra: clampExtra(c.extra) };
}

/**
 * Books read this year, automatically: published reviews whose "Date of review" (the field on the Submit form) falls in the year.
 * Reviews with no date are not counted; the reader can add those with the manual entry (`extra`).
 */
export function countReadInYear(reviews: { review_date?: string | null }[], year: number): number {
  let n = 0;
  for (const r of reviews) {
    const m = /(?:^|[^0-9])((?:19|20)\d{2})(?!\d)/.exec(String(r.review_date ?? ''));
    if (m && Number(m[1]) === year) n += 1;
  }
  return n;
}

export interface Pace { pct: number; tone: 'done' | 'ahead' | 'on' | 'behind' | 'start'; text: string }

/** Friendly pacing line from books read, the goal and today's date. */
export function paceFor(read: number, goal: number, now: Date = new Date()): Pace {
  const pct = goal > 0 ? Math.min(100, Math.round((read / goal) * 100)) : 0;
  const left = Math.max(0, goal - read);
  if (left === 0) return { pct: 100, tone: 'done', text: read > goal ? `Goal beaten by ${read - goal} ${read - goal === 1 ? 'book' : 'books'}. Wonderful reading year.` : 'Goal reached. Wonderful reading year.' };
  const start = new Date(now.getFullYear(), 0, 1).getTime();
  const end = new Date(now.getFullYear() + 1, 0, 1).getTime();
  const elapsed = Math.min(1, Math.max(0, (now.getTime() - start) / (end - start)));
  const expected = goal * elapsed;
  const diff = read - expected;
  const monthsLeft = Math.max(1, 12 - now.getMonth() - (now.getDate() > 15 ? 1 : 0));
  const perMonth = Math.ceil(left / monthsLeft);
  const books = (n: number) => `${n} ${n === 1 ? 'book' : 'books'}`;
  if (read === 0 && elapsed < 0.04) return { pct, tone: 'start', text: `A fresh year. ${books(left)} to go, about ${perMonth} a month.` };
  if (diff >= 1) return { pct, tone: 'ahead', text: `Ahead of pace by ${books(Math.floor(diff))}. ${books(left)} to go.` };
  if (diff > -1) return { pct, tone: 'on', text: `Right on pace. ${books(left)} to go, about ${perMonth} a month.` };
  return { pct, tone: 'behind', text: `${books(Math.ceil(-diff))} behind pace. ${books(left)} to go, about ${perMonth} a month catches you up.` };
}
