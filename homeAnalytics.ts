import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface LangCount { name: string; count: number }
export interface AcceptedItem { review_no: string; book_title: string; author: string; genre?: string; language?: string; reviewers_rating?: string; reviewer?: string }
export interface TopContributor { name: string; count: number; contact: string; instagram: string; website: string }
export interface HomeAnalytics {
  accepted_total: number;
  published_total: number;
  avg_form_rating: number | null;
  form_rating_count: number;
  avg_book_rating: number | null;
  reviewers: number;
  authors: number;
  english_reviews: number;
  languages: LangCount[];
  top_contributor: TopContributor | null;
  recent_accepted: AcceptedItem[];
  top_rated_accepted: AcceptedItem[];
  community_likes: number;
  community_ratings: number;
  community_reader_reviews: number;
  community_rating_sum: number;
  total_users: number;
}

/** Every STEP reviews the "curated N+" counter and progress bar roll over (same rule as the Blogger widget). */
export const MILESTONE_STEP = 50;

/** One call to the public `home_analytics()` database function (no private data / emails are exposed). */
export async function fetchHomeAnalytics(): Promise<HomeAnalytics> {
  const { data, error } = await supabase.rpc('home_analytics');
  if (error) throw error;
  return data as HomeAnalytics;
}

export function milestone(total: number, step = MILESTONE_STEP) {
  const floored = Math.floor(total / step) * step;
  const next = floored + step;
  return { floored, next, remain: next - total, progress: Math.min(100, ((total - floored) / step) * 100) };
}

export const formatFloor10 = (n: number) => (!n || n < 10 ? `${n || 0}+` : `${Math.floor(n / 10) * 10}+`);
export const formatLangCount = (n: number) => (!n || n <= 10 ? `${n || 10}+` : `${n - 1}+`);

export function cleanInsta(raw: string | null | undefined): string {
  if (!raw) return '';
  let s = String(raw).trim();
  if (s.includes('instagram.com/')) s = (s.split('instagram.com/')[1] || '').split('?')[0].split('/')[0].split('&')[0];
  s = s.replace('@', '').trim().toLowerCase();
  return s ? `@${s}` : '';
}

const withProtocol = (u: string) => (u.includes('http') ? u : `https://${u}`);

/** Same contact preference as the Blogger widget: chosen website -> Instagram -> website -> plain name. */
export function contributorLink(t: TopContributor): { text: string; href: string | null } {
  const choose = (t.contact || '').toLowerCase();
  const site = (t.website || '').trim();
  if (choose.includes('website') && site) return { text: site, href: withProtocol(site) };
  const insta = cleanInsta(t.instagram);
  if (insta) return { text: insta, href: `https://instagram.com/${insta.replace('@', '')}` };
  if (site) return { text: site, href: withProtocol(site) };
  return { text: t.name, href: null };
}

/** Smoothly counts from 0 to `target` (respects reduced-motion). */
export function useCountUp(target: number, decimals = 0, duration = 1200): number {
  const [value, setValue] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    if (!Number.isFinite(target)) return;
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || duration <= 0) { setValue(target); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(target * eased);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  const f = Math.pow(10, decimals);
  return Math.round(value * f) / f;
}
