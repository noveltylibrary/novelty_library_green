import { supabase } from '@/lib/supabase';
import { computeNlRating } from '@/lib/engagement';
import { normalizePosterUrl } from '@/lib/posterUrl';
import { safeExternalUrl } from '@/lib/sanitize';

/** What the Community Reviews section knows about one published review, keyed by review number. */
export interface ShelfCommunityInfo {
  /** The Community Reviews poster (square 2D template), already upgraded to a high-res URL. */
  posterUrl: string | null;
  /** NL rating: the reviewer's R/W score averaged with every reader rating (same maths as the community cards). */
  nlRating: number | null;
}

/**
 * Looks up the Community Reviews poster + NL rating for a set of published reviews so the profile card shows the
 * same artwork and the same NL number as the Community Reviews section. Best-effort: on any failure it returns
 * what it has and the card falls back to the book cover / R/W score.
 */
export async function fetchShelfCommunityInfo(reviewNos: string[]): Promise<Record<string, ShelfCommunityInfo>> {
  const nos = [...new Set(reviewNos.map((n) => String(n || '').trim()).filter(Boolean))];
  const out: Record<string, ShelfCommunityInfo> = {};
  if (!nos.length) return out;
  try {
    const { data, error } = await supabase
      .from('community_reviews')
      .select('id,review_no,poster_url,reviewers_rating')
      .eq('is_published', true)
      .in('review_no', nos);
    if (error) throw error;
    const rows = (data ?? []) as Array<{ id: string; review_no: string; poster_url: string | null; reviewers_rating: string | null }>;

    // Reader ratings come straight from the source rows (same as useEngagement), never from the aggregate view.
    const totals: Record<string, { count: number; sum: number }> = {};
    const ids = rows.map((r) => r.id);
    if (ids.length) {
      try {
        const { data: fb } = await supabase.from('community_review_feedback').select('review_id,rating').in('review_id', ids);
        for (const row of (fb ?? []) as Array<{ review_id: string; rating: number | null }>) {
          const rating = row.rating == null ? null : Number(row.rating);
          if (rating == null || !Number.isFinite(rating)) continue;
          const cur = totals[row.review_id] ?? { count: 0, sum: 0 };
          cur.count += 1; cur.sum += rating;
          totals[row.review_id] = cur;
        }
      } catch { /* reader ratings unavailable: NL falls back to the R/W score alone */ }
    }

    for (const r of rows) {
      const t = totals[r.id];
      const rw = Number.parseFloat(String(r.reviewers_rating ?? ''));
      out[String(r.review_no)] = {
        posterUrl: safeExternalUrl(normalizePosterUrl(r.poster_url)) || null,
        nlRating: computeNlRating(Number.isFinite(rw) ? rw : null, t ? { likeCount: 0, reviewCount: 0, ratingCount: t.count, ratingSum: t.sum } : undefined),
      };
    }
  } catch { /* community store unreachable: keep going with book covers */ }
  return out;
}

/** Average NL rating across a reader's published reviews (falls back to the R/W score where NL is unknown). */
export function averageNlRating(items: Array<{ nl: number | null | undefined; rw: number | null | undefined }>): number | null {
  const vals = items
    .map((i) => (i.nl != null && Number.isFinite(i.nl) && i.nl > 0 ? i.nl : (i.rw != null && Number.isFinite(i.rw) && i.rw > 0 ? i.rw : null)))
    .filter((v): v is number => v != null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}
