/**
 * Parses the date shapes that appear in this app: full ISO timestamps
 * (published_on), plain YYYY-MM-DD, and sheet-style DD/MM/YYYY. Returns null
 * instead of an "Invalid Date" so callers can hide the field.
 */
export function parseAppDate(value: string | null | undefined): Date | null {
  const raw = (value || '').trim();
  if (!raw) return null;
  let d: Date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) d = new Date(`${raw}T00:00:00`);
  else {
    const dmy = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
    d = dmy ? new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1])) : new Date(raw);
  }
  return Number.isFinite(d.getTime()) ? d : null;
}

export function formatDate(dateStr: string): string {
  const date = parseAppDate(dateStr);
  if (!date) return '';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function formatShortDate(dateStr: string): string {
  const date = parseAppDate(dateStr);
  if (!date) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Supabase/Postgrest errors are plain objects shaped like
// { message, details, hint, code } — they are NOT `instanceof Error`.
// A bare `err instanceof Error ? err.message : 'fallback'` check silently
// swallows the real database error and always shows the generic fallback
// instead, which makes failures impossible to diagnose. This pulls the
// message out of both real Errors and Postgrest-style error objects.
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message?: unknown }).message === 'string') {
    const e = err as { message: string; details?: string; hint?: string; code?: string };
    const parts = [e.message, e.details, e.hint].filter(Boolean);
    return e.code ? `${parts.join(' — ')} (${e.code})` : parts.join(' — ');
  }
  return fallback;
}
