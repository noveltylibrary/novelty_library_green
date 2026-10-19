/**
 * Reviewer verdict. The stored values match the CHECK constraint
 * `<table>_verdict_chk` on reviews / master_list / community_reviews:
 * NULL, 'perfection', 'go_for_it' or 'timepass'. Legacy rows are NULL.
 */
export type Verdict = 'perfection' | 'go_for_it' | 'timepass';

export const VERDICTS: { value: Verdict; label: string; blurb: string }[] = [
  { value: 'perfection', label: 'Perfection', blurb: 'A flawless, unforgettable read' },
  { value: 'go_for_it', label: 'Go for it', blurb: 'Worth your time — pick it up' },
  { value: 'timepass', label: 'Timepass', blurb: 'Light, easy, passes the time' },
];

/** Accepts anything (sheet text, DB value, old drafts) and returns a valid Verdict or null. Never throws. */
export function normalizeVerdict(raw: unknown): Verdict | null {
  if (typeof raw !== 'string') return null;
  const key = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return key === 'perfection' || key === 'go_for_it' || key === 'timepass' ? key : null;
}

export function verdictLabel(v: Verdict): string {
  return VERDICTS.find((x) => x.value === v)?.label ?? '';
}

/**
 * Soft sanity check between the verdict and the R/W rating (0–10).
 * Not a hard block: the reviewer is asked to confirm. Tune the numbers here.
 */
export const VERDICT_RATING_RULES: Record<Verdict, { min?: number; max?: number }> = {
  perfection: { min: 8.5 },
  go_for_it: { min: 5.5 },
  timepass: { max: 7.5 },
};

/** Returns a human-readable warning when verdict and rating look inconsistent, else null. */
export function verdictRatingWarning(verdict: unknown, rating: number): string | null {
  const v = normalizeVerdict(verdict);
  if (!v || !Number.isFinite(rating)) return null;
  const rule = VERDICT_RATING_RULES[v];
  const r = rating.toFixed(1);
  if (rule.min !== undefined && rating < rule.min) {
    return `You gave this book ${r}/10 but chose “${verdictLabel(v)}”, which usually means ${rule.min.toFixed(1)} or higher.`;
  }
  if (rule.max !== undefined && rating > rule.max) {
    return `You gave this book ${r}/10 but chose “${verdictLabel(v)}”, which usually means ${rule.max.toFixed(1)} or lower.`;
  }
  return null;
}
