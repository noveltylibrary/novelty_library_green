import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Submit-page freeze. Stored in the existing `editable_pages` table (public read, admin write), so no schema change.
 * While frozen, readers still see every question but the form is read-only and a popup shows the admin's note.
 */
export const SUBMIT_FREEZE_SLUG = 'submit-freeze';
export const FREEZE_NOTE_MAX = 600;
export interface SubmitFreeze { frozen: boolean; note: string; /** Short label for the reason (optional). */ reason: string }
export const DEFAULT_FREEZE: SubmitFreeze = { frozen: false, note: '', reason: '' };
export const FREEZE_REASONS = ['Too many submissions right now', 'Submissions are closed for the season', 'We are updating the form', 'Temporarily paused'] as const;

function normalize(input: unknown): SubmitFreeze {
  const src = (input && typeof input === 'object' ? input : {}) as Partial<SubmitFreeze>;
  return { frozen: src.frozen === true, note: String(src.note ?? '').slice(0, FREEZE_NOTE_MAX), reason: String(src.reason ?? '').slice(0, 80) };
}

let memory: SubmitFreeze | null = null;
let inflight: Promise<SubmitFreeze> | null = null;

export function fetchSubmitFreeze(force = false): Promise<SubmitFreeze> {
  if (!force && inflight) return inflight;
  inflight = (async () => {
    const { data, error } = await supabase.from('editable_pages').select('content').eq('slug', SUBMIT_FREEZE_SLUG).maybeSingle();
    if (error) throw error;
    let cfg = DEFAULT_FREEZE;
    if (data?.content) { try { cfg = normalize(JSON.parse(String(data.content))); } catch { /* keep default */ } }
    memory = cfg;
    return cfg;
  })().finally(() => { inflight = null; });
  return inflight;
}

export async function saveSubmitFreeze(cfg: SubmitFreeze): Promise<SubmitFreeze> {
  const clean = normalize(cfg);
  const { error } = await supabase.from('editable_pages').upsert({
    slug: SUBMIT_FREEZE_SLUG, title: 'Submit page freeze', content: JSON.stringify(clean), updated_at: new Date().toISOString(),
  }, { onConflict: 'slug' });
  if (error) throw error;
  memory = clean;
  return clean;
}

/** Live freeze state. `loaded` is false until the first answer, so the page never flashes the wrong state. */
export function useSubmitFreeze(): SubmitFreeze & { loaded: boolean } {
  const [state, setState] = useState<SubmitFreeze>(memory ?? DEFAULT_FREEZE);
  const [loaded, setLoaded] = useState(!!memory);
  useEffect(() => {
    let alive = true;
    fetchSubmitFreeze(true).then((c) => { if (alive) { setState(c); setLoaded(true); } }).catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, []);
  return { ...state, loaded };
}
