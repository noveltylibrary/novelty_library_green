import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * The built-in profile fields (not stored in profile_questions). Admins can edit their label,
 * placeholder and "visible by default" in Admin → Pages → Profile Page. Name and Email are locked.
 * Overrides are stored as JSON in public.editable_pages (slug 'profile-core-fields'), so no new table is needed.
 */
export type CoreFieldKey =
  | 'name' | 'email' | 'instagram'
  | 'reading_since' | 'books_read_this_month' | 'total_books_read'
  | 'favorite_book' | 'favorite_author' | 'favorite_genre';

export interface CoreFieldDef {
  key: CoreFieldKey;
  label: string;
  placeholder: string;
  section: string;
  type: string;
  locked: boolean;
  defaultVisible: boolean;
}

export const CORE_FIELDS: CoreFieldDef[] = [
  { key: 'name', label: 'Name', placeholder: 'Jane Doe', section: 'Identity', type: 'Short answer', locked: true, defaultVisible: true },
  { key: 'email', label: 'Email', placeholder: '', section: 'Identity', type: 'Account email', locked: true, defaultVisible: false },
  { key: 'instagram', label: 'Instagram', placeholder: '@yourhandle or instagram.com/yourhandle', section: 'Identity', type: 'Short answer', locked: false, defaultVisible: true },
  { key: 'reading_since', label: 'Reading Since', placeholder: '2024', section: 'Reading Journey', type: 'Year', locked: false, defaultVisible: true },
  { key: 'books_read_this_month', label: 'Books Read This Month', placeholder: '3', section: 'Reading Journey', type: 'Number', locked: false, defaultVisible: true },
  { key: 'total_books_read', label: 'Total Books Read', placeholder: '102', section: 'Reading Journey', type: 'Number', locked: false, defaultVisible: true },
  { key: 'favorite_book', label: 'Favourite Book', placeholder: 'e.g. The Midnight Library', section: 'Reading Journey', type: 'Short answer', locked: false, defaultVisible: true },
  { key: 'favorite_author', label: 'Favourite Author', placeholder: 'e.g. Madeline Miller', section: 'Reading Journey', type: 'Short answer', locked: false, defaultVisible: true },
  { key: 'favorite_genre', label: 'Favourite Genre', placeholder: 'e.g. Literary Fiction', section: 'Reading Journey', type: 'Short answer', locked: false, defaultVisible: true },
];

export type CoreOverride = { label?: string; placeholder?: string; defaultVisible?: boolean; active?: boolean };
export type CoreOverrides = Partial<Record<CoreFieldKey, CoreOverride>>;

const SLUG = 'profile-core-fields';
const LOCKED = new Set<string>(CORE_FIELDS.filter((f) => f.locked).map((f) => f.key));

export async function fetchCoreOverrides(): Promise<CoreOverrides> {
  const { data, error } = await supabase.from('editable_pages').select('content').eq('slug', SLUG).maybeSingle();
  if (error || !data?.content) return {};
  try {
    const parsed = JSON.parse(String(data.content)) as CoreOverrides;
    const clean: CoreOverrides = {};
    for (const f of CORE_FIELDS) {
      const o = parsed?.[f.key];
      if (!o || LOCKED.has(f.key)) continue; // locked fields can never be overridden
      clean[f.key] = {
        label: typeof o.label === 'string' && o.label.trim() ? o.label.trim().slice(0, 80) : undefined,
        placeholder: typeof o.placeholder === 'string' ? o.placeholder.slice(0, 120) : undefined,
        defaultVisible: typeof o.defaultVisible === 'boolean' ? o.defaultVisible : undefined,
        active: typeof o.active === 'boolean' ? o.active : undefined,
      };
    }
    return clean;
  } catch {
    return {};
  }
}

export async function saveCoreOverride(key: CoreFieldKey, override: CoreOverride): Promise<CoreOverrides> {
  if (LOCKED.has(key)) throw new Error('Name and Email are locked and cannot be edited.');
  const current = await fetchCoreOverrides();
  const next: CoreOverrides = { ...current, [key]: override };
  const { error } = await supabase
    .from('editable_pages')
    .upsert({ slug: SLUG, title: 'Profile built-in fields', content: JSON.stringify(next), updated_at: new Date().toISOString() }, { onConflict: 'slug' });
  if (error) throw error;
  return next;
}

export async function resetCoreOverride(key: CoreFieldKey): Promise<CoreOverrides> {
  const current = await fetchCoreOverrides();
  delete current[key];
  const { error } = await supabase
    .from('editable_pages')
    .upsert({ slug: SLUG, title: 'Profile built-in fields', content: JSON.stringify(current), updated_at: new Date().toISOString() }, { onConflict: 'slug' });
  if (error) throw error;
  return current;
}

export function coreLabel(o: CoreOverrides, key: CoreFieldKey): string {
  return o[key]?.label || CORE_FIELDS.find((f) => f.key === key)!.label;
}
export function corePlaceholder(o: CoreOverrides, key: CoreFieldKey): string {
  return o[key]?.placeholder ?? CORE_FIELDS.find((f) => f.key === key)!.placeholder;
}

/** Admin can switch a built-in field off; locked fields (name, email) are always on. */
export function coreActive(o: CoreOverrides, key: CoreFieldKey): boolean {
  if (CORE_FIELDS.find((f) => f.key === key)?.locked) return true;
  return o[key]?.active !== false;
}

export function useCoreOverrides(): CoreOverrides {
  const [o, setO] = useState<CoreOverrides>({});
  useEffect(() => {
    let alive = true;
    fetchCoreOverrides().then((v) => { if (alive) setO(v); }).catch(() => undefined);
    return () => { alive = false; };
  }, []);
  return o;
}


export type CoreFieldOrder = Partial<Record<CoreFieldKey, number>>;
const ORDER_SLUG = 'profile-core-field-order';

export async function fetchCoreFieldOrder(): Promise<CoreFieldOrder> {
  const { data } = await supabase.from('editable_pages').select('content').eq('slug', ORDER_SLUG).maybeSingle();
  if (!data?.content) return {};
  try {
    const parsed = JSON.parse(String(data.content));
    return parsed && typeof parsed === 'object' ? parsed as CoreFieldOrder : {};
  } catch { return {}; }
}

export async function saveCoreFieldOrder(order: CoreFieldOrder): Promise<CoreFieldOrder> {
  const { error } = await supabase.from('editable_pages').upsert({ slug: ORDER_SLUG, title: 'Profile built-in field order', content: JSON.stringify(order), updated_at: new Date().toISOString() }, { onConflict: 'slug' });
  if (error) throw error;
  return order;
}
