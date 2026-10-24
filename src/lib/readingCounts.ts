/**
 * Consistency of a reader's own book counts: books this month can never exceed books this year, and neither can exceed
 * the all-time total. Whichever of the two fields was filled in SECOND gets the error, so the first answer stands.
 */
export type CountKey = 'month' | 'year' | 'total';
export interface CountError { key: CountKey; message: string }

const LABEL: Record<CountKey, string> = { month: 'books read this month', year: 'books read this year', total: 'total books read' };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const num = (v: string | null | undefined): number | null => {
  const t = String(v ?? '').trim();
  return /^\d+$/.test(t) ? Number(t) : null;
};

/** `order` lists the keys in the order the reader filled them in during this visit (earlier = filled first). */
export function readingCountError(values: Partial<Record<CountKey, string | null>>, order: CountKey[] = []): CountError | null {
  const month = num(values.month); const year = num(values.year); const total = num(values.total);
  const pairs: [small: CountKey, big: CountKey][] = [['month', 'year'], ['month', 'total'], ['year', 'total']];
  const v: Record<CountKey, number | null> = { month, year, total };
  for (const [small, big] of pairs) {
    const a = v[small]; const b = v[big];
    if (a == null || b == null || a <= b) continue;
    const ia = order.indexOf(small); const ib = order.indexOf(big);
    // The later one is "second". When neither was typed this visit (loaded from the profile), blame the smaller-scope field.
    const second: CountKey = ia === -1 && ib === -1 ? small : ia > ib ? small : big;
    const other: CountKey = second === small ? big : small;
    const message = second === small
      ? `${cap(LABEL[small])} can't be more than your ${LABEL[big]} (${b}). Lower it or update the other count first.`
      : `${cap(LABEL[big])} can't be less than your ${LABEL[small]} (${a}). Raise it or update the other count first.`;
    void other;
    return { key: second, message };
  }
  return null;
}

/** Keeps `order` in sync as a field goes from empty to filled (and back). */
export function trackFill(order: CountKey[], key: CountKey, value: string): CountKey[] {
  const filled = value.trim() !== '';
  const has = order.includes(key);
  if (filled && !has) return [...order, key];
  if (!filled && has) return order.filter((k) => k !== key);
  return order;
}
