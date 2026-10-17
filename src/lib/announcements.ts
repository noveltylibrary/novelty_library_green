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
}

export const POSTER_BADGES = ['', 'ADAPTATION', 'EVENT', 'NEWS', 'LIVE'] as const;
export type PosterBadge = typeof POSTER_BADGES[number];
export const cleanBadge = (v: unknown): PosterBadge => {
  const up = String(v ?? '').trim().toUpperCase();
  return (POSTER_BADGES as readonly string[]).includes(up) ? (up as PosterBadge) : '';
};

/** Built-in "Live Rankings" poster: appears first in the strip until its end date, outside the 10-poster limit. */
export interface RankingsPosterSetting { enabled: boolean; /** YYYY-MM-DD, inclusive. */ until: string }
export const DEFAULT_RANKINGS_POSTER: RankingsPosterSetting = { enabled: true, until: '2026-11-17' };
export const isRankingsPosterActive = (r: RankingsPosterSetting, now = new Date()): boolean => {
  if (!r.enabled) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.until)) return true;
  const end = new Date(`${r.until}T23:59:59`);
  return Number.isNaN(end.getTime()) || now.getTime() <= end.getTime();
};

export interface AnnouncementsConfig {
  enabled: boolean;
  autoplay: boolean;
  intervalSec: number;
  heading: string;
  posters: Poster[];
  rankingsPoster: RankingsPosterSetting;
}

export const DEFAULT_ANNOUNCEMENTS: AnnouncementsConfig = {
  enabled: true,
  autoplay: true,
  intervalSec: 6,
  heading: 'Featured readers',
  posters: [],
  rankingsPoster: DEFAULT_RANKINGS_POSTER,
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
    rankingsPoster: {
      enabled: src.rankingsPoster?.enabled !== false,
      until: /^\d{4}-\d{2}-\d{2}$/.test(String(src.rankingsPoster?.until ?? '')) ? String(src.rankingsPoster?.until) : DEFAULT_RANKINGS_POSTER.until,
    },
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
  return { id: newId(), image, title: '', caption: '', link: '', badge: '' };
}

/**
 * HTML → posters. The pasted markup is only READ (never inserted into the page), and only https images / safe links
 * are kept, so scripts, handlers and styles in the pasted code can do nothing.
 *
 * Accepted shapes (any mix):
 *  1. Fixed format:  <div class="nl-poster" data-image="https://…" data-title="…" data-caption="…" data-link="https://…" data-badge="ADAPTATION|EVENT|NEWS|LIVE"></div>
 *  2. Linked image:  <a href="https://…" title="…"><img src="https://…" alt="Title"></a>   (e.g. Blogger / Canva / Instagram embeds)
 *  3. Plain image:   <img src="https://…" alt="Title">
 */
export function parsePosterHtml(html: string): Poster[] {
  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  const found: Poster[] = [];
  const seen = new Set<string>();
  const push = (image: string, title: string, caption: string, link: string, badge = '') => {
    const img = cleanPosterImage(image);
    if (!img || seen.has(img)) return;
    seen.add(img);
    found.push({ id: newId(), image: img, title: title.trim().slice(0, 90), caption: caption.trim().slice(0, 160), link: cleanPosterLink(link), badge: cleanBadge(badge) });
  };

  doc.querySelectorAll<HTMLElement>('.nl-poster, [data-poster]').forEach((el) => {
    push(el.dataset.image || el.querySelector('img')?.getAttribute('src') || '', el.dataset.title || '', el.dataset.caption || '', el.dataset.link || el.querySelector('a')?.getAttribute('href') || '', el.dataset.badge || '');
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
  data-badge="EVENT"></div>`;
