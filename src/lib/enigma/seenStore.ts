import { supabase } from '@/lib/supabase';

/**
 * "Never the same question twice." Every word / puzzle served to a reader is remembered (as a short hash, not the text).
 * The memory lives in this browser, and for signed-in readers it is also mirrored into their account's user metadata
 * (`nl_enigma`, the same place `nl_prefs` already uses), so a new device does not replay old puzzles. No tables involved.
 */
export type EnigmaGameId = 'lexi' | 'hang';

const DAY = 86_400_000;
const CAP: Record<EnigmaGameId, number> = { lexi: 3000, hang: 3000 };
const MIRROR_CAP = 450;
/** LexiWord answers stay out of rotation for a year; HangLex puzzles never return while any unseen puzzle remains. */
export const WINDOW_MS: Record<EnigmaGameId, number> = { lexi: 365 * DAY, hang: Number.POSITIVE_INFINITY };

type Entry = [hash: string, day: number];
type Store = Record<EnigmaGameId, Entry[]>;

const dayNow = () => Math.floor(Date.now() / DAY);
const storeKey = (reader: string) => `nl_en_seen:${reader}`;

/** FNV-1a, base 36. Short, stable, and not reversible into the puzzle text. */
export function hashKey(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}

const clean = (raw: unknown): Entry[] => (Array.isArray(raw) ? raw.filter((e): e is Entry => Array.isArray(e) && typeof e[0] === 'string' && typeof e[1] === 'number') : []);

function read(reader: string): Store {
  try {
    const parsed = JSON.parse(localStorage.getItem(storeKey(reader)) || '{}') as Partial<Store>;
    return { lexi: clean(parsed.lexi), hang: clean(parsed.hang) };
  } catch { return { lexi: [], hang: [] }; }
}
function write(reader: string, store: Store) {
  try { localStorage.setItem(storeKey(reader), JSON.stringify({ lexi: store.lexi.slice(-CAP.lexi), hang: store.hang.slice(-CAP.hang) })); } catch { /* private mode: memory lasts for this visit only */ }
}

/** hash → day last served, for hashes still inside the game's no-repeat window. */
export function seenMap(reader: string, game: EnigmaGameId): Map<string, number> {
  const out = new Map<string, number>();
  const limit = WINDOW_MS[game];
  const today = dayNow();
  for (const [h, d] of read(reader)[game]) if ((today - d) * DAY <= limit) out.set(h, Math.max(d, out.get(h) ?? 0));
  return out;
}

/** Every hash ever served, regardless of window (used to pick the least-recently-seen when a pool runs dry). */
export function lastSeen(reader: string, game: EnigmaGameId): Map<string, number> {
  const out = new Map<string, number>();
  for (const [h, d] of read(reader)[game]) out.set(h, Math.max(d, out.get(h) ?? 0));
  return out;
}

let mirrorTimer: number | null = null;
export function markSeen(reader: string, game: EnigmaGameId, key: string, signedIn: boolean) {
  const store = read(reader);
  store[game].push([hashKey(key), dayNow()]);
  write(reader, store);
  if (signedIn) scheduleMirror(reader);
}

function scheduleMirror(reader: string) {
  if (typeof window === 'undefined') return;
  if (mirrorTimer) window.clearTimeout(mirrorTimer);
  mirrorTimer = window.setTimeout(() => {
    mirrorTimer = null;
    const s = read(reader);
    void Promise.resolve(supabase.auth.updateUser({ data: { nl_enigma: { l: s.lexi.slice(-MIRROR_CAP), h: s.hang.slice(-MIRROR_CAP) } } })).catch(() => undefined);
  }, 4000);
}

/** Merge what the account remembers (from another device) into this browser. Safe to call repeatedly. */
export function mergeRemote(reader: string, metadata: unknown) {
  const remote = (metadata as { nl_enigma?: { l?: unknown; h?: unknown } } | null | undefined)?.nl_enigma;
  if (!remote) return;
  const store = read(reader);
  let changed = false;
  for (const [game, raw] of [['lexi', remote.l], ['hang', remote.h]] as const) {
    const have = new Set(store[game].map((e) => e[0]));
    for (const e of clean(raw)) if (!have.has(e[0])) { store[game].push(e); have.add(e[0]); changed = true; }
  }
  if (changed) write(reader, store);
}
