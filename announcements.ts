import { supabase } from '@/lib/supabase';
import { prepareImageForUpload, extForImageType } from '@/lib/imageUpload';

/** Home "Featured" poster strip. Stored in the existing `editable_pages` table (public read, admin write) — no schema change. */
export const POSTER_SLUG = 'home-announcement-posters';
export const MAX_POSTERS = 10;
export const RECOMMENDED_POSTERS = 6;
/** Broad (landscape) poster format used everywhere: 16:9. */
export const POSTER_WIDTH = 1600;
export const POSTER_HEIGHT = 900;

export interface Poster {
  id: string;
  image: string;
  title: string;
  caption: string;
  /** https:// URL, or an in-app path such as /reviews. Empty = the poster is not clickable. */
  link: string;
  /** Small label on the card. '' = none. */
  badge: PosterBadge;
  /** YYYY-MM-DD, inclusive. '' = no limit. New posters default to a one-week run. */
  from: string;
  until: string;
}

export const cleanDate = (v: unknown): string => (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? '')) ? String(v) : '');
const pad = (n: number) => String(n).padStart(2, '0');
export const isoDate = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** Today → +6 days: a week, counting today. */
export const weekRange = (now = new Date()): { from: string; until: string } => {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 6);
  return { from: isoDate(now), until: isoDate(end) };
};
/** True when `now` falls inside [from, until] (either end may be empty). */
export function isWithinDates(from: string, until: string, now = new Date()): boolean {
  if (from) { const start = new Date(`${from}T00:00:00`); if (!Number.isNaN(start.getTime()) && now.getTime() < start.getTime()) return false; }
  if (until) { const end = new Date(`${until}T23:59:59`); if (!Number.isNaN(end.getTime()) && now.getTime() > end.getTime()) return false; }
  return true;
}
export const isPosterLive = (p: Pick<Poster, 'from' | 'until'>, now = new Date()): boolean => isWithinDates(p.from, p.until, now);

export const POSTER_BADGES = ['', 'ADAPTATION', 'EVENT', 'NEWS', 'LIVE'] as const;
export type PosterBadge = typeof POSTER_BADGES[number];
export const cleanBadge = (v: unknown): PosterBadge => {
  const up = String(v ?? '').trim().toUpperCase();
  return (POSTER_BADGES as readonly string[]).includes(up) ? (up as PosterBadge) : '';
};

/**
 * Built-in posters (Live Rankings and Taste Match). They sit first in the strip, outside the 10-poster limit, and are
 * fully editable: wording, link, badge and an optional from / until date. Empty dates = always on.
 */
export type BuiltinKey = 'rankings' | 'taste';
export interface BuiltinPoster { enabled: boolean; title: string; caption: string; link: string; badge: PosterBadge; from: string; until: string }
export const BUILTIN_KEYS: BuiltinKey[] = ['rankings', 'taste'];
export const BUILTIN_LABEL: Record<BuiltinKey, string> = { rankings: 'Live Rankings', taste: 'Taste Match' };
export const DEFAULT_BUILTINS: Record<BuiltinKey, BuiltinPoster> = {
  rankings: { enabled: true, title: 'Live Rankings', caption: 'Ranked by readers. Search by genre, language, traits or author.', link: '/live-rankings', badge: 'LIVE', from: '', until: '' },
  taste: { enabled: true, title: 'Taste Match', caption: 'Tell us your mood and we will match you to your next read.', link: '/taste-match', badge: 'NEWS', from: '', until: '' },
};
export const isBuiltinActive = (b: BuiltinPoster, now = new Date()): boolean => b.enabled && isWithinDates(b.from, b.until, now);

export interface AnnouncementsConfig {
  enabled: boolean;
  autoplay: boolean;
  intervalSec: number;
  heading: string;
  posters: Poster[];
  builtins: Record<BuiltinKey, BuiltinPoster>;
}

export const DEFAULT_ANNOUNCEMENTS: AnnouncementsConfig = {
  enabled: true,
  autoplay: true,
  intervalSec: 6,
  heading: 'Featured readers',
  posters: [],
  builtins: DEFAULT_BUILTINS,
};

const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

