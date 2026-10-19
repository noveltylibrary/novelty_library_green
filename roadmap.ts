import { supabase } from '@/lib/supabase';

/** "What's live / what's next" table on About. Stored in the existing `editable_pages` table (public read, admin write). */
export const ROADMAP_SLUG = 'site-roadmap';
export const MAX_ROADMAP_ROWS = 14;

export type RoadmapStatus = 'live' | 'building' | 'planned';
export const STATUS_LABELS: Record<RoadmapStatus, string> = { live: 'Live', building: 'Building', planned: 'Planned' };

export interface RoadmapRow { id: string; feature: string; status: RoadmapStatus; note: string }
export interface RoadmapConfig { enabled: boolean; heading: string; intro: string; rows: RoadmapRow[] }

const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `r_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
export const blankRow = (): RoadmapRow => ({ id: newId(), feature: '', status: 'planned', note: '' });

export const DEFAULT_ROADMAP: RoadmapConfig = {
  enabled: true,
  heading: "What's live, what's next",
  intro: 'Novelty Library grows in the open. Here is where things stand today.',
  rows: [
    { id: 'd1', feature: 'Reviews with R/W and NL ratings', status: 'live', note: "Every published review carries the reviewer's R/W score and the community's NL score." },
    { id: 'd2', feature: 'Reader profiles, follows and stories', status: 'live', note: 'A shareable reader card, followers, and short stories for the community.' },
    { id: 'd3', feature: 'Live Rankings, search and basic taste match', status: 'live', note: 'Search by genre, language, traits or author, or describe what you feel like reading.' },
    { id: 'd4', feature: 'Currently Reading, Up Next and Someday shelves', status: 'live', note: 'Show what you are reading now and what you plan to read, on your profile.' },
    { id: 'd5', feature: 'Featured announcements on Home', status: 'live', note: 'Posters for featured readers, launches and news.' },
    { id: 'd6', feature: 'Full Taste Match engine', status: 'building', note: 'A deeper, personal recommendation engine. A basic version is already in Live Rankings.' },
    { id: 'd7', feature: 'Adaptations and events', status: 'planned', note: 'Book-to-screen news and reader events, shared as announcement posters first.' },
  ],
};

function normalize(input: unknown): RoadmapConfig {
  const src = (input && typeof input === 'object' ? input : {}) as Partial<RoadmapConfig>;
  const rows = (Array.isArray(src.rows) ? src.rows : [])
    .map((r): RoadmapRow => ({
      id: typeof r?.id === 'string' && r.id ? r.id : newId(),
      feature: String(r?.feature ?? '').trim().slice(0, 90),
      status: r?.status === 'live' || r?.status === 'building' || r?.status === 'planned' ? r.status : 'planned',
      note: String(r?.note ?? '').trim().slice(0, 220),
    }))
    .filter((r) => r.feature)
    .slice(0, MAX_ROADMAP_ROWS);
  return {
    enabled: src.enabled !== false,
    heading: String(src.heading ?? DEFAULT_ROADMAP.heading).trim().slice(0, 80) || DEFAULT_ROADMAP.heading,
    intro: String(src.intro ?? DEFAULT_ROADMAP.intro).trim().slice(0, 240),
    rows,
  };
}

let inflight: Promise<RoadmapConfig> | null = null;

/** Saved roadmap, or the built-in default when nothing was saved yet (or the read fails). */
export function fetchRoadmap(): Promise<RoadmapConfig> {
  if (inflight) return inflight;
  inflight = (async () => {
    const { data, error } = await supabase.from('editable_pages').select('content').eq('slug', ROADMAP_SLUG).maybeSingle();
    if (error || !data?.content) return DEFAULT_ROADMAP;
    try {
      const cfg = normalize(JSON.parse(String(data.content)));
      return cfg.rows.length || !cfg.enabled ? cfg : DEFAULT_ROADMAP;
    } catch { return DEFAULT_ROADMAP; }
  })().finally(() => { inflight = null; });
  return inflight;
}

export async function saveRoadmap(cfg: RoadmapConfig): Promise<RoadmapConfig> {
  const clean = normalize(cfg);
  const { error } = await supabase.from('editable_pages').upsert({
    slug: ROADMAP_SLUG,
    title: 'Site roadmap',
    content: JSON.stringify(clean),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'slug' });
  if (error) throw error;
  return clean;
}
