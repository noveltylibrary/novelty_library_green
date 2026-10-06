import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * The built-in profile fields (not stored in profile_questions). Admins can edit their label,
 * placeholder and "visible by default" in Admin → Pages → Profile Page. Name and Email are locked.
 * Overrides are stored as JSON in public.editable_pages (slug 'profile-core-fields'), so no new table is needed.
 */
export type CoreFieldKey =
  | 'name' | 'email' | 'instagram'
  | 'reading_since' | 'books_read_this_month' | 'total_books_read' | 'total_books_published'
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
  { key: 'total_books_published', label: 'Total Books Published', placeholder: '', section: 'Basic Reader', type: 'Read-only number', locked: false, defaultVisible: true },
  { key: 'favorite_book', label: 'Favourite Book', placeholder: 'e.g. The Midnight Library', section: 'Reading Journey', type: 'Short answer', locked: false, defaultVisible: true },
  { key: 'favorite_author', label: 'Favourite Author', placeholder: 'e.g. Madeline Miller', section: 'Reading Journey', type: 'Short answer', locked: false, defaultVisible: true },
  { key: 'favorite_genre', label: 'Favourite Genre', placeholder: 'e.g. Literary Fiction', section: 'Reading Journey', type: 'Short answer', locked: false, defaultVisible: true },
];

/** Built-in sections that can hold built-in fields. Name and Email are always pinned in reader_identity. */
export type CoreSectionKey = 'reader_identity' | 'basic_reader' | 'reading_journey' | `custom:${string}`;
export const CORE_SECTION_KEYS: CoreSectionKey[] = ['reader_identity', 'basic_reader', 'reading_journey'];
export const isCoreSectionKey = (v: unknown): v is CoreSectionKey =>
  v === 'reader_identity' || v === 'basic_reader' || v === 'reading_journey' || (typeof v === 'string' && /^custom:.{1,80}$/.test(v));

export type CoreOverride = { label?: string; placeholder?: string; defaultVisible?: boolean; active?: boolean; section?: CoreSectionKey };
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
        section: isCoreSectionKey(o.section) ? o.section : undefined,
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

/** Default section of a built-in field (before any admin override). */
export function coreDefaultSection(key: CoreFieldKey): CoreSectionKey {
  const section = CORE_FIELDS.find((f) => f.key === key)?.section;
  if (section === 'Reading Journey') return 'reading_journey';
  if (section === 'Basic Reader') return 'basic_reader';
  return 'reader_identity';
}

/** Section a built-in field is shown in. Locked fields (name, email) never move. */
export function coreSection(o: CoreOverrides, key: CoreFieldKey, validCustom?: ReadonlySet<string>): CoreSectionKey {
  if (LOCKED.has(key)) return 'reader_identity';
  const chosen = o[key]?.section;
  if (!chosen) return coreDefaultSection(key);
  // A field assigned to a question section that was deleted or switched off falls back to its default section.
  if (chosen.startsWith('custom:') && !(validCustom?.has(chosen))) return coreDefaultSection(key);
  return chosen;
}

/**
 * Editable built-in fields of one section, in display order. Locked fields (name, email) are rendered by
 * the profile page itself at the top of the identity section, so they are not part of this list.
 */
export function coreFieldsInSection(o: CoreOverrides, order: CoreFieldOrder, section: CoreSectionKey, validCustom?: ReadonlySet<string>): CoreFieldDef[] {
  const pos = (k: CoreFieldKey) => order[k] ?? CORE_FIELDS.findIndex((f) => f.key === k);
  return CORE_FIELDS
    .filter((f) => !f.locked && coreSection(o, f.key, validCustom) === section)
    .sort((a, b) => pos(a.key) - pos(b.key) || CORE_FIELDS.indexOf(a) - CORE_FIELDS.indexOf(b));
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

/**
 * Persists a drag-and-drop result for built-in fields: the dragged field's section (kept as an override,
 * only stored when it differs from the default) plus the full order map.
 */
export async function saveCoreFieldPlacement(
  key: CoreFieldKey,
  section: CoreSectionKey,
  order: CoreFieldOrder,
): Promise<{ overrides: CoreOverrides; order: CoreFieldOrder }> {
  if (LOCKED.has(key)) throw new Error('Name and Email are locked and cannot be moved.');
  const current = await fetchCoreOverrides();
  const existing = current[key] ?? {};
  const nextOverride: CoreOverride = { ...existing, section: section === coreDefaultSection(key) ? undefined : section };
  const overrides: CoreOverrides = { ...current, [key]: nextOverride };
  const { error } = await supabase
    .from('editable_pages')
    .upsert({ slug: SLUG, title: 'Profile built-in fields', content: JSON.stringify(overrides), updated_at: new Date().toISOString() }, { onConflict: 'slug' });
  if (error) throw error;
  return { overrides, order: await saveCoreFieldOrder(order) };
}