/** Accepts https:// URLs and in-app paths only. Returns '' for anything else (javascript:, data:, etc.). */
export function cleanPosterLink(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '';
  if (/^\/(?!\/)[\w\-./?=&%#]*$/.test(raw)) return raw;
  if (/^#\//.test(raw)) return raw.slice(1);
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? url.href : '';
  } catch { return ''; }
}

export function cleanPosterImage(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? url.href : '';
  } catch { return ''; }
}

function normalizeBuiltins(src: Partial<AnnouncementsConfig> & { rankingsPoster?: { enabled?: boolean; until?: string } }): Record<BuiltinKey, BuiltinPoster> {
  const saved = (src.builtins && typeof src.builtins === 'object' ? src.builtins : {}) as Partial<Record<BuiltinKey, Partial<BuiltinPoster>>>;
  const legacy = src.rankingsPoster; // v1.131–1.148 stored only { enabled, until } for Live Rankings
  const out = {} as Record<BuiltinKey, BuiltinPoster>;
  for (const key of BUILTIN_KEYS) {
    const d = DEFAULT_BUILTINS[key];
    const b: Partial<BuiltinPoster> = saved[key] ?? (key === 'rankings' && legacy ? { enabled: legacy.enabled !== false, until: legacy.until } : {});
    out[key] = {
      enabled: b.enabled !== false,
      title: typeof b.title === 'string' ? b.title.slice(0, 90) : d.title,
      caption: typeof b.caption === 'string' ? b.caption.slice(0, 160) : d.caption,
      link: (() => {
        const configured = typeof b.link === 'string' ? cleanPosterLink(b.link) : d.link;
        // Move previously saved Taste Match posters from the embedded anchor to the new route.
        return key === 'taste' && (configured === '/live-rankings#taste' || configured === 'live-rankings#taste') ? '/taste-match' : configured;
      })(),
      badge: b.badge === undefined ? d.badge : cleanBadge(b.badge),
      from: cleanDate(b.from),
      until: cleanDate(b.until),
    };
  }
  return out;
}

function normalize(input: unknown): AnnouncementsConfig {
  const src = (input && typeof input === 'object' ? input : {}) as Partial<AnnouncementsConfig>;
  const posters = (Array.isArray(src.posters) ? src.posters : [])
    .map((p): Poster => ({
      id: typeof p?.id === 'string' && p.id ? p.id : newId(),
      image: cleanPosterImage(p?.image),
      title: String(p?.title ?? '').slice(0, 90),
      caption: String(p?.caption ?? '').slice(0, 160),
      link: cleanPosterLink(p?.link),
      badge: cleanBadge(p?.badge),
      from: cleanDate(p?.from),
      until: cleanDate(p?.until),
    }))
    .filter((p) => p.image)
    .slice(0, MAX_POSTERS);
  const interval = Number(src.intervalSec);
  return {
    enabled: src.enabled !== false,
    autoplay: src.autoplay !== false,
    intervalSec: Number.isFinite(interval) ? Math.min(20, Math.max(3, Math.round(interval))) : DEFAULT_ANNOUNCEMENTS.intervalSec,
    heading: String(src.heading ?? DEFAULT_ANNOUNCEMENTS.heading).slice(0, 60),
    posters,
    builtins: normalizeBuiltins(src),
  };
}

const STORE_KEY = 'nl_announcements_v1';
let memory: AnnouncementsConfig | null = null;
let inflight: Promise<AnnouncementsConfig> | null = null;

/** Instant read from memory / the last visit (null if never loaded). */
export function peekAnnouncements(): AnnouncementsConfig | null {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) memory = normalize(JSON.parse(raw));
  } catch { /* ignore */ }
  return memory;
}

function remember(cfg: AnnouncementsConfig) {
  memory = cfg;
  try { localStorage.setItem(STORE_KEY, JSON.stringify(cfg)); } catch { /* ignore */ }
}

