import { supabase } from '@/lib/supabase';
import { computeNlRating } from '@/lib/engagement';
import { normalizePosterUrl } from '@/lib/posterUrl';
import { safeExternalUrl } from '@/lib/sanitize';
import { findBlogMetadata, type ReviewLike } from '@/lib/posterMatch';

/** A published review on a reader's profile, with enough details to match Blogger if its poster was not saved yet. */
export interface ShelfReviewRef {
  reviewNo: string | number | null | undefined;
  title?: string | null;
  author?: string | null;
}

/** What the Community Reviews section knows about one published review, keyed by the profile's original review number. */
export interface ShelfCommunityInfo {
  /** Community Reviews poster, or a live Blogger poster fallback. */
  posterUrl: string | null;
  /** NL rating: the reviewer's R/W score averaged with every reader rating (same maths as the community cards). */
  nlRating: number | null;
}

function normalizeReviewNo(value: string | number | null | undefined): string {
  const raw = String(value ?? '').trim().replace(/^#\s*/, '');
  const numeric = /^(?:review\s*(?:no\.?|number)?\s*)?0*(\d+)$/i.exec(raw);
  return numeric ? String(Number(numeric[1])) : raw.toLocaleLowerCase();
}

function validImageUrl(value: string | null | undefined): string | null {
  return safeExternalUrl(normalizePosterUrl(value)) || null;
}

/**
 * Loads published poster/rating metadata for the profile card. Poster URLs saved in
 * community_reviews take precedence. Older publications which only have Blogger
 * artwork are matched at runtime by review number/title, so they still show on both
 * private and public profile cards without requiring a schema migration or write.
 */
export async function fetchShelfCommunityInfo(input: Array<ShelfReviewRef | string>): Promise<Record<string, ShelfCommunityInfo>> {
  const refs: ShelfReviewRef[] = input.map((entry) => typeof entry === 'string' ? { reviewNo: entry } : entry)
    .filter((entry) => String(entry.reviewNo ?? '').trim() !== '');
  const out: Record<string, ShelfCommunityInfo> = {};
  if (!refs.length) return out;

  const wanted = new Set(refs.map((ref) => normalizeReviewNo(ref.reviewNo)));
  const rowsByNo = new Map<string, { id: string; review_no: string; poster_url: string | null; reviewers_rating: string | null }>();
  try {
    // Public publication metadata is small (a few hundred records). Read only these
    // four fields, then normalize numbers locally so "001" and "1" stay equivalent.
    const { data, error } = await supabase
      .from('public_community_reviews')
      .select('id,review_no,poster_url,reviewers_rating')
      .eq('is_published', true);
    if (error) throw error;
    for (const row of (data ?? []) as Array<{ id: string; review_no: string; poster_url: string | null; reviewers_rating: string | null }>) {
      const key = normalizeReviewNo(row.review_no);
      if (!wanted.has(key)) continue;
      const previous = rowsByNo.get(key);
      // Prefer the publication row with an assigned poster when legacy duplicate
      // review numbers exist, otherwise keep the first public row.
      if (!previous || (!previous.poster_url && row.poster_url)) rowsByNo.set(key, row);
    }
  } catch {
    // A temporary community-store error must not prevent the Blogger fallback below.
  }

  const matchedRows = [...new Map([...rowsByNo.values()].map((row) => [row.id, row])).values()];
  const totals: Record<string, { count: number; sum: number }> = {};
  const ids = matchedRows.map((row) => row.id);
  let readerRatingsAvailable = true;
  if (ids.length) {
    try {
      const { data: feedback, error } = await supabase.from('community_review_feedback').select('review_id,rating').in('review_id', ids);
      if (error) throw error;
      for (const row of (feedback ?? []) as Array<{ review_id: string; rating: number | null }>) {
        const rating = row.rating == null ? null : Number(row.rating);
        if (rating == null || !Number.isFinite(rating)) continue;
        const current = totals[row.review_id] ?? { count: 0, sum: 0 };
        current.count += 1;
        current.sum += rating;
        totals[row.review_id] = current;
      }
    } catch { readerRatingsAvailable = false; /* don't relabel an unknown R/W fallback as NL */ }
  }

  for (const ref of refs) {
    const key = normalizeReviewNo(ref.reviewNo);
    const row = rowsByNo.get(key);
    const total = row ? totals[row.id] : undefined;
    const rw = Number.parseFloat(String(row?.reviewers_rating ?? ''));
    out[String(ref.reviewNo)] = {
      posterUrl: validImageUrl(row?.poster_url),
      nlRating: row && readerRatingsAvailable ? computeNlRating(Number.isFinite(rw) ? rw : null, total ? { likeCount: 0, reviewCount: 0, ratingCount: total.count, ratingSum: total.sum } : undefined) : null,
    };
  }

  const missingPoster = refs.filter((ref) => !out[String(ref.reviewNo)]?.posterUrl && Number(normalizeReviewNo(ref.reviewNo)) > 0);
  if (missingPoster.length) {
    const bloggerReviews: ReviewLike[] = missingPoster.map((ref) => ({
      review_number: Number(normalizeReviewNo(ref.reviewNo)),
      title: ref.title || '',
      author: ref.author || '',
    }));
    const metadata = await findBlogMetadata(bloggerReviews);
    for (const ref of missingPoster) {
      const key = normalizeReviewNo(ref.reviewNo);
      const bloggerPoster = validImageUrl(metadata[key]?.posterUrl);
      if (!bloggerPoster) continue;
      const originalKey = String(ref.reviewNo);
      out[originalKey] = { posterUrl: bloggerPoster, nlRating: out[originalKey]?.nlRating ?? null };
    }
  }

  return out;
}

/** Average of available NL community ratings only. Never relabel a reviewer R/W score as NL. */
export function averageNlRating(items: Array<{ nl: number | null | undefined }>): number | null {
  const vals = items
    .map((item) => item.nl != null && Number.isFinite(item.nl) && item.nl > 0 ? item.nl : null)
    .filter((value): value is number => value != null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}