export function fetchAnnouncements(): Promise<AnnouncementsConfig> {
  if (inflight) return inflight;
  inflight = (async () => {
    const { data, error } = await supabase.from('editable_pages').select('content').eq('slug', POSTER_SLUG).maybeSingle();
    if (error) throw error;
    let cfg = DEFAULT_ANNOUNCEMENTS;
    if (data?.content) {
      try { cfg = normalize(JSON.parse(String(data.content))); } catch { /* fall back to default */ }
    }
    remember(cfg);
    return cfg;
  })().finally(() => { inflight = null; });
  return inflight;
}

export async function saveAnnouncements(cfg: AnnouncementsConfig): Promise<AnnouncementsConfig> {
  const clean = normalize(cfg);
  const { error } = await supabase.from('editable_pages').upsert({
    slug: POSTER_SLUG,
    title: 'Home featured posters',
    content: JSON.stringify(clean),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'slug' });
  if (error) throw error;
  remember(clean);
  return clean;
}

/** Uploads one poster image to the existing `posters` bucket (admin only) and returns its public URL. */
export async function uploadPosterImage(file: File): Promise<string> {
  const prepared = await prepareImageForUpload(file, POSTER_WIDTH, POSTER_HEIGHT * 2);
  const path = `announcements/${newId()}.${extForImageType(prepared.type)}`;
  const { error } = await supabase.storage.from('posters').upload(path, prepared, { contentType: prepared.type, cacheControl: '31536000', upsert: false });
  if (error) throw error;
  return supabase.storage.from('posters').getPublicUrl(path).data.publicUrl;
}

export function blankPoster(image: string): Poster {
  return { id: newId(), image, title: '', caption: '', link: '', badge: '', ...weekRange() };
}

/**
 * HTML → posters. The pasted markup is only READ (never inserted into the page), and only https images / safe links
 * are kept, so scripts, handlers and styles in the pasted code can do nothing.
 *
 * Accepted shapes (any mix):
 *  1. Fixed format:  <div class="nl-poster" data-image="https://…" data-title="…" data-caption="…" data-link="https://…" data-badge="ADAPTATION|EVENT|NEWS|LIVE" data-from="YYYY-MM-DD" data-until="YYYY-MM-DD"></div>
 *     (dates optional: without them a pasted poster runs for one week from today)
 *  2. Linked image:  <a href="https://…" title="…"><img src="https://…" alt="Title"></a>   (e.g. Blogger / Canva / Instagram embeds)
 *  3. Plain image:   <img src="https://…" alt="Title">
 */
export function parsePosterHtml(html: string): Poster[] {
  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  const found: Poster[] = [];
  const seen = new Set<string>();
  const push = (image: string, title: string, caption: string, link: string, badge = '', from = '', until = '') => {
    const img = cleanPosterImage(image);
    if (!img || seen.has(img)) return;
    seen.add(img);
    found.push({ id: newId(), image: img, title: title.trim().slice(0, 90), caption: caption.trim().slice(0, 160), link: cleanPosterLink(link), badge: cleanBadge(badge), ...weekRange(), ...(cleanDate(from) ? { from: cleanDate(from) } : {}), ...(cleanDate(until) ? { until: cleanDate(until) } : {}) });
  };

  doc.querySelectorAll<HTMLElement>('.nl-poster, [data-poster]').forEach((el) => {
    push(el.dataset.image || el.querySelector('img')?.getAttribute('src') || '', el.dataset.title || '', el.dataset.caption || '', el.dataset.link || el.querySelector('a')?.getAttribute('href') || '', el.dataset.badge || '', el.dataset.from || '', el.dataset.until || '');
  });
  doc.querySelectorAll('a').forEach((a) => {
    const img = a.querySelector('img');
    if (img) push(img.getAttribute('src') || '', img.getAttribute('alt') || a.getAttribute('title') || '', '', a.getAttribute('href') || '');
  });
  doc.querySelectorAll('img').forEach((img) => push(img.getAttribute('src') || '', img.getAttribute('alt') || '', '', ''));
  return found;
}

export const POSTER_HTML_EXAMPLE = `<div class="nl-poster"
  data-image="https://example.com/poster.jpg"
  data-title="Reader of the Month"
  data-caption="Meet this month's featured reader"
  data-link="https://noveltylibrary.blogspot.com/"
  data-badge="EVENT"
  data-from="2026-10-20"
  data-until="2026-10-27"></div>`;
